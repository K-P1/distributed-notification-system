"""Test metrics collection"""

import pytest
from prometheus_client import REGISTRY

from app.metrics import (
    cache_operations_total,
    http_requests_total,
    notification_requests_total,
    queue_messages_published_total,
)


def test_metrics_registered():
    """Test that all metrics are registered in Prometheus registry"""
    # Get all registered metric names from the registry
    metric_names = []
    for collector in REGISTRY._collector_to_names.keys():
        # Some collectors (like GCCollector) don't have _name attribute
        if hasattr(collector, "_name"):
            metric_names.append(collector._name)
        # For other collectors, try to get descriptive names
        elif hasattr(collector, "describe"):
            for desc in collector.describe():
                metric_names.append(desc.name)

    # Note: Prometheus client removes _total suffix from Counter names
    assert "http_requests" in metric_names
    assert "notification_requests" in metric_names
    assert "queue_messages_published" in metric_names
    assert "cache_operations" in metric_names


def test_counter_increment():
    """Test counter metrics can be incremented"""
    initial = http_requests_total.labels(
        method="GET", endpoint="/test", status_code="200"
    )._value.get()

    http_requests_total.labels(method="GET", endpoint="/test", status_code="200").inc()

    final = http_requests_total.labels(
        method="GET", endpoint="/test", status_code="200"
    )._value.get()

    assert final > initial


def test_notification_metrics():
    """Test notification metrics can be tracked"""
    notification_requests_total.labels(notification_type="email").inc()
    notification_requests_total.labels(notification_type="push").inc()

    # Metrics should be tracked without errors
    assert True


def test_queue_metrics():
    """Test queue metrics can be tracked"""
    queue_messages_published_total.labels(queue_name="email.queue").inc()

    # Metrics should be tracked without errors
    assert True


def test_cache_metrics():
    """Test cache metrics can be tracked"""
    cache_operations_total.labels(
        cache_type="idempotency", operation="get", result="hit"
    ).inc()
    cache_operations_total.labels(
        cache_type="idempotency", operation="get", result="miss"
    ).inc()

    # Metrics should be tracked without errors
    assert True
