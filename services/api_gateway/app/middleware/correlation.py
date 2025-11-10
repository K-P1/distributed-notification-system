"""Correlation ID middleware"""

import uuid

import structlog
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

log = structlog.get_logger()


class CorrelationIDMiddleware(BaseHTTPMiddleware):
    """Add correlation ID to all requests"""

    def __init__(self, app, header_name: str = "X-Correlation-ID"):
        super().__init__(app)
        self.header_name = header_name

    async def dispatch(self, request: Request, call_next):
        """Add or extract correlation ID"""
        # Get or generate correlation ID
        correlation_id = request.headers.get(self.header_name)

        if not correlation_id:
            correlation_id = str(uuid.uuid4())

        # Store in request state
        request.state.correlation_id = correlation_id

        # Bind to logger context
        structlog.contextvars.bind_contextvars(correlation_id=correlation_id)

        # Call next middleware/endpoint
        response: Response = await call_next(request)

        # Add to response headers
        response.headers[self.header_name] = correlation_id

        # Clear context
        structlog.contextvars.clear_contextvars()

        return response
