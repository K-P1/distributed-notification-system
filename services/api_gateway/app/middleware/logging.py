"""Logging configuration for structured JSON logging"""

import structlog


def configure_logging(log_level: str = "INFO"):
    """
    Configure structured JSON logging for the application.

    Implements the logging standard from docs/logging_guide.md:
    - JSON output to STDOUT
    - ISO timestamp format
    - Automatic correlation ID inclusion
    - Stack traces for errors

    Args:
        log_level: Logging level (DEBUG, INFO, WARN, ERROR)
    """

    structlog.configure(
        processors=[
            # Merge in context variables (like correlation_id)
            structlog.contextvars.merge_contextvars,
            # Filter logs by level
            structlog.stdlib.filter_by_level,
            # Add logger name
            structlog.stdlib.add_logger_name,
            # Add log level
            structlog.stdlib.add_log_level,
            # Format positional arguments
            structlog.stdlib.PositionalArgumentsFormatter(),
            # Add ISO timestamp
            structlog.processors.TimeStamper(fmt="iso"),
            # Render stack info if available
            structlog.processors.StackInfoRenderer(),
            # Format exception info
            structlog.processors.format_exc_info,
            # Decode unicode
            structlog.processors.UnicodeDecoder(),
            # Render as JSON
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.stdlib.BoundLogger,
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )
