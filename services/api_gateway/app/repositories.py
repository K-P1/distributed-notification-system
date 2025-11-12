"""Database repositories"""

from datetime import UTC, datetime
from uuid import UUID

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    NotificationStatusEnum,
    NotificationStatusModel,
    StatusHistoryModel,
)
from app.schemas import NotificationStatus

log = structlog.get_logger()


class StatusRepository:
    """Repository for notification status operations"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_status(
        self,
        notification_id: UUID,
        request_id: str,
        user_id: UUID,
        notification_type: str,
    ) -> NotificationStatusModel:
        """Create initial status record (pending)"""
        now = datetime.now(UTC)

        # Insert status record
        status_record = NotificationStatusModel(
            notification_id=notification_id,
            request_id=request_id,
            user_id=user_id,
            notification_type=notification_type,
            status=NotificationStatusEnum.PENDING.value,
            retry_count=0,
            created_at=now,
            updated_at=now,
        )

        self.db.add(status_record)

        # Create history entry
        history_record = StatusHistoryModel(
            notification_id=notification_id,
            previous_status=None,
            new_status=NotificationStatusEnum.PENDING.value,
            changed_at=now,
            changed_by="api_gateway",
        )

        self.db.add(history_record)

        await self.db.commit()
        await self.db.refresh(status_record)

        log.info("status_created", notification_id=str(notification_id), status="pending")

        return status_record

    async def update_status(
        self,
        notification_id: UUID,
        new_status: NotificationStatus,
        changed_by: str,
        error_message: str | None = None,
        metadata: dict | None = None,
    ) -> NotificationStatusModel | None:
        """Update notification status with validation"""
        # Get current status
        stmt = select(NotificationStatusModel).where(
            NotificationStatusModel.notification_id == notification_id
        )
        result = await self.db.execute(stmt)
        current_record = result.scalar_one_or_none()

        if not current_record:
            log.warning("status_not_found", notification_id=str(notification_id))
            return None

        previous_status = NotificationStatus(current_record.status)

        # Validate transition
        if not self._is_valid_transition(previous_status, new_status):
            raise ValueError(
                f"Invalid status transition: {previous_status.value} -> {new_status.value}"
            )

        # Update status
        now = datetime.now(UTC)

        current_record.status = new_status.value
        current_record.updated_at = now

        if error_message:
            current_record.error_message = error_message

        if new_status == NotificationStatus.PROCESSING:
            current_record.retry_count += 1

        # Add history record
        history_record = StatusHistoryModel(
            notification_id=notification_id,
            previous_status=previous_status.value,
            new_status=new_status.value,
            changed_at=now,
            changed_by=changed_by,
            error_message=error_message,
            metadata=metadata,
        )

        self.db.add(history_record)

        await self.db.commit()
        await self.db.refresh(current_record)

        log.info(
            "status_updated",
            notification_id=str(notification_id),
            previous_status=previous_status.value,
            new_status=new_status.value,
            changed_by=changed_by,
        )

        return current_record

    def _is_valid_transition(self, current: NotificationStatus, new: NotificationStatus) -> bool:
        """Validate status transition"""
        # Terminal states cannot transition
        if current in [NotificationStatus.DELIVERED, NotificationStatus.FAILED]:
            return False

        # Valid transitions
        valid_transitions = {
            NotificationStatus.PENDING: [NotificationStatus.PROCESSING],
            NotificationStatus.PROCESSING: [
                NotificationStatus.DELIVERED,
                NotificationStatus.FAILED,
                NotificationStatus.PROCESSING,  # Retry
            ],
        }

        return new in valid_transitions.get(current, [])

    async def get_status(self, notification_id: UUID) -> NotificationStatusModel | None:
        """Get current status for notification"""
        stmt = select(NotificationStatusModel).where(
            NotificationStatusModel.notification_id == notification_id
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()
