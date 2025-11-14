"""
API Gateway - Main Application

Entry point for the API Gateway service that handles:
- Notification submission and routing
- Status tracking and updates
- Health checks and monitoring
"""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
import os

import structlog
from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.clients.rabbitmq_client import RabbitMQClient
from app.clients.redis_client import (
    IdempotencyCache,
    RateLimiter,
    RedisManager,
    ServiceCache,
    StatusCache,
)
from app.clients.template_service import TemplateServiceClient
from app.clients.user_service import UserServiceClient
from app.config import get_settings
from app.database import DatabaseManager
from app.middleware.correlation import CorrelationIDMiddleware
from app.middleware.logging import configure_logging
from app.middleware.metrics_middleware import MetricsMiddleware
from app.routers import health, notifications, metrics, users
from app.routers import status as status_router
from app.metrics import initialize_metrics

log = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """
    Manage application lifecycle (startup and shutdown).

    Startup:
        - Configure structured logging
        - Connect to RabbitMQ and set up topology
        - Initialize database connection pool
        - Connect to Redis
        - Initialize service clients (User, Template)

    Shutdown:
        - Close all connections gracefully
    """
    settings = get_settings()

    # Configure structured JSON logging
    configure_logging(settings.log_level)

    # Log application startup
    log.info("app_starting", environment=settings.environment, service="api-gateway")

    # Initialize Prometheus metrics
    initialize_metrics(settings.app_version, settings.environment)
    log.info("metrics_initialized")

    # Initialize RabbitMQ connection and declare exchanges/queues
    rabbitmq = RabbitMQClient(settings)
    await rabbitmq.connect()
    await rabbitmq.setup_topology()
    app.state.rabbitmq = rabbitmq
    log.info("rabbitmq_initialized")

    # Initialize database connection pool
    db_manager = DatabaseManager(settings)
    await db_manager.create_tables()
    app.state.db = db_manager
    log.info("database_initialized")

    # Initialize Redis connection
    redis_manager = RedisManager(settings)
    app.state.redis = redis_manager
    log.info("redis_initialized")

    # Initialize Redis-backed caches
    app.state.idempotency_cache = IdempotencyCache(redis_manager.client, settings.idempotency_ttl)
    app.state.status_cache = StatusCache(redis_manager.client, settings.status_cache_ttl)
    app.state.service_cache = ServiceCache(redis_manager.client, settings.service_cache_ttl)
    app.state.rate_limiter = RateLimiter(redis_manager.client, settings.rate_limit_window)
    log.info("caches_initialized")

    # Initialize HTTP service clients with circuit breakers
    app.state.user_service = UserServiceClient(settings)
    app.state.template_service = TemplateServiceClient(settings)
    log.info("service_clients_initialized")

    log.info("app_started")

    yield

    # Cleanup on shutdown
    log.info("app_stopping")

    await rabbitmq.disconnect()
    await db_manager.close()
    await redis_manager.close()

    log.info("app_stopped")


# Create FastAPI application
app = FastAPI(
    title="API Gateway",
    description="Gateway service for distributed notification system",
    version="1.0.0",
    lifespan=lifespan,
)

# Add middlewares (order matters: last added = first executed)
app.add_middleware(MetricsMiddleware)
app.add_middleware(CorrelationIDMiddleware)

# Include API routers
app.include_router(notifications.router)
app.include_router(status_router.router)
app.include_router(users.router)
app.include_router(health.router)
app.include_router(metrics.router)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    """
    Handle Pydantic validation errors and return structured error response.

    Returns:
        422 JSON response with detailed validation errors
    """
    errors = []
    for error in exc.errors():
        errors.append(
            {
                "field": ".".join(str(x) for x in error["loc"]),
                "message": error["msg"],
                "type": error["type"],
            }
        )

    log.warning("validation_error", path=request.url.path, errors=errors)

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "success": False,
            "data": None,
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Request validation failed",
                "details": {"errors": errors},
            },
            "message": None,
            "meta": None,
        },
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """
    Handle uncaught exceptions and return generic error response.

    Logs full stack trace for debugging.

    Returns:
        500 JSON response with generic error message
    """
    log.error("uncaught_exception", error=str(exc), path=request.url.path, exc_info=True)

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "success": False,
            "data": None,
            "error": {
                "code": "INTERNAL_ERROR",
                "message": "An internal error occurred",
                "details": None,
            },
            "message": None,
            "meta": None,
        },
    )


@app.get("/")
async def root() -> dict:
    """Root endpoint returning service information"""
    return {"service": "api-gateway", "version": "1.0.0", "status": "running"}


if __name__ == "__main__":
    import uvicorn

    settings = get_settings()
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port)
