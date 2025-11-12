# API Gateway Service

[![Python 3.12+](https://img.shields.io/badge/python-3.12+-blue.svg)](https://www.python.org/downloads/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.109-green.svg)](https://fastapi.tiangolo.com/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

The API Gateway is the entry point for the Distributed Notification System. It handles notification submission, enrichment, routing, and status tracking.

## 📋 Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the Service](#running-the-service)
- [API Endpoints](#api-endpoints)
- [Testing](#testing)
- [Database Migrations](#database-migrations)
- [Monitoring](#monitoring)
- [Troubleshooting](#troubleshooting)

## ✨ Features

### Core Functionality

- **Notification Submission**: Accept and queue email/push notifications
- **Enrichment**: Fetch user and template data from downstream services
- **Message Routing**: Route notifications to type-specific queues (email/push)
- **Status Tracking**: Track notification lifecycle (pending → processing → delivered/failed)

### Reliability & Performance

- **Idempotency**: Prevent duplicate submissions (24h TTL)
- **Rate Limiting**: Per-API-key request throttling (100 req/min default)
- **Circuit Breakers**: Auto-failover for User/Template services
- **Retry Logic**: Exponential backoff for transient failures (3 attempts)
- **Caching**: Redis-backed caching for user/template data (5min TTL)

### Observability

- **Structured Logging**: JSON logs with correlation IDs
- **Health Checks**: Real-time dependency status monitoring
- **Prometheus Metrics**: 33+ metrics covering HTTP requests, notifications, queues, caching, and service calls

## 🏗️ Architecture

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │ HTTP POST /notifications/
       ↓
┌─────────────────────────────────────────┐
│           API Gateway                    │
│  ┌────────────┐  ┌──────────────────┐  │
│  │  FastAPI   │→ │  Enrichment      │  │
│  │  Router    │  │  (User+Template) │  │
│  └────────────┘  └──────────────────┘  │
│         │                 │              │
│         ↓                 ↓              │
│  ┌────────────┐  ┌──────────────────┐  │
│  │  RabbitMQ  │  │  Status Service  │  │
│  │  Publisher │  │  (PostgreSQL)    │  │
│  └────────────┘  └──────────────────┘  │
└─────────────────────────────────────────┘
       │                   │
       ↓                   ↓
  [email.queue]      [PostgreSQL]
  [push.queue]       [Redis Cache]
```

### Key Components

| Component              | Purpose                   | Technology                  |
| ---------------------- | ------------------------- | --------------------------- |
| **FastAPI App**        | HTTP API server           | FastAPI 0.109               |
| **Enrichment Service** | Fetch user/template data  | httpx, asyncio.gather       |
| **Status Service**     | Track notification status | SQLAlchemy 2.0 + PostgreSQL |
| **RabbitMQ Client**    | Message publishing        | aio-pika                    |
| **Redis Manager**      | Caching & rate limiting   | redis[hiredis]              |
| **Circuit Breakers**   | Fault tolerance           | circuitbreaker              |
| **Metrics Collector**  | Performance monitoring    | prometheus-client           |

## 📦 Prerequisites

- Python 3.12+
- PostgreSQL 15+
- Redis 7+
- RabbitMQ 3.13+
- Docker & Docker Compose (for local development)

## 🚀 Installation

### 1. Clone Repository

```bash
git clone <repository_url>
cd distributed-notification-system/services/api_gateway
```

### 2. Install Dependencies

Using `uv` (recommended):

```bash
uv sync
```

### 3. Set Up Environment

```bash
cp .env.example .env
# Edit .env with your configuration
```

### 4. Start Infrastructure

```bash
cd ../../infra
docker-compose up -d postgres redis rabbitmq
```

### 5. Run Database Migrations

```bash
cd ../services/api_gateway
uv run alembic upgrade head
```

## ⚙️ Configuration

All configuration is done via environment variables. See `.env.example` for full list.

### Essential Variables

```bash
# Application
APP_NAME=api-gateway
ENVIRONMENT=development  # development, production
LOG_LEVEL=INFO          # DEBUG, INFO, WARN, ERROR

# Database
DATABASE_URL=postgresql+asyncpg://gateway_user:gatewaypassword@localhost:5433/gateway_db

# Redis
REDIS_URL=redis://:redispassword@localhost:6379/0

# RabbitMQ
RABBITMQ_URL=amqp://admin:secretpassword@localhost:5672/

# Services
USER_SERVICE_URL=http://localhost:8001
TEMPLATE_SERVICE_URL=http://localhost:8002

# Security
JWT_SECRET_KEY=your-secret-key-change-in-production
```

### Cache TTL Configuration

```bash
IDEMPOTENCY_TTL=86400        # 24 hours
STATUS_CACHE_TTL=3600        # 1 hour
SERVICE_CACHE_TTL=300        # 5 minutes
```

### Rate Limiting

```bash
RATE_LIMIT_DEFAULT=100       # requests per window
RATE_LIMIT_WINDOW=60         # seconds
```

## 🏃 Running the Service

### Development Mode

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Production Mode

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

### Using Docker

```bash
cd ../../infra
docker-compose up api-gateway
```

## 📡 API Endpoints

### Submit Notification

```http
POST /notifications/
Content-Type: application/json
X-API-Key: your-api-key
X-Correlation-ID: optional-correlation-id

{
  "notification_type": "email",
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "template_code": "welcome_email",
  "variables": {
    "name": "John Doe",
    "link": "https://example.com"
  },
  "request_id": "req-123e4567-e89b-12d3-a456-426614174000",
  "priority": 1
}
```

**Response (202 Accepted)**:

```json
{
  "success": true,
  "data": {
    "notification_id": "notif-789e4567-e89b-12d3-a456-426614174111",
    "status": "pending",
    "request_id": "req-123e4567-e89b-12d3-a456-426614174000",
    "created_at": "2025-11-10T14:30:00.123Z"
  },
  "error": null,
  "message": "Notification queued successfully"
}
```

### Get Notification Status

```http
GET /notifications/{notification_id}/status
X-API-Key: your-api-key
```

**Response (200 OK)**:

```json
{
  "success": true,
  "data": {
    "notification_id": "notif-789e4567-e89b-12d3-a456-426614174111",
    "status": "delivered",
    "created_at": "2025-11-10T14:30:00.123Z",
    "updated_at": "2025-11-10T14:30:05.456Z"
  },
  "error": null
}
```

### Health Check

```http
GET /health
```

**Response (200 OK / 503 Service Unavailable)**:

```json
{
  "status": "healthy",
  "timestamp": "2025-11-10T14:30:00.123Z",
  "dependencies": {
    "rabbitmq": "healthy",
    "postgres": "healthy",
    "redis": "healthy"
  }
}
```

### Prometheus Metrics Endpoint

```http
GET /metrics
```

Returns Prometheus-formatted metrics for scraping.

### API Documentation

Interactive API docs available at:

- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`
- Metrics: `http://localhost:8000/metrics`

## 🧪 Testing

### Run All Tests

```bash
pytest -v
```

**Test Suite**: 22 tests covering clients, enrichment, metrics, and routers

### Run with Coverage

```bash
pytest --cov=app --cov-report=html
open htmlcov/index.html  # View coverage report
```

### Required Test Dependencies

```bash
uv pip install fakeredis aiosqlite  # Already in dev dependencies
```

### Run Specific Test File

```bash
pytest tests/test_enrichment.py
```

### Run Tests by Marker

```bash
pytest -m unit         # Only unit tests
pytest -m integration  # Only integration tests
```

### Code Quality Checks

```bash
./run_checks.bat  # Windows
# or
./run_checks.sh   # Linux/Mac
```

This runs:

1. Ruff (linting + formatting)
2. Mypy (type checking)

## 🗄️ Database Migrations

### Create Migration

```bash
uv run alembic revision --autogenerate -m "Description"
```

### Apply Migrations

```bash
uv run alembic upgrade head
```

### Rollback Migration

```bash
uv run alembic downgrade -1
```

### View Migration History

```bash
uv run alembic history
```

## 📊 Monitoring

### Structured Logs

All logs are output as JSON to STDOUT:

```json
{
  "timestamp": "2025-11-10T14:30:00.123Z",
  "level": "info",
  "service": "api-gateway",
  "correlation_id": "corr-123e4567-e89b-12d3-a456-426614174000",
  "message": "notification_submitted",
  "notification_id": "notif-789e4567",
  "request_id": "req-123e4567",
  "duration_ms": 45.2
}
```

### Prometheus Metrics

Metrics are exposed at `http://localhost:8000/metrics` in Prometheus format.

**Available Metrics** (33 total):

**HTTP Metrics**:
- `http_requests_total` - Total requests by method, endpoint, status
- `http_request_duration_seconds` - Request latency histogram
- `http_requests_in_progress` - Active requests

**Notification Metrics**:
- `notification_requests_total` - Notifications by type (email/push)
- `notification_errors_total` - Errors by type and reason
- `notification_processing_duration_seconds` - Processing time
- `notification_status_updates_total` - Status updates

**Queue Metrics**:
- `queue_messages_published_total` - Messages published by queue
- `queue_publish_duration_seconds` - Publish latency
- `queue_publish_errors_total` - Publish failures

**Service Call Metrics**:
- `service_call_duration_seconds` - External service latency
- `service_call_errors_total` - Service call failures
- `service_circuit_breaker_state` - Circuit breaker states

**Cache Metrics**:
- `cache_operations_total` - Cache ops by type/result (hit/miss)
- `cache_hit_ratio` - Hit rate gauge

**Rate Limiting**:
- `rate_limit_checks_total` - Checks by result
- `rate_limit_exceeded_total` - Violations by API key

**Idempotency**:
- `idempotency_checks_total` - Duplicate detection
- `duplicate_requests_total` - Duplicate requests

**Connection Pools**:
- `database_connections_active` - Active DB connections
- `database_connections_idle` - Idle DB connections
- `redis_connections_active` - Active Redis connections

### Prometheus Configuration

Add to your `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: 'api-gateway'
    static_configs:
      - targets: ['localhost:8000']
    metrics_path: '/metrics'
    scrape_interval: 15s
```

### Sample Queries

```promql
# Request rate
rate(http_requests_total[5m])

# Error rate
rate(http_requests_total{status_code=~"5.."}[5m])

# P95 latency
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Notification rate by type
sum by (notification_type) (rate(notification_requests_total[5m]))

# Cache hit ratio
rate(cache_operations_total{result="hit"}[5m]) / rate(cache_operations_total[5m])
```

### Health Checks

Monitor dependencies:

```bash
curl http://localhost:8000/health
```

## 🐛 Troubleshooting

### Common Issues

#### Database Connection Failed

```
FATAL: password authentication failed for user "gateway_user"
```

**Solution**: Verify DATABASE_URL in `.env` matches Docker Compose configuration.

```bash
docker exec postgres psql -U gateway_user -d gateway_db -c "SELECT 1"
```

#### RabbitMQ Connection Timeout

```
ConnectionError: Failed to connect to RabbitMQ
```

**Solution**: Ensure RabbitMQ is running and accessible.

```bash
docker ps | grep rabbitmq
docker logs rabbitmq
```

#### Redis Connection Refused

```
ConnectionError: Connection refused
```

**Solution**: Check Redis is running.

```bash
docker ps | grep redis
redis-cli -h localhost -p 6379 -a redispassword PING
```

#### Circuit Breaker Open

```
503 Service temporarily unavailable (circuit breaker open)
```

**Solution**: Check User/Template service health. Circuit breaker opens after 5 consecutive failures and recovers after 30s.

### Debug Logging

Enable debug logs:

```bash
LOG_LEVEL=DEBUG uvicorn app.main:app --reload
```

### Performance Issues

1. **Check database connection pool**: Increase `DB_POOL_SIZE` if seeing connection timeouts
2. **Check Redis performance**: Monitor `redis-cli INFO stats`
3. **Check RabbitMQ queue depth**: `rabbitmqctl list_queues`

## 📝 Development

### Project Structure

```
api_gateway/
├── app/
│   ├── main.py              # FastAPI application
│   ├── config.py            # Settings management
│   ├── models.py            # SQLAlchemy models
│   ├── schemas.py           # Pydantic schemas
│   ├── database.py          # Database connection
│   ├── repositories.py      # Data access layer
│   ├── dependencies.py      # FastAPI dependencies
│   ├── metrics.py           # Prometheus metrics definitions
│   ├── clients/             # External service clients
│   │   ├── rabbitmq_client.py
│   │   ├── redis_client.py
│   │   ├── user_service.py
│   │   └── template_service.py
│   ├── services/            # Business logic
│   │   ├── enrichment.py
│   │   ├── notification.py
│   │   └── status.py
│   ├── routers/             # API endpoints
│   │   ├── notifications.py
│   │   ├── status.py
│   │   ├── health.py
│   │   └── metrics.py       # Metrics endpoint
│   └── middleware/          # Middleware
│       ├── correlation.py
│       ├── logging.py
│       └── metrics_middleware.py  # Automatic metrics tracking
├── tests/                   # Unit tests (22 tests, all passing)
│   ├── test_clients.py      # Cache & rate limiting tests
│   ├── test_enrichment.py   # Enrichment service tests
│   ├── test_metrics.py      # Metrics collection tests
│   └── test_routers.py      # API endpoint tests
├── alembic/                 # Database migrations
├── docs/                    # Documentation
│   ├── prometheus_implementation_plan.md
│   ├── prometheus_metrics.md
│   ├── implementation_summary.md
│   ├── metrics_quick_reference.md
│   └── test_fixes_summary.md
├── .env                     # Configuration
├── pyproject.toml           # Dependencies
├── pytest.ini               # Test configuration
└── README.md                # This file
```

### Contributing

1. Create a feature branch
2. Make changes with tests
3. Run `./run_checks.bat` to verify code quality
4. Submit pull request

## 📄 License

MIT License - see LICENSE file for details

## 🔗 Links

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [SQLAlchemy Documentation](https://docs.sqlalchemy.org/)
- [RabbitMQ Documentation](https://www.rabbitmq.com/documentation.html)
- [Redis Documentation](https://redis.io/documentation)

---

**Version**: 1.1.0  
**Last Updated**: November 12, 2025  
**Recent Changes**:
- ✅ Added comprehensive Prometheus metrics (33 metrics)
- ✅ Fixed all test suite issues (22/22 tests passing)
- ✅ Installed test dependencies (fakeredis, aiosqlite)
- ✅ Added metrics middleware for automatic HTTP tracking
