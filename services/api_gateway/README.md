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
- **Metrics**: Prometheus-compatible metrics (port 9090)

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
DATABASE_URL=postgresql+asyncpg://gateway_user:gatewaypassword@localhost:5432/gateway_db

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

### API Documentation

Interactive API docs available at:

- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## 🧪 Testing

### Run All Tests

```bash
pytest
```

### Run with Coverage

```bash
pytest --cov=app --cov-report=html
open htmlcov/index.html  # View coverage report
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

Metrics exposed on port 9090:

- Request counts
- Response times
- Error rates
- Queue depths

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
│   │   └── health.py
│   └── middleware/          # Middleware
│       ├── correlation.py
│       └── logging.py
├── tests/                   # Unit tests
├── alembic/                 # Database migrations
├── docs/                    # Documentation
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

**Version**: 1.0.0  
**Last Updated**: November 10, 2025
