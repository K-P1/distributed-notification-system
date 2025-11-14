"""Pydantic schemas for request/response validation"""

from datetime import datetime
from enum import Enum
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class NotificationType(str, Enum):
    """Notification type enum"""

    EMAIL = "email"
    PUSH = "push"


class NotificationStatus(str, Enum):
    """Notification status enum"""

    PENDING = "pending"
    PROCESSING = "processing"
    DELIVERED = "delivered"
    FAILED = "failed"


class NotificationRequest(BaseModel):
    """Notification submission request"""

    notification_type: NotificationType
    user_id: UUID
    template_code: str = Field(..., min_length=1, max_length=100, pattern=r"^[a-z0-9_-]+$")
    variables: dict[str, Any] = Field(default_factory=dict)
    priority: int = Field(default=5, ge=1, le=10)
    request_id: str | None = Field(None, min_length=1, max_length=100)
    push_token: str | None = Field(None, min_length=1, max_length=500)

    @field_validator("template_code")
    @classmethod
    def validate_template_code(cls, v: str) -> str:
        """Validate template code format"""
        if not v.replace("-", "").replace("_", "").isalnum():
            raise ValueError("template_code must contain only alphanumeric, dash, and underscore")
        return v

    @field_validator("push_token")
    @classmethod
    def validate_push_token(cls, v: str | None, info) -> str | None:
        """Validate push token is provided for push notifications"""
        if info.data.get("notification_type") == NotificationType.PUSH and not v:
            raise ValueError("push_token is required for push notifications")
        return v


class NotificationResponse(BaseModel):
    """Notification submission response data"""

    notification_id: UUID
    status: NotificationStatus
    request_id: str
    created_at: datetime


class StatusUpdateRequest(BaseModel):
    """Status update request from workers"""

    new_status: NotificationStatus
    error_message: str | None = Field(None, max_length=1000)
    changed_by: str = Field(..., min_length=1, max_length=100)
    metadata: dict[str, Any] | None = None


class NotificationStatusRecord(BaseModel):
    """Current notification status"""

    model_config = ConfigDict(from_attributes=True)

    notification_id: UUID
    request_id: str
    user_id: UUID
    notification_type: str
    status: NotificationStatus
    error_message: str | None = None
    retry_count: int = 0
    created_at: datetime
    updated_at: datetime


class StatusHistoryRecord(BaseModel):
    """Historical status change"""

    model_config = ConfigDict(from_attributes=True)

    id: int
    notification_id: UUID
    previous_status: NotificationStatus | None = None
    new_status: NotificationStatus
    changed_at: datetime
    changed_by: str
    error_message: str | None = None
    metadata: dict[str, Any] | None = None


class ErrorDetail(BaseModel):
    """Error detail structure"""

    code: str
    message: str
    details: dict[str, Any] | None = None


class StandardResponse(BaseModel):
    """Standard API response wrapper"""

    success: bool
    data: Any | None = None
    error: ErrorDetail | None = None
    message: str | None = None
    meta: dict[str, Any] | None = None


class HealthCheckResponse(BaseModel):
    """Health check response"""

    status: str
    timestamp: datetime
    dependencies: dict[str, str]


class MessageEnvelope(BaseModel):
    """Message envelope for queue"""

    model_config = ConfigDict(from_attributes=True)

    notification_id: UUID
    request_id: str
    user_id: UUID
    notification_type: NotificationType
    template_code: str
    variables: dict[str, Any]
    priority: int
    timestamp: datetime
    user_data: dict[str, Any]
    template_data: dict[str, Any]
    push_token: str | None = None
