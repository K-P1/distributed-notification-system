"""Status management service"""

from uuid import UUID

import structlog

from app.clients.redis_client import StatusCache
from app.models import NotificationStatusModel
from app.repositories import StatusRepository
from app.schemas import NotificationStatus, NotificationStatusRecord

log = structlog.get_logger()


class StatusService:
    """Service for status management with caching"""

    def __init__(self, repository: StatusRepository, cache: StatusCache):
        self.repository = repository
        self.cache = cache

    async def create_status(
        self,
        notification_id: UUID,
        request_id: UUID,
        user_id: UUID,
        notification_type: str,
    ) -> NotificationStatusRecord:
        """Create initial pending status"""
        status_model = await self.repository.create_status(
            notification_id, request_id, user_id, notification_type
        )

        # Convert to schema
        status = self._model_to_schema(status_model)

        # Cache it
        await self.cache.set(str(notification_id), status.model_dump(mode="json"))

        return status

    async def update_status(
        self,
        notification_id: UUID,
        new_status: NotificationStatus,
        changed_by: str,
        error_message: str | None = None,
        metadata: dict | None = None,
    ) -> NotificationStatusRecord | None:
        """Update status and invalidate cache"""
        status_model = await self.repository.update_status(
            notification_id, new_status, changed_by, error_message, metadata
        )

        if status_model:
            # Invalidate cache (will be re-cached on next read)
            await self.cache.delete(str(notification_id))

            return self._model_to_schema(status_model)

        return None

    async def get_status(self, notification_id: UUID) -> NotificationStatusRecord | None:
        """Get status with caching"""
        # Try cache first
        cached = await self.cache.get(str(notification_id))
        if cached:
            log.debug("status_cache_hit", notification_id=str(notification_id))
            return NotificationStatusRecord(**cached)

        # Cache miss - fetch from DB
        log.debug("status_cache_miss", notification_id=str(notification_id))
        status_model = await self.repository.get_status(notification_id)

        if status_model:
            status = self._model_to_schema(status_model)

            # Cache it
            await self.cache.set(str(notification_id), status.model_dump(mode="json"))

            return status

        return None

    def _model_to_schema(self, model: NotificationStatusModel) -> NotificationStatusRecord:
        """Convert model to schema"""
        return NotificationStatusRecord(
            notification_id=model.notification_id,
            request_id=model.request_id,
            user_id=model.user_id,
            notification_type=model.notification_type,
            status=NotificationStatus(model.status),
            error_message=model.error_message,
            retry_count=model.retry_count,
            created_at=model.created_at,
            updated_at=model.updated_at,
        )
