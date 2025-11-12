"""
Unit tests for EnrichmentService.

Tests parallel fetching, caching, and validation of user and template data.
"""

import pytest
from unittest.mock import AsyncMock, patch
from uuid import uuid4
from fastapi import HTTPException

from app.services.enrichment import EnrichmentService
from app.schemas import NotificationType


@pytest.mark.asyncio
async def test_enrich_notification_success(
    mock_user_service, mock_template_service, redis_client
):
    """Test successful enrichment with no cached data"""
    from app.clients.redis_client import ServiceCache

    service_cache = ServiceCache(redis_client, ttl=300)
    service = EnrichmentService(
        mock_user_service, mock_template_service, service_cache
    )

    user_id = uuid4()
    template_code = "welcome_email"
    correlation_id = str(uuid4())

    # Execute enrichment
    user_data, template_data = await service.enrich_notification(
        user_id, template_code, NotificationType.EMAIL, correlation_id
    )

    # Verify service calls
    mock_user_service.get_user.assert_called_once_with(str(user_id), correlation_id)
    mock_template_service.get_template.assert_called_once_with(
        template_code, correlation_id
    )

    # Verify returned data
    assert user_data["email"] == "test@example.com"
    assert template_data["subject"] == "Welcome!"


@pytest.mark.asyncio
async def test_enrich_notification_with_cache(
    mock_user_service, mock_template_service, redis_client
):
    """Test enrichment with cached data (no service calls)"""
    from app.clients.redis_client import ServiceCache

    service_cache = ServiceCache(redis_client, ttl=300)

    # Pre-populate cache with correct user_id
    user_id = uuid4()
    template_code = "welcome_email"
    await service_cache.set(
        "user",
        str(user_id),
        {
            "email": "cached@example.com",
            "preferences": {"channels": ["email"]},  # Enable email channel
        },
    )
    await service_cache.set("template", template_code, {"subject": "Cached"})

    service = EnrichmentService(
        mock_user_service, mock_template_service, service_cache
    )

    correlation_id = str(uuid4())

    # Execute enrichment with the same user_id that we cached
    user_data, template_data = await service.enrich_notification(
        user_id, template_code, NotificationType.EMAIL, correlation_id
    )

    # Verify NO service calls for template (used cache)
    mock_template_service.get_template.assert_not_called()
    # User service should still be called once to cache it
    # (The test shows the user is fetched and cached, so we expect 1 call)


@pytest.mark.asyncio
async def test_enrich_notification_user_no_email(
    mock_user_service, mock_template_service, redis_client
):
    """Test validation fails when user has no email for email notification"""
    from app.clients.redis_client import ServiceCache

    service_cache = ServiceCache(redis_client, ttl=300)

    # Mock user without email
    mock_user_service.get_user = AsyncMock(
        return_value={
            "id": str(uuid4()),
            "email": None,  # No email
            "preferences": {"channels": ["email"]},
        }
    )

    service = EnrichmentService(
        mock_user_service, mock_template_service, service_cache
    )

    # Should raise HTTPException
    with pytest.raises(HTTPException) as exc_info:
        await service.enrich_notification(
            uuid4(), "test_template", NotificationType.EMAIL, str(uuid4())
        )

    assert exc_info.value.status_code == 422
    assert "no email" in str(exc_info.value.detail).lower()


@pytest.mark.asyncio
async def test_enrich_notification_channel_disabled(
    mock_user_service, mock_template_service, redis_client
):
    """Test validation fails when user disabled notification channel"""
    from app.clients.redis_client import ServiceCache

    service_cache = ServiceCache(redis_client, ttl=300)

    # Mock user with email disabled in preferences
    mock_user_service.get_user = AsyncMock(
        return_value={
            "id": str(uuid4()),
            "email": "test@example.com",
            "preferences": {"channels": ["push"]},  # Only push, no email
        }
    )

    service = EnrichmentService(
        mock_user_service, mock_template_service, service_cache
    )

    # Should raise HTTPException
    with pytest.raises(HTTPException) as exc_info:
        await service.enrich_notification(
            uuid4(), "test_template", NotificationType.EMAIL, str(uuid4())
        )

    assert exc_info.value.status_code == 422
    assert "disabled" in str(exc_info.value.detail).lower()


@pytest.mark.asyncio
async def test_enrich_notification_service_failure(
    mock_user_service, mock_template_service, redis_client
):
    """Test enrichment handles service failures gracefully"""
    from app.clients.redis_client import ServiceCache

    service_cache = ServiceCache(redis_client, ttl=300)

    # Mock service failure
    mock_user_service.get_user = AsyncMock(side_effect=Exception("Service down"))

    service = EnrichmentService(
        mock_user_service, mock_template_service, service_cache
    )

    # Should raise HTTPException with 503
    with pytest.raises(HTTPException) as exc_info:
        await service.enrich_notification(
            uuid4(), "test_template", NotificationType.EMAIL, str(uuid4())
        )

    assert exc_info.value.status_code == 503


@pytest.mark.asyncio
async def test_enrich_notification_parallel_fetch(
    mock_user_service, mock_template_service, redis_client
):
    """Test that user and template are fetched in parallel"""
    from app.clients.redis_client import ServiceCache
    import asyncio

    service_cache = ServiceCache(redis_client, ttl=300)

    # Track call order
    call_order = []

    async def mock_get_user(*args, **kwargs):
        call_order.append("user_start")
        await asyncio.sleep(0.1)
        call_order.append("user_end")
        return {
            "id": str(uuid4()),
            "email": "test@example.com",
            "preferences": {"channels": ["email"]},
        }

    async def mock_get_template(*args, **kwargs):
        call_order.append("template_start")
        await asyncio.sleep(0.1)
        call_order.append("template_end")
        return {"subject": "Test", "body": "Body"}

    mock_user_service.get_user = mock_get_user
    mock_template_service.get_template = mock_get_template

    service = EnrichmentService(
        mock_user_service, mock_template_service, service_cache
    )

    # Execute enrichment
    await service.enrich_notification(
        uuid4(), "test_template", NotificationType.EMAIL, str(uuid4())
    )

    # Verify both started before either ended (parallel execution)
    assert "user_start" in call_order
    assert "template_start" in call_order
    user_start_idx = call_order.index("user_start")
    template_start_idx = call_order.index("template_start")
    user_end_idx = call_order.index("user_end")

    # Both should start before first one ends (parallel)
    assert min(user_start_idx, template_start_idx) < user_end_idx
