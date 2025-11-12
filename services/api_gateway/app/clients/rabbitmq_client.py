"""RabbitMQ client for message publishing"""

import json
import time
from typing import Any

import aio_pika
import structlog
from aio_pika.abc import AbstractChannel, AbstractExchange, AbstractRobustConnection

from app.config import Settings
from app.metrics import (
    queue_messages_published_total,
    queue_publish_duration_seconds,
    queue_publish_errors_total,
)

# Initialize logger
log = structlog.get_logger()


class RabbitMQClient:
    """RabbitMQ connection manager"""

    def __init__(self, settings: Settings):
        self.settings = settings
        self.connection: AbstractRobustConnection | None = None
        self.channel: AbstractChannel | None = None
        self.exchange: AbstractExchange | None = None

    async def connect(self):
        """Establish connection to RabbitMQ"""
        try:
            log.info("rabbitmq_connecting")

            self.connection = await aio_pika.connect_robust(
                self.settings.rabbitmq_url,
                timeout=self.settings.rabbitmq_connection_timeout,
                heartbeat=self.settings.rabbitmq_heartbeat,
            )

            self.channel = await self.connection.channel()
            await self.channel.set_qos(prefetch_count=self.settings.rabbitmq_prefetch_count)

            log.info("rabbitmq_connected")

        except Exception as e:
            log.error("rabbitmq_connection_failed", error=str(e))
            raise

    async def disconnect(self):
        """Close RabbitMQ connection"""
        if self.channel:
            await self.channel.close()

        if self.connection:
            await self.connection.close()

        log.info("rabbitmq_disconnected")

    async def setup_topology(self):
        """Set up exchanges and queues"""
        if not self.channel:
            raise RuntimeError("Channel not initialized")

        # Main exchange
        self.exchange = await self.channel.declare_exchange(
            self.settings.rabbitmq_exchange,
            type=aio_pika.ExchangeType.DIRECT,
            durable=True,
        )

        # Dead letter exchange
        dlx = await self.channel.declare_exchange(
            self.settings.rabbitmq_dlx, type=aio_pika.ExchangeType.DIRECT, durable=True
        )

        # Failed queue (DLQ)
        failed_queue = await self.channel.declare_queue(
            self.settings.rabbitmq_failed_queue,
            durable=True,
            arguments={"x-queue-type": "quorum"},
        )

        # Bind failed queue to DLX
        await failed_queue.bind(dlx, routing_key="email.failed")
        await failed_queue.bind(dlx, routing_key="push.failed")

        # Email queue
        email_queue = await self.channel.declare_queue(
            self.settings.rabbitmq_email_queue,
            durable=True,
            arguments={
                "x-message-ttl": self.settings.queue_message_ttl, # TTL to auto expire old messages
                "x-max-length": self.settings.queue_max_length, # max length to limit queue size
                "x-dead-letter-exchange": self.settings.rabbitmq_dlx, # exchange to route failed messages
                "x-dead-letter-routing-key": "email.failed", # dlx routing key
                "x-queue-type": "quorum", # use quorum queue for reliability
            },
        )

        # Bind email queue to main exchange
        await email_queue.bind(self.exchange, routing_key="notification.email")

        # Push queue
        push_queue = await self.channel.declare_queue(
            self.settings.rabbitmq_push_queue,
            durable=True,
            arguments={
                "x-message-ttl": self.settings.queue_message_ttl,
                "x-max-length": self.settings.queue_max_length,
                "x-dead-letter-exchange": self.settings.rabbitmq_dlx,
                "x-dead-letter-routing-key": "push.failed",
                "x-queue-type": "quorum",
            },
        )
        # Bind push queue to main exchange
        await push_queue.bind(self.exchange, routing_key="notification.push")

        log.info("rabbitmq_topology_configured")

    async def publish(self, message: dict[str, Any], routing_key: str, correlation_id: str) -> bool:
        """
        Publish message to exchange.

        Args:
            message: Message payload
            routing_key: Routing key for message
            correlation_id: Request correlation ID

        Returns:
            True if published successfully
        """
        if not self.exchange:
            raise RuntimeError("Exchange not initialized")

        # Determine queue name from routing key
        queue_name = MessageRouter.get_target_queue(
            routing_key.replace("notification.", "")
        )

        # Start timing
        start_time = time.perf_counter()

        try:
            # Serialize message
            body = json.dumps(message).encode("utf-8")

            # Create message
            aio_message = aio_pika.Message(
                body=body,
                delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
                content_type="application/json",
                correlation_id=correlation_id,
                headers={"x-correlation-id": correlation_id},
            )

            # Publish with confirmation
            await self.exchange.publish(aio_message, routing_key=routing_key, mandatory=True)

            # Record success metrics
            duration = time.perf_counter() - start_time
            queue_messages_published_total.labels(queue_name=queue_name).inc()
            queue_publish_duration_seconds.labels(queue_name=queue_name).observe(duration)

            log.info(
                "message_published",
                routing_key=routing_key,
                correlation_id=correlation_id,
            )

            return True

        except Exception as e:
            # Record error metrics
            queue_publish_errors_total.labels(
                queue_name=queue_name, error_type=type(e).__name__
            ).inc()

            log.error(
                "publish_failed",
                routing_key=routing_key,
                correlation_id=correlation_id,
                error=str(e),
                exc_info=True,
            )
            raise


class MessageRouter:
    """Route messages to appropriate queues"""

    ROUTING_KEYS = {"email": "notification.email", "push": "notification.push"}

    TARGET_QUEUES = {"email": "email.queue", "push": "push.queue"}

    @classmethod
    def get_routing_key(cls, notification_type: str) -> str:
        """Get routing key for notification type"""
        routing_key = cls.ROUTING_KEYS.get(notification_type)

        if not routing_key:
            raise ValueError(f"Invalid notification type: {notification_type}")

        return routing_key

    @classmethod
    def get_target_queue(cls, notification_type: str) -> str:
        """Get target queue name for notification type"""
        return cls.TARGET_QUEUES.get(notification_type, "unknown")
