"""Template management endpoints."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.renderer import TemplateRenderer
from app.repository import TemplateRepository
from app.schemas import (
    ApiResponse,
    TemplateBasicInfo,
    TemplateCreate,
    TemplateRenderRequest,
    TemplateRenderResponse,
    TemplateResponse,
    TemplateUpdate,
)

router = APIRouter(prefix="/api/v1/templates", tags=["templates"])


@router.post("/", response_model=ApiResponse, status_code=status.HTTP_201_CREATED)
async def create_template(
    template_data: TemplateCreate,
    db: AsyncSession = Depends(get_db),
) -> ApiResponse:
    """
    Create a new template.

    Requires:
    - code: Unique template identifier
    - language: Language code (default: en)
    - subject: Email subject with Jinja2 variables
    - body_html: HTML body with Jinja2 variables
    - body_text: Plain text body with Jinja2 variables
    """
    repo = TemplateRepository(db)

    # Check if template with same code and language already exists
    existing_template = await repo.get_by_code(template_data.code, template_data.language)
    if existing_template:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Template with code '{template_data.code}' and language '{template_data.language}' already exists",
        )

    # Validate template syntax
    renderer = TemplateRenderer()
    for field_name, field_value in [
        ("subject", template_data.subject),
        ("body_html", template_data.body_html),
        ("body_text", template_data.body_text),
    ]:
        is_valid, error_msg = renderer.validate_template(field_value)
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid template syntax in {field_name}: {error_msg}",
            )

    # Create template
    template = await repo.create(template_data)

    return ApiResponse(
        success=True,
        data=TemplateResponse.model_validate(template).model_dump(),
        message="Template created successfully",
    )


@router.get("/{template_id}", response_model=ApiResponse)
async def get_template(
    template_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> ApiResponse:
    """Get template by ID."""
    repo = TemplateRepository(db)
    template = await repo.get_by_id(template_id)

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found",
        )

    return ApiResponse(
        success=True,
        data=TemplateResponse.model_validate(template).model_dump(),
        message="Template retrieved successfully",
    )


@router.get("/code/{code}", response_model=TemplateBasicInfo)
async def get_template_by_code(
    code: str,
    language: str = Query(default="en", description="Language code"),
    db: AsyncSession = Depends(get_db),
) -> TemplateBasicInfo:
    """
    Get template by code and language.

    This endpoint is used by API Gateway for notification enrichment.
    Returns only essential fields needed for notification processing.
    """
    repo = TemplateRepository(db)
    template = await repo.get_by_code(code, language)

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Template with code '{code}' and language '{language}' not found",
        )

    return TemplateBasicInfo(
        code=template.code,
        language=template.language,
        subject=template.subject,
        body_html=template.body_html,
        body_text=template.body_text,
        version=template.version,
    )


@router.post("/code/{code}/render", response_model=TemplateRenderResponse)
async def render_template(
    code: str,
    render_request: TemplateRenderRequest,
    language: str = Query(default="en", description="Language code"),
    db: AsyncSession = Depends(get_db),
) -> TemplateRenderResponse:
    """
    Render a template with provided variables.

    Fetches template by code and language, then renders all parts
    (subject, body_html, body_text) with the provided variables.
    """
    repo = TemplateRepository(db)
    template = await repo.get_by_code(code, language)

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Template with code '{code}' and language '{language}' not found",
        )

    # Render template
    renderer = TemplateRenderer()
    try:
        subject, html, text, vars_used = renderer.render_template_parts(
            template.subject, template.body_html, template.body_text, render_request.variables
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    return TemplateRenderResponse(
        code=template.code,
        language=template.language,
        subject=subject,
        body_html=html,
        body_text=text,
        variables_used=vars_used,
    )


@router.put("/{template_id}", response_model=ApiResponse)
async def update_template(
    template_id: uuid.UUID,
    template_data: TemplateUpdate,
    db: AsyncSession = Depends(get_db),
) -> ApiResponse:
    """
    Update template information.

    Can update:
    - subject: Email subject line
    - body_html: HTML body
    - body_text: Plain text body
    - is_active: Active status

    Version is automatically incremented when content changes.
    """
    # Validate template syntax if provided
    renderer = TemplateRenderer()
    for field_name, field_value in [
        ("subject", template_data.subject),
        ("body_html", template_data.body_html),
        ("body_text", template_data.body_text),
    ]:
        if field_value is not None:
            is_valid, error_msg = renderer.validate_template(field_value)
            if not is_valid:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid template syntax in {field_name}: {error_msg}",
                )

    repo = TemplateRepository(db)
    template = await repo.update(template_id, template_data)

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found",
        )

    return ApiResponse(
        success=True,
        data=TemplateResponse.model_validate(template).model_dump(),
        message="Template updated successfully",
    )


@router.delete("/{template_id}", response_model=ApiResponse)
async def delete_template(
    template_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> ApiResponse:
    """Soft delete a template (marks as inactive)."""
    repo = TemplateRepository(db)
    deleted = await repo.delete(template_id)

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found",
        )

    return ApiResponse(
        success=True,
        message="Template deleted successfully",
    )


@router.get("/", response_model=ApiResponse)
async def list_templates(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=100),
    language: str | None = Query(default=None, description="Filter by language code"),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse:
    """
    List all active templates with pagination.

    Query parameters:
    - skip: Number of records to skip (default: 0)
    - limit: Maximum number of records to return (default: 100, max: 100)
    - language: Optional language filter
    """
    repo = TemplateRepository(db)
    templates = await repo.list_templates(skip=skip, limit=limit, language=language)

    template_responses = [TemplateResponse.model_validate(t).model_dump() for t in templates]

    return ApiResponse(
        success=True,
        data=template_responses,
        message=f"Retrieved {len(templates)} templates",
    )
