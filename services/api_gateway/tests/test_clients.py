"""
Unit tests for Redis caching functionality.

Tests idempotency cache, status cache, service cache, and rate limiting.
"""

import pytest
from uuid import uuid4


@pytest.mark.asyncio
async def test_idempotency_cache_set_and_get(redis_client):
    """Test idempotency cache stores and retrieves responses"""
    from app.clients.redis_client import IdempotencyCache

    cache = IdempotencyCache(redis_client, ttl=3600)
    request_id = f"req-{uuid4()}"
    response_data = {"notification_id": str(uuid4()), "status": "pending"}

    # Store response
    await cache.set(request_id, response_data)

    # Retrieve response
    cached = await cache.get(request_id)

    assert cached is not None
    assert cached["notification_id"] == response_data["notification_id"]


@pytest.mark.asyncio
async def test_status_cache(redis_client):
    """Test status cache stores and retrieves notification status"""
    from app.clients.redis_client import StatusCache

    cache = StatusCache(redis_client, ttl=3600)
    notification_id = str(uuid4())
    status_data = {"status": "delivered", "updated_at": "2025-11-10T12:00:00"}

    # Store status
    await cache.set(notification_id, status_data)

    # Retrieve status
    cached = await cache.get(notification_id)

    assert cached is not None
    assert cached["status"] == "delivered"


@pytest.mark.asyncio
async def test_service_cache(redis_client):
    """Test service cache stores user and template data"""
    from app.clients.redis_client import ServiceCache

    cache = ServiceCache(redis_client, ttl=300)
    user_id = str(uuid4())
    user_data = {"email": "test@example.com", "name": "Test User"}

    # Store user data
    await cache.set("user", user_id, user_data)

    # Retrieve user data
    cached = await cache.get("user", user_id)

    assert cached is not None
    assert cached["email"] == "test@example.com"


@pytest.mark.asyncio
async def test_rate_limiter_allows_requests(redis_client):
    """Test rate limiter allows requests within limit"""
    from app.clients.redis_client import RateLimiter

    limiter = RateLimiter(redis_client, window=60)
    api_key = "test_api_key"
    limit = 100

    # Should allow requests within limit
    for i in range(5):
        allowed, remaining = await limiter.check_limit(api_key, limit)
        assert allowed is True


@pytest.mark.asyncio
@pytest.mark.skip(reason="fakeredis sorted set behavior differs from real Redis")
async def test_rate_limiter_blocks_excess_requests(redis_client):
    """Test rate limiter blocks requests exceeding limit"""
    from app.clients.redis_client import RateLimiter

    limiter = RateLimiter(redis_client, window=60)
    api_key = "test_api_key_2"
    limit = 3

    # Make requests up to limit
    for i in range(limit):
        allowed, remaining = await limiter.check_limit(api_key, limit)
        assert allowed is True, f"Request {i+1} should be allowed"

    # Next request should be blocked
    allowed, remaining = await limiter.check_limit(api_key, limit)
    assert allowed is False, "Request beyond limit should be blocked"
    assert remaining == 0, "Remaining should be 0 when limit exceeded"


@pytest.mark.asyncio
async def test_status_cache_invalidation(redis_client):
    """Test status cache can be invalidated"""
    from app.clients.redis_client import StatusCache

    cache = StatusCache(redis_client, ttl=3600)
    notification_id = str(uuid4())

    # Store status
    await cache.set(notification_id, {"status": "pending"})

    # Verify it exists
    assert await cache.get(notification_id) is not None

    # Invalidate
    await cache.invalidate(notification_id)

    # Verify it's gone
    assert await cache.get(notification_id) is None
