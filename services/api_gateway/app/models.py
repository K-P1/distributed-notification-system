"""Database models for API Gateway"""

from datetime import datetime
from enum import Enum
from uuid import UUID

from sqlalchemy import JSON, TIMESTAMP, CheckConstraint, Integer, String, Text, TypeDecorator
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy.sql import func


# UUID type that works with both PostgreSQL and SQLite
class GUID(TypeDecorator):
    """Platform-independent GUID type that uses PostgreSQL UUID or SQLite String"""

    impl = String(36)
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            return dialect.type_descriptor(PGUUID(as_uuid=True))
        else:
            return dialect.type_descriptor(String(36))

    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        elif dialect.name == "postgresql":
            return str(value) if isinstance(value, UUID) else value
        else:
            return str(value) if isinstance(value, UUID) else value

    def process_result_value(self, value, dialect):
        if value is None:
            return value
        else:
            if not isinstance(value, UUID):
                value = UUID(value)
            return value


# JSON type that works with both PostgreSQL and SQLite
class JSONBType(TypeDecorator):
    """Platform-independent JSON type that uses PostgreSQL JSONB or generic JSON"""

    impl = JSON
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            return dialect.type_descriptor(JSONB())
        else:
            return dialect.type_descriptor(JSON())


class Base(DeclarativeBase):
    """Base class for all models"""

    pass


class NotificationStatusEnum(str, Enum):
    """Notification status values"""

    PENDING = "pending"
    PROCESSING = "processing"
    DELIVERED = "delivered"
    FAILED = "failed"


class NotificationStatusModel(Base):
    """Notification status table"""

    __tablename__ = "notification_status"

    notification_id: Mapped[UUID] = mapped_column(GUID, primary_key=True)
    request_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    user_id: Mapped[UUID] = mapped_column(GUID, nullable=False, index=True)
    notification_type: Mapped[str] = mapped_column(String(10), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    retry_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now(), index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    __table_args__ = (
        CheckConstraint("notification_type IN ('email', 'push')", name="check_notification_type"),
        CheckConstraint(
            "status IN ('pending', 'processing', 'delivered', 'failed')",
            name="check_status",
        ),
    )


class StatusHistoryModel(Base):
    """Status change history table"""

    __tablename__ = "notification_status_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    notification_id: Mapped[UUID] = mapped_column(GUID, nullable=False, index=True)
    previous_status: Mapped[str | None] = mapped_column(String(20), nullable=True)
    new_status: Mapped[str] = mapped_column(String(20), nullable=False)
    changed_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now(), index=True
    )
    changed_by: Mapped[str] = mapped_column(String(100), nullable=False)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    change_metadata: Mapped[dict | None] = mapped_column(JSONBType, nullable=True)
