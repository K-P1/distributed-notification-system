"""Pydantic schemas for Template Service."""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class TemplateCreate(BaseModel):
    """Schema for creating a new template."""

    code: str = Field(..., min_length=1, max_length=255, description="Unique template code")
    language: str = Field(default="en", max_length=10, description="Language code (e.g., en, es)")
    subject: str = Field(..., min_length=1, max_length=500, description="Email subject line")
    body_html: str = Field(..., min_length=1, description="HTML body with Jinja2 variables")
    body_text: str = Field(..., min_length=1, description="Plain text body with Jinja2 variables")


class TemplateUpdate(BaseModel):
    """Schema for updating a template."""

    subject: str | None = Field(None, min_length=1, max_length=500)
    body_html: str | None = Field(None, min_length=1)
    body_text: str | None = Field(None, min_length=1)
    is_active: bool | None = None


class TemplateResponse(BaseModel):
    """Schema for template response."""

    id: uuid.UUID
    code: str
    language: str
    subject: str
    body_html: str
    body_text: str
    version: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TemplateBasicInfo(BaseModel):
    """Basic template info for external services (like API Gateway)."""

    code: str
    language: str
    subject: str
    body_html: str
    body_text: str
    version: int


class TemplateRenderRequest(BaseModel):
    """Schema for template rendering request."""

    variables: dict[str, str | int | float | bool] = Field(
        default_factory=dict, description="Variables to substitute in template"
    )


class TemplateRenderResponse(BaseModel):
    """Schema for template rendering response."""

    code: str
    language: str
    subject: str
    body_html: str
    body_text: str
    variables_used: list[str]


class ApiResponse(BaseModel):
    """Standard API response wrapper."""

    success: bool
    data: dict | TemplateResponse | TemplateRenderResponse | list | None = None
    error: str | None = None
    message: str


class HealthResponse(BaseModel):
    """Health check response."""

    status: str
    timestamp: datetime
    dependencies: dict[str, str]
