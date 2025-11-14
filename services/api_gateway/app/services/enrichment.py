"""
Enrichment service for fetching user and template data

Implements parallel fetching from User and Template services with:
- Redis caching (5 min TTL)
- Circuit breaker protection
- Validation of fetched data
"""

import asyncio
from typing import Any
from uuid import UUID

import structlog
from fastapi import HTTPException

from app.clients.redis_client import ServiceCache
from app.clients.template_service import TemplateServiceClient
from app.clients.user_service import UserServiceClient
from app.schemas import NotificationType

log = structlog.get_logger()


class EnrichmentService:
    """Service for enriching notifications with user and template data"""

    def __init__(
        self,
        user_service: UserServiceClient,
        template_service: TemplateServiceClient,
        service_cache: ServiceCache,
    ):
        """
        Initialize enrichment service.

        Args:
            user_service: HTTP client for User service
            template_service: HTTP client for Template service
            service_cache: Redis cache for service data
        """
        self.user_service = user_service
        self.template_service = template_service
        self.service_cache = service_cache

    async def enrich_notification(
        self,
        user_id: UUID,
        template_code: str,
        notification_type: NotificationType,
        correlation_id: str,
    ) -> tuple[dict[str, Any], dict[str, Any]]:
        """
        Enrich notification with user and template data.

        Fetches user and template data in parallel using asyncio.gather.
        Checks cache first, then fetches from services if needed.
        Validates that user has required contact info and preferences.

        Args:
            user_id: User UUID
            template_code: Template code identifier
            notification_type: Type of notification (email/push)
            correlation_id: Request correlation ID for tracing

        Returns:
            Tuple of (user_data, template_data) dictionaries

        Raises:
            HTTPException: If enrichment fails or validation fails
        """
        log.info(
            "enrichment_start",
            user_id=str(user_id),
            template_code=template_code,
            notification_type=notification_type.value,
            correlation_id=correlation_id,
        )

        try:
            # Check cache first for both user and template
            user_cached = await self.service_cache.get("user", str(user_id))
            template_cached = await self.service_cache.get("template", template_code)

            # Prepare parallel fetch tasks for missing data
            tasks = []
            if not user_cached:
                tasks.append(self._fetch_user(str(user_id), correlation_id))
            if not template_cached:
                tasks.append(self._fetch_template(template_code, correlation_id))

            # Fetch in parallel if needed
            if tasks:
                results = await asyncio.gather(*tasks, return_exceptions=True)

                # Process results and handle exceptions
                result_idx = 0
                if not user_cached:
                    result = results[result_idx]
                    if isinstance(result, Exception):
                        raise result
                    user_data = result
                    result_idx += 1
                else:
                    user_data = user_cached

                if not template_cached:
                    result = results[result_idx]
                    if isinstance(result, Exception):
                        raise result
                    template_data = result
                else:
                    template_data = template_cached
            else:
                # Both found in cache
                user_data = user_cached
                template_data = template_cached

            # Validate enriched data meets requirements
            self._validate_user_data(user_data, notification_type)  # type: ignore
            self._validate_template_data(template_data)  # type: ignore

            log.info(
                "enrichment_success",
                user_id=str(user_id),
                template_code=template_code,
                correlation_id=correlation_id,
                user_cached=user_cached is not None,
                template_cached=template_cached is not None,
            )

            return user_data, template_data  # type: ignore

        except HTTPException:
            raise
        except Exception as e:
            log.error(
                "enrichment_failed",
                user_id=str(user_id),
                template_code=template_code,
                error=str(e),
                correlation_id=correlation_id,
                exc_info=True,
            )
            raise HTTPException(status_code=503, detail=f"Enrichment failed: {str(e)}") from e

    async def _fetch_user(self, user_id: str, correlation_id: str) -> dict[str, Any]:
        """
        Fetch user data from User service with caching.

        Args:
            user_id: User UUID string
            correlation_id: Request correlation ID

        Returns:
            User data dictionary

        Raises:
            HTTPException: If fetch fails
        """
        try:
            user_data = await self.user_service.get_user(user_id, correlation_id)

            # Cache for future requests (5 min TTL)
            await self.service_cache.set("user", user_id, user_data)

            log.debug("user_fetched", user_id=user_id, correlation_id=correlation_id)

            return user_data

        except Exception as e:
            log.error(
                "user_fetch_failed",
                user_id=user_id,
                error=str(e),
                correlation_id=correlation_id,
            )
            raise HTTPException(
                status_code=503, detail=f"User service unavailable: {str(e)}"
            ) from e

    async def _fetch_template(self, template_code: str, correlation_id: str) -> dict[str, Any]:
        """
        Fetch template data from Template service with caching.

        Args:
            template_code: Template identifier
            correlation_id: Request correlation ID

        Returns:
            Template data dictionary

        Raises:
            HTTPException: If fetch fails
        """
        try:
            template_data = await self.template_service.get_template(template_code, correlation_id)

            # Cache for future requests (5 min TTL)
            await self.service_cache.set("template", template_code, template_data)

            log.debug(
                "template_fetched",
                template_code=template_code,
                correlation_id=correlation_id,
            )

            return template_data

        except Exception as e:
            log.error(
                "template_fetch_failed",
                template_code=template_code,
                error=str(e),
                correlation_id=correlation_id,
            )
            raise HTTPException(
                status_code=503, detail=f"Template service unavailable: {str(e)}"
            ) from e

    def _validate_user_data(self, user_data: dict[str, Any], notification_type: NotificationType):
        """
        Validate user has required contact info and channel preferences.

        Checks:
        - Email notifications require email address
        - Push notifications require push token (provided separately in request)
        - User preferences must allow the channel

        Args:
            user_data: User data dictionary
            notification_type: Type of notification

        Raises:
            HTTPException: If validation fails (422)
        """
        # Verify required contact info based on notification type
        if notification_type == NotificationType.EMAIL:
            if not user_data.get("email"):
                raise HTTPException(status_code=422, detail="User has no email address")
        # Push token validation removed - now provided in request

        # Verify user preferences allow this channel
        preferences = user_data.get("preferences", {})
        allowed_channels = preferences.get("channels", [])

        if notification_type.value not in allowed_channels:
            raise HTTPException(
                status_code=422,
                detail=f"User has disabled {notification_type.value} notifications",
            )

    def _validate_template_data(self, template_data: dict[str, Any]):
        """
        Validate template has required content.

        Args:
            template_data: Template data dictionary

        Raises:
            HTTPException: If template has no content (422)
        """
        if not template_data.get("subject") and not template_data.get("body"):
            raise HTTPException(status_code=422, detail="Template has no content")
