"""Repository layer for database operations."""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Template
from app.schemas import TemplateCreate, TemplateUpdate


class TemplateRepository:
    """Repository for Template operations."""

    def __init__(self, session: AsyncSession):
        """Initialize repository."""
        self.session = session

    async def create(self, template_data: TemplateCreate) -> Template:
        """Create a new template."""
        template = Template(
            code=template_data.code,
            language=template_data.language,
            subject=template_data.subject,
            body_html=template_data.body_html,
            body_text=template_data.body_text,
            version=1,
        )
        self.session.add(template)
        await self.session.flush()
        await self.session.refresh(template)
        return template

    async def get_by_id(self, template_id: uuid.UUID) -> Template | None:
        """Get template by ID."""
        result = await self.session.execute(select(Template).where(Template.id == template_id))
        return result.scalar_one_or_none()

    async def get_by_code(self, code: str, language: str = "en") -> Template | None:
        """Get template by code and language."""
        result = await self.session.execute(
            select(Template)
            .where(Template.code == code)
            .where(Template.language == language)
            .where(Template.is_active == True)  # noqa: E712
        )
        return result.scalar_one_or_none()

    async def update(self, template_id: uuid.UUID, template_data: TemplateUpdate) -> Template | None:
        """Update template information and increment version."""
        template = await self.get_by_id(template_id)
        if not template:
            return None

        # Update fields if provided
        if template_data.subject is not None:
            template.subject = template_data.subject
        if template_data.body_html is not None:
            template.body_html = template_data.body_html
        if template_data.body_text is not None:
            template.body_text = template_data.body_text
        if template_data.is_active is not None:
            template.is_active = template_data.is_active

        # Increment version if content changed
        if (
            template_data.subject is not None
            or template_data.body_html is not None
            or template_data.body_text is not None
        ):
            template.version += 1

        await self.session.flush()
        await self.session.refresh(template)
        return template

    async def delete(self, template_id: uuid.UUID) -> bool:
        """Soft delete a template by marking it inactive."""
        template = await self.get_by_id(template_id)
        if not template:
            return False

        template.is_active = False
        await self.session.flush()
        return True

    async def list_templates(
        self, skip: int = 0, limit: int = 100, language: str | None = None
    ) -> list[Template]:
        """List templates with pagination and optional language filter."""
        query = select(Template).where(Template.is_active == True)  # noqa: E712
        if language:
            query = query.where(Template.language == language)
        query = query.offset(skip).limit(limit)
        result = await self.session.execute(query)
        return list(result.scalars().all())
