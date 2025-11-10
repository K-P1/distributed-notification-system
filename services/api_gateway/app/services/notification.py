"""Notification service for orchestrating notification submission"""

from datetime import UTC, datetime
from typing import Any
from uuid import UUID, uuid4

import structlog
from circuitbreaker import CircuitBreakerError
from fastapi import HTTPException

from app.clients.rabbitmq_client import MessageRouter, RabbitMQClient
from app.clients.redis_client import IdempotencyCache
from app.schemas import MessageEnvelope, NotificationRequest, NotificationStatus
from app.services.enrichment import EnrichmentService
from app.services.status import StatusService

log = structlog.get_logger()


class NotificationService:
    """Service for notification submission"""

    def __init__(
        self,
        enrichment_service: EnrichmentService,
        status_service: StatusService,
        rabbitmq_client: RabbitMQClient,
        idempotency_cache: IdempotencyCache,
    ):
        self.enrichment = enrichment_service
        self.status = status_service
        self.rabbitmq = rabbitmq_client
        self.idempotency = idempotency_cache

    async def submit_notification(
        self, request: NotificationRequest, correlation_id: str
    ) -> dict[str, Any]:
        """
        Submit notification for processing.

        Args:
            request: Notification request
            correlation_id: Request correlation ID

        Returns:
            Response dict

        Raises:
            HTTPException: On various failure scenarios
        """
        # Check idempotency
        if request.request_id:
            cached_response = await self.idempotency.get(request.request_id)
            if cached_response:
                log.info(
                    "idempotent_request",
                    request_id=request.request_id,
                    correlation_id=correlation_id,
                )
                raise HTTPException(
                    status_code=409,
                    detail="Request already processed",
                    headers={"X-Request-ID": request.request_id},
                )

        # Generate notification ID
        notification_id = uuid4()
        request_id = request.request_id or str(uuid4())

        log.info(
            "notification_submit_start",
            notification_id=str(notification_id),
            request_id=request_id,
            notification_type=request.notification_type.value,
            correlation_id=correlation_id,
        )

        try:
            # Enrich notification
            user_data, template_data = await self.enrichment.enrich_notification(
                request.user_id,
                request.template_code,
                request.notification_type,
                correlation_id,
            )

            # Build message envelope
            envelope = MessageEnvelope(
                notification_id=notification_id,
                request_id=request_id,
                user_id=request.user_id,
                notification_type=request.notification_type,
                template_code=request.template_code,
                variables=request.variables,
                priority=request.priority,
                timestamp=datetime.now(UTC),
                user_data=user_data,
                template_data=template_data,
            )

            # Route and publish
            routing_key = MessageRouter.get_routing_key(request.notification_type.value)
            target_queue = MessageRouter.get_target_queue(request.notification_type.value)

            log.info(
                "routing_message",
                notification_id=str(notification_id),
                routing_key=routing_key,
                target_queue=target_queue,
                correlation_id=correlation_id,
            )

            # Publish to RabbitMQ
            success = await self.rabbitmq.publish(
                envelope.model_dump(mode="json"), routing_key, correlation_id
            )

            if not success:
                raise Exception("Failed to publish message")

            # Create status record
            await self.status.create_status(
                notification_id,
                UUID(request_id),
                request.user_id,
                request.notification_type.value,
            )

            # Build response
            response_data = {
                "success": True,
                "data": {
                    "notification_id": str(notification_id),
                    "status": NotificationStatus.PENDING.value,
                    "request_id": request_id,
                    "created_at": datetime.now(UTC).isoformat(),
                },
                "error": None,
                "message": "Notification queued successfully",
                "meta": None,
            }

            # Cache response for idempotency
            if request.request_id:
                await self.idempotency.set(request.request_id, response_data)

            log.info(
                "notification_submitted",
                notification_id=str(notification_id),
                request_id=request_id,
                correlation_id=correlation_id,
            )

            return response_data

        except CircuitBreakerError as e:
            log.error(
                "circuit_breaker_open",
                notification_id=str(notification_id),
                error=str(e),
                correlation_id=correlation_id,
            )

            # Update status to failed
            await self._update_status_failed(
                notification_id,
                request_id,
                request.user_id,
                request.notification_type.value,
                "Circuit breaker open",
            )

            raise HTTPException(
                status_code=503,
                detail="Service temporarily unavailable (circuit breaker open)",
                headers={"Retry-After": "60"},
            ) from e

        except HTTPException:
            # Re-raise HTTP exceptions
            raise

        except Exception as e:
            log.error(
                "notification_submit_failed",
                notification_id=str(notification_id),
                error=str(e),
                correlation_id=correlation_id,
                exc_info=True,
            )

            # Update status to failed
            await self._update_status_failed(
                notification_id,
                request_id,
                request.user_id,
                request.notification_type.value,
                str(e),
            )

            raise HTTPException(
                status_code=503,
                detail=f"Failed to queue notification: {str(e)}",
                headers={"Retry-After": "30"},
            ) from e

    async def _update_status_failed(
        self,
        notification_id: UUID,
        request_id: str,
        user_id: UUID,
        notification_type: str,
        error_message: str,
    ):
        """Update notification status to failed"""
        try:
            # Create status if it doesn't exist
            await self.status.create_status(
                notification_id, UUID(request_id), user_id, notification_type
            )

            # Update to failed
            await self.status.update_status(
                notification_id, NotificationStatus.FAILED, "api_gateway", error_message
            )
        except Exception as e:
            log.error(
                "failed_status_update_error",
                notification_id=str(notification_id),
                error=str(e),
            )
            # Suppress exception since we're in error handling
            raise RuntimeError(f"Failed to update status: {str(e)}") from e
