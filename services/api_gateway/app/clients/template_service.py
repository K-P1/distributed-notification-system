"""Template Service client with circuit breaker"""

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

log = structlog.get_logger()


class TemplateServiceClient:
    """Client for Template Service with circuit breaker and retry"""

    def __init__(self, settings: Settings):
        self.settings = settings
        self.base_url = settings.template_service_url
        self.timeout = settings.template_service_timeout

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
    async def get_template(self, template_code: str, correlation_id: str) -> dict[str, Any]:
        """
        Get template by code with circuit breaker and retry.

        Args:
            template_code: Template code
            correlation_id: Request correlation ID

        Returns:
            Template data dict

        Raises:
            httpx.HTTPStatusError: On 4xx/5xx responses
            httpx.TimeoutException: On timeout
        """
        log.info(
            "template_service_request",
            template_code=template_code,
            correlation_id=correlation_id,
        )

        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/templates/{template_code}",
                timeout=self.timeout,
                headers={"X-Correlation-ID": correlation_id},
            )

            response.raise_for_status()

            template_data = response.json()
            log.info(
                "template_service_success",
                template_code=template_code,
                correlation_id=correlation_id,
            )

            return template_data
