"""Redis client for caching, idempotency, and rate limiting"""

import json
from datetime import datetime

import redis.asyncio as redis
import structlog

from app.config import Settings
from app.metrics import cache_operations_total

log = structlog.get_logger()


class RedisManager:
    """Redis connection manager"""

    def __init__(self, settings: Settings):
        self.settings = settings

        # Create connection pool
        self.pool = redis.ConnectionPool.from_url(
            settings.redis_url,
            max_connections=settings.redis_max_connections,
            socket_timeout=settings.redis_socket_timeout,
            socket_connect_timeout=settings.redis_socket_connect_timeout,
            decode_responses=True,
        )

        self.client = redis.Redis(connection_pool=self.pool)

    async def close(self):
        """Close Redis connection"""
        await self.client.close()
        await self.pool.disconnect()

    async def ping(self) -> bool:
        """Health check"""
        try:
            return await self.client.ping()
        except Exception as e:
            log.error("redis_ping_failed", error=str(e))
            return False


class IdempotencyCache:
    """Idempotency key management"""

    def __init__(self, redis_client: redis.Redis, ttl: int):
        self.redis = redis_client
        self.ttl = ttl

    def _make_key(self, request_id: str) -> str:
        """Generate idempotency key"""
        return f"idempotency:{request_id}"

    async def get(self, request_id: str) -> dict | None:
        """Get cached response for request_id"""
        key = self._make_key(request_id)
        cached = await self.redis.get(key)

        # Track cache operation
        result = "hit" if cached else "miss"
        cache_operations_total.labels(
            cache_type="idempotency", operation="get", result=result
        ).inc()

        if not cached:
            return None

        return json.loads(cached)

    async def set(self, request_id: str, response_data: dict):
        """Cache response for request_id"""
        key = self._make_key(request_id)
        value = json.dumps(response_data)

        await self.redis.setex(key, self.ttl, value)

        # Track cache operation
        cache_operations_total.labels(
            cache_type="idempotency", operation="set", result="success"
        ).inc()

        log.info("idempotency_cached", request_id=request_id)


class StatusCache:
    """Notification status caching"""

    def __init__(self, redis_client: redis.Redis, ttl: int):
        self.redis = redis_client
        self.ttl = ttl

    def _make_key(self, notification_id: str) -> str:
        """Generate cache key"""
        return f"status:{notification_id}"

    async def get(self, notification_id: str) -> dict | None:
        """Get status from cache"""
        key = self._make_key(notification_id)
        cached = await self.redis.get(key)

        # Track cache operation
        result = "hit" if cached else "miss"
        cache_operations_total.labels(
            cache_type="status", operation="get", result=result
        ).inc()

        if not cached:
            return None

        return json.loads(cached)

    async def set(self, notification_id: str, status_data: dict):
        """Cache status record"""
        key = self._make_key(notification_id)
        value = json.dumps(status_data, default=str)

        await self.redis.setex(key, self.ttl, value)

        # Track cache operation
        cache_operations_total.labels(
            cache_type="status", operation="set", result="success"
        ).inc()

    async def invalidate(self, notification_id: str):
        """Remove status from cache"""
        key = self._make_key(notification_id)
        await self.redis.delete(key)

    async def delete(self, notification_id: str):
        """Invalidate cache"""
        key = self._make_key(notification_id)
        await self.redis.delete(key)


class ServiceCache:
    """Cache for external service responses"""

    def __init__(self, redis_client: redis.Redis, ttl: int):
        self.redis = redis_client
        self.ttl = ttl

    def _make_key(self, service: str, resource_id: str) -> str:
        """Generate cache key"""
        return f"service:{service}:{resource_id}"

    async def get(self, service: str, resource_id: str) -> dict | None:
        """Get cached service response"""
        key = self._make_key(service, resource_id)
        cached = await self.redis.get(key)

        # Track cache operation
        result = "hit" if cached else "miss"
        cache_operations_total.labels(
            cache_type="service", operation="get", result=result
        ).inc()

        if not cached:
            return None

        log.debug("service_cache_hit", service=service, resource_id=resource_id)
        return json.loads(cached)

    async def set(self, service: str, resource_id: str, data: dict):
        """Cache service response"""
        key = self._make_key(service, resource_id)
        value = json.dumps(data)

        await self.redis.setex(key, self.ttl, value)

        # Track cache operation
        cache_operations_total.labels(
            cache_type="service", operation="set", result="success"
        ).inc()

        log.debug("service_cache_set", service=service, resource_id=resource_id)


class RateLimiter:
    """Rate limiting with sliding window"""

    def __init__(self, redis_client: redis.Redis, window: int):
        self.redis = redis_client
        self.window = window

    def _make_key(self, identifier: str) -> str:
        """Generate rate limit key"""
        return f"ratelimit:{identifier}"

    async def check_limit(self, identifier: str, limit: int) -> tuple[bool, int]:
        """
        Check if request is within rate limit.

        Returns:
            (is_allowed, remaining_requests)
        """
        key = self._make_key(identifier)
        current_time = int(datetime.now().timestamp())
        window_start = current_time - self.window

        # Remove old entries
        await self.redis.zremrangebyscore(key, 0, window_start)

        # Count requests in current window
        count = await self.redis.zcard(key)

        if count >= limit:
            return False, 0

        # Add current request
        await self.redis.zadd(key, {str(current_time): current_time})
        await self.redis.expire(key, self.window)

        remaining = limit - count - 1
        return True, remaining
