"""
Prometheus metrics definitions and collectors for API Gateway.

This module defines all metrics used to monitor the notification system:
- Request metrics (rate, latency, errors)
- Notification metrics (by type, status)
- Queue operations
- Cache performance
- External service calls
"""

from prometheus_client import Counter, Gauge, Histogram, Info

# ============================================================================
# System Info
# ============================================================================

system_info = Info("api_gateway_info", "API Gateway service information")


# ============================================================================
# HTTP Request Metrics
# ============================================================================

http_requests_total = Counter(
    "http_requests_total",
    "Total number of HTTP requests",
    ["method", "endpoint", "status_code"],
)

http_request_duration_seconds = Histogram(
    "http_request_duration_seconds",
    "HTTP request latency in seconds",
    ["method", "endpoint"],
    buckets=(0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0),
)

http_requests_in_progress = Gauge(
    "http_requests_in_progress",
    "Number of HTTP requests currently being processed",
    ["method", "endpoint"],
)


# ============================================================================
# Notification Metrics
# ============================================================================

notification_requests_total = Counter(
    "notification_requests_total",
    "Total number of notification requests submitted",
    ["notification_type"],
)

notification_errors_total = Counter(
    "notification_errors_total",
    "Total number of notification processing errors",
    ["notification_type", "error_type"],
)

notification_processing_duration_seconds = Histogram(
    "notification_processing_duration_seconds",
    "Time to process notification submission",
    ["notification_type"],
    buckets=(0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0),
)

notification_status_updates_total = Counter(
    "notification_status_updates_total",
    "Total number of status updates received",
    ["notification_type", "status"],
)


# ============================================================================
# Queue Metrics
# ============================================================================

queue_messages_published_total = Counter(
    "queue_messages_published_total",
    "Total number of messages published to queues",
    ["queue_name"],
)

queue_publish_duration_seconds = Histogram(
    "queue_publish_duration_seconds",
    "Time to publish message to queue",
    ["queue_name"],
    buckets=(0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5),
)

queue_publish_errors_total = Counter(
    "queue_publish_errors_total",
    "Total number of queue publish errors",
    ["queue_name", "error_type"],
)


# ============================================================================
# External Service Call Metrics
# ============================================================================

service_call_duration_seconds = Histogram(
    "service_call_duration_seconds",
    "External service call latency",
    ["service_name", "operation"],
    buckets=(0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0),
)

service_call_errors_total = Counter(
    "service_call_errors_total",
    "External service call errors",
    ["service_name", "operation", "error_type"],
)

service_circuit_breaker_state = Gauge(
    "service_circuit_breaker_state",
    "Circuit breaker state (0=closed, 1=open, 2=half-open)",
    ["service_name"],
)


# ============================================================================
# Cache Metrics
# ============================================================================

cache_operations_total = Counter(
    "cache_operations_total",
    "Total cache operations",
    ["cache_type", "operation", "result"],
)

cache_hit_ratio = Gauge(
    "cache_hit_ratio",
    "Cache hit ratio (0-1)",
    ["cache_type"],
)


# ============================================================================
# Rate Limiting Metrics
# ============================================================================

rate_limit_checks_total = Counter(
    "rate_limit_checks_total",
    "Total rate limit checks",
    ["result"],
)

rate_limit_exceeded_total = Counter(
    "rate_limit_exceeded_total",
    "Total rate limit violations",
    ["api_key_prefix"],
)


# ============================================================================
# Connection Pool Metrics
# ============================================================================

database_connections_active = Gauge(
    "database_connections_active",
    "Number of active database connections",
)

database_connections_idle = Gauge(
    "database_connections_idle",
    "Number of idle database connections",
)

redis_connections_active = Gauge(
    "redis_connections_active",
    "Number of active Redis connections",
)


# ============================================================================
# Idempotency Metrics
# ============================================================================

idempotency_checks_total = Counter(
    "idempotency_checks_total",
    "Total idempotency checks",
    ["result"],
)

duplicate_requests_total = Counter(
    "duplicate_requests_total",
    "Total duplicate requests detected",
    ["notification_type"],
)


# ============================================================================
# Helper Functions
# ============================================================================


def initialize_metrics(app_version: str, environment: str) -> None:
    """
    Initialize system info metrics.

    Args:
        app_version: Application version
        environment: Deployment environment (dev/staging/prod)
    """
    system_info.info(
        {
            "version": app_version,
            "environment": environment,
            "service": "api-gateway",
        }
    )
