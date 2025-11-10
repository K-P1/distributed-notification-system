"""Health check endpoint"""

from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Request, status
from fastapi.responses import JSONResponse

router = APIRouter(tags=["health"])


@router.get("/health", status_code=status.HTTP_200_OK)
async def health_check(request: Request) -> JSONResponse:
    """
    Check health of all dependencies.

    Returns 200 if all healthy, 503 if any unhealthy.
    """
    health_status: dict[str, Any] = {
        "status": "healthy",
        "timestamp": datetime.now(UTC).isoformat(),
        "dependencies": {},
    }

    # Check RabbitMQ
    try:
        rabbitmq = request.app.state.rabbitmq
        if rabbitmq.connection and not rabbitmq.connection.is_closed:
            health_status["dependencies"]["rabbitmq"] = "healthy"
        else:
            health_status["dependencies"]["rabbitmq"] = "unhealthy"
            health_status["status"] = "unhealthy"
    except Exception as e:
        health_status["dependencies"]["rabbitmq"] = f"error: {str(e)}"
        health_status["status"] = "unhealthy"

    # Check PostgreSQL
    try:
        db = request.app.state.db
        async for session in db.get_session():
            await session.execute("SELECT 1")
            health_status["dependencies"]["postgres"] = "healthy"
            break
    except Exception as e:
        health_status["dependencies"]["postgres"] = f"error: {str(e)}"
        health_status["status"] = "unhealthy"

    # Check Redis
    try:
        redis_manager = request.app.state.redis
        if await redis_manager.ping():
            health_status["dependencies"]["redis"] = "healthy"
        else:
            health_status["dependencies"]["redis"] = "unhealthy"
            health_status["status"] = "unhealthy"
    except Exception as e:
        health_status["dependencies"]["redis"] = f"error: {str(e)}"
        health_status["status"] = "unhealthy"

    # Return appropriate status code
    status_code = (
        status.HTTP_200_OK
        if health_status["status"] == "healthy"
        else status.HTTP_503_SERVICE_UNAVAILABLE
    )

    return JSONResponse(content=health_status, status_code=status_code)
