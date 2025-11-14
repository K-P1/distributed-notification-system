"""User Service client with circuit breaker"""

import time
from typing import Any

import httpx
import structlog
from circuitbreaker import circuit
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from app.config import Settings
from app.metrics import service_call_duration_seconds, service_call_errors_total

log = structlog.get_logger()


class UserServiceClient:
    """Client for User Service with circuit breaker and retry"""

    def __init__(self, settings: Settings):
        self.settings = settings
        self.base_url = settings.user_service_url
        self.base_url = self.base_url.strip()
        self.timeout = settings.user_service_timeout

    @circuit(
        failure_threshold=5,
        recovery_timeout=30,
        expected_exception=(httpx.HTTPStatusError, httpx.TimeoutException),
    )
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=0.5, min=0.5, max=10),
        retry=retry_if_exception_type((httpx.TimeoutException, httpx.ConnectError)),
    )
    async def get_user(self, user_id: str, correlation_id: str) -> dict[str, Any]:
        """
        Get user by ID with circuit breaker and retry.

        Args:
            user_id: User UUID
            correlation_id: Request correlation ID

        Returns:
            User data dict

        Raises:
            httpx.HTTPStatusError: On 4xx/5xx responses
            httpx.TimeoutException: On timeout
        """
        log.info("user_service_request", user_id=user_id, correlation_id=correlation_id, url=self.base_url)

        # Start timing
        start_time = time.perf_counter()

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/user/{user_id}",
                    timeout=self.timeout,
                    headers={"X-Correlation-ID": correlation_id},
                )

                response.raise_for_status()

                user_data = response.json()

                # Record success metrics
                duration = time.perf_counter() - start_time
                service_call_duration_seconds.labels(
                    service_name="user_service", operation="get_user"
                ).observe(duration)

                log.info("user_service_success", user_id=user_id, correlation_id=correlation_id)

                return user_data

        except Exception as e:
            # Log error details
            log.error(
                "user_service_failed",
                user_id=user_id,
                correlation_id=correlation_id,
                url=self.base_url,
                error=str(e),
                exc_info=True,
            )
            # Record error metrics
            service_call_errors_total.labels(
                service_name="user_service",
                operation="get_user",
                error_type=type(e).__name__,
            ).inc()
            raise
