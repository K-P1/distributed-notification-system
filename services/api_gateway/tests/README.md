# Tests — api_gateway
## Overview

This directory contains unit tests for the API Gateway service. Tests are written with pytest and use asyncio-compatible fixtures where needed. External services (Redis, user service, template service) are mocked or faked in tests so the suite runs deterministically and quickly on a developer machine and in CI.

## File structure

```
tests/
├─ conftest.py          # shared fixtures (app, db, fake redis, dependency overrides)
├─ test_clients.py      # tests for client wrappers (Redis cache, user/template service clients)
├─ test_enrichment.py   # tests for enrichment service logic
├─ test_routers.py      # tests for FastAPI routes / HTTP handlers
└─ README.md            # this file
```

## How to run the tests

From the project root (the repository root that contains `run_checks.bat` and the `app/` package) run the test runner in Powershell:

```powershell
# run all tests (verbose)
pytest -v

# run a single test file
pytest -q tests/test_routers.py

# run a single test function inside a file
pytest tests/test_clients.py::test_some_function
```

Notes:

- The suite is fast and designed to run without external services.
- Use `-k` to filter tests by keyword, and `-x` to stop on first failure.

## What each test file does

- `conftest.py`

  - Provides shared fixtures used by other tests: a FastAPI test app instance, an in-memory SQLite test database session provider, and a fake Redis client (fakeredis) where applicable. It also contains dependency overrides for external services (user_service, template_service) so tests don't make network calls.

- `test_clients.py`

  - Covers the behavior of client wrappers used by the gateway (for example, Redis-backed caches and client adapters for template/user services).

- `test_enrichment.py`

  - Tests the enrichment logic used to prepare notification payloads (merging templates, fetching user data, and applying enrichment rules). These are pure unit tests using small fixtures and mocks for external calls.

- `test_routers.py`
  - Tests the FastAPI route handlers (HTTP endpoints) with the app's dependency overrides applied. These tests exercise request/response shapes, status codes, and high-level integration of services inside the app without calling external services.

## Quick troubleshooting

- If tests fail due to database type/compile errors, ensure you are running the test suite against the in-memory SQLite environment (the default). The codebase contains SQLAlchemy TypeDecorator helpers to support both PostgreSQL and SQLite.
- If a test complains about missing external services, check `tests/conftest.py` — dependency overrides are installed there and should make the suite independent from the network.
