"""FastAPI dependencies"""

from collections.abc import AsyncGenerator

from fastapi import Depends, Header, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.clients.redis_client import RateLimiter, StatusCache
from app.clients.user_service import UserServiceClient
from app.database import DatabaseManager
from app.repositories import StatusRepository
from app.services.enrichment import EnrichmentService
from app.services.notification import NotificationService
from app.services.status import StatusService
from app.metrics import rate_limit_checks_total, rate_limit_exceeded_total


async def get_db_session(request: Request) -> AsyncGenerator[AsyncSession, None]:
    """Get database session"""
    db_manager: DatabaseManager = request.app.state.db
    async for session in db_manager.get_session():
        yield session


def get_correlation_id(request: Request) -> str:
    """Get correlation ID from request"""
    return getattr(request.state, "correlation_id", "unknown")


async def verify_api_key(x_api_key: str = Header(..., alias="X-API-Key")) -> str:
    """Verify API key (basic implementation)"""
    # In production, verify against database/cache
    if not x_api_key or not x_api_key.startswith("apk_"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API key")
    return x_api_key


async def check_rate_limit(request: Request, api_key: str = Depends(verify_api_key)) -> None:
    """Check rate limit for request"""
    rate_limiter: RateLimiter = request.app.state.rate_limiter

    # Use API key as identifier
    is_allowed, remaining = await rate_limiter.check_limit(api_key, limit=100)

    # Track rate limit check
    rate_limit_checks_total.labels(result="allowed" if is_allowed else "denied").inc()

    if not is_allowed:
        # Track rate limit exceeded
        rate_limit_exceeded_total.labels(api_key_prefix=api_key[:8]).inc()

        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded",
            headers={"Retry-After": "60"},
        )

    # Add rate limit headers to response
    request.state.rate_limit_remaining = remaining


def get_status_service(
    request: Request, db: AsyncSession = Depends(get_db_session)
) -> StatusService:
    """Get status service instance"""
    status_cache: StatusCache = request.app.state.status_cache
    repository = StatusRepository(db)
    return StatusService(repository, status_cache)


def get_enrichment_service(request: Request) -> EnrichmentService:
    """Get enrichment service instance"""
    return EnrichmentService(
        request.app.state.user_service,
        request.app.state.template_service,
        request.app.state.service_cache,
    )


def get_user_service(request: Request) -> UserServiceClient:
    """Get user service client instance"""
    return request.app.state.user_service


def get_notification_service(
    request: Request,
    enrichment: EnrichmentService = Depends(get_enrichment_service),
    status: StatusService = Depends(get_status_service),
) -> NotificationService:
    """Get notification service instance"""
    return NotificationService(
        enrichment,
        status,
        request.app.state.rabbitmq,
        request.app.state.idempotency_cache,
    )
