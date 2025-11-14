"""Health check endpoint."""

from datetime import datetime

from fastapi import APIRouter
from sqlalchemy import text

from app.database import engine
from app.schemas import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """
    Health check endpoint.

    Checks:
    - Service is running
    - Database connectivity
    """
    dependencies = {}

    # Check PostgreSQL
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        dependencies["postgres"] = "healthy"
    except Exception as e:
        dependencies["postgres"] = f"unhealthy: {str(e)}"

    # Determine overall status
    all_healthy = all(status == "healthy" for status in dependencies.values())
    overall_status = "healthy" if all_healthy else "unhealthy"

    return HealthResponse(
        status=overall_status,
        timestamp=datetime.utcnow(),
        dependencies=dependencies,
    )
