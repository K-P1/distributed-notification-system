"""
Middleware for automatic Prometheus metrics collection.

Instruments HTTP requests with timing and counting metrics.
"""

import time
from typing import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from app.metrics import (
    http_request_duration_seconds,
    http_requests_in_progress,
    http_requests_total,
)


class MetricsMiddleware(BaseHTTPMiddleware):
    """
    Middleware to collect HTTP request metrics automatically.

    Tracks:
    - Request count by method, endpoint, status
    - Request duration by method, endpoint
    - Concurrent requests in progress
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """
        Process request and collect metrics.

        Args:
            request: Incoming HTTP request
            call_next: Next middleware/handler in chain

        Returns:
            Response from downstream handlers
        """
        # Extract method and path
        method = request.method
        path = request.url.path

        # Skip metrics endpoint itself to avoid recursion
        if path == "/metrics":
            return await call_next(request)

        # Normalize path to avoid high cardinality
        # Replace UUIDs and IDs with placeholders
        endpoint = self._normalize_path(path)

        # Track concurrent requests
        http_requests_in_progress.labels(method=method, endpoint=endpoint).inc()

        # Start timer
        start_time = time.perf_counter()

        try:
            # Process request
            response = await call_next(request)
            status_code = response.status_code

        except Exception as e:
            # Record error
            status_code = 500
            http_requests_total.labels(
                method=method, endpoint=endpoint, status_code=status_code
            ).inc()
            raise

        finally:
            # Stop timer and record duration
            duration = time.perf_counter() - start_time
            http_request_duration_seconds.labels(method=method, endpoint=endpoint).observe(
                duration
            )

            # Decrement in-progress counter
            http_requests_in_progress.labels(method=method, endpoint=endpoint).dec()

        # Record request
        http_requests_total.labels(
            method=method, endpoint=endpoint, status_code=status_code
        ).inc()

        return response

    def _normalize_path(self, path: str) -> str:
        """
        Normalize URL path to reduce cardinality.

        Replaces UUIDs and numeric IDs with placeholders.

        Args:
            path: Original request path

        Returns:
            Normalized path with placeholders
        """
        import re

        # Replace UUIDs with {id}
        path = re.sub(
            r"/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}",
            "/{id}",
            path,
            flags=re.IGNORECASE,
        )

        # Replace numeric IDs with {id}
        path = re.sub(r"/\d+", "/{id}", path)

        return path
