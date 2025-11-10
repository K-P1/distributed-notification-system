# API Gateway Tests

Unit tests for the API Gateway service.

## Structure

```
tests/
├── conftest.py           # Pytest fixtures and configuration
├── test_enrichment.py    # Enrichment service tests
├── test_notification.py  # Notification service tests
├── test_status.py        # Status service tests
├── test_routers.py       # Router endpoint tests
├── test_clients.py       # Client tests (RabbitMQ, Redis, HTTP)
└── test_repository.py    # Repository tests
```

## Running Tests

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=app --cov-report=html

# Run specific test file
pytest tests/test_enrichment.py

# Run tests matching pattern
pytest -k "test_enrich"
```

## Test Categories

- **Unit Tests**: Test individual components in isolation with mocks
- **Integration Tests**: Test components working together (marked with `@pytest.mark.integration`)
- **E2E Tests**: Test full workflows (marked with `@pytest.mark.e2e`)
