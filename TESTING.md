# Testing Guide for Email and Template Services

## Quick Start

### 1. Start Infrastructure Services

```bash
cd infra
docker-compose up -d
```

### 2. Start Application Services

```bash
# From project root
docker-compose -f docker-compose.dev.yml up -d
```

### 3. Run Tests

```bash
# PowerShell (Windows)
.\scripts\test-services.ps1 -All

# Bash (Linux/Mac)
chmod +x scripts/test-services.sh
./scripts/test-services.sh
```

## Manual Testing

### Template Service Endpoints

#### Health Check

```bash
curl http://localhost:3002/health
```

#### Create Template

```bash
curl -X POST http://localhost:3002/templates \
  -H "Content-Type: application/json" \
  -H "x-correlation-id: test-123" \
  -H "x-user-id: test-user" \
  -d '{
    "code": "welcome_email",
    "name": "Welcome Email Template",
    "type": "email",
    "subject": "Welcome to {{company_name}}!",
    "content": "<h1>Hello {{user_name}}!</h1><p>Welcome to {{company_name}}.</p>",
    "variables": ["user_name", "company_name"],
    "language": "en"
  }'
```

#### Render Template

```bash
curl -X POST http://localhost:3002/templates/render/welcome_email \
  -H "Content-Type: application/json" \
  -H "x-correlation-id: test-456" \
  -d '{
    "user_name": "John Doe",
    "company_name": "Acme Corp"
  }'
```

#### Get Template

```bash
curl http://localhost:3002/templates/code/welcome_email \
  -H "x-correlation-id: test-789"
```

### Email Service Endpoints

#### Health Check

```bash
curl http://localhost:3001/health
```

#### Service Status

```bash
curl http://localhost:3001/health/detailed
```

## Environment Setup

### Template Service (.env)

```bash
NODE_ENV=development
PORT=3002
DATABASE_URL=postgresql://gateway_user:gatewaypassword@postgres:5432/gateway_db
REDIS_URL=redis://:redispassword@redis:6379/1
LOG_LEVEL=debug
```

### Email Service (.env)

```bash
NODE_ENV=development
PORT=3001
RABBITMQ_URL=amqp://admin:secretpassword@rabbitmq:5672/
REDIS_URL=redis://:redispassword@redis:6379/0
TEMPLATE_SERVICE_URL=http://template-service:3002
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=587
SMTP_USER=your_username
SMTP_PASSWORD=your_password
LOG_LEVEL=debug
```

## Common Issues

### Services not starting

- Check if all dependencies are running: `docker-compose -f infra/docker-compose.yml ps`
- Check service logs: `docker-compose -f docker-compose.dev.yml logs template-service`

### Database connection issues

- Ensure PostgreSQL is running and accessible
- Check DATABASE_URL in template service environment

### Redis connection issues

- Ensure Redis is running and accessible
- Check REDIS_URL in both services

### RabbitMQ connection issues (Email Service)

- Ensure RabbitMQ is running and accessible
- Check RABBITMQ_URL in email service environment

## Service Ports

- Template Service: `http://localhost:3002`
- Email Service: `http://localhost:3001`
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`
- RabbitMQ: `localhost:5672` (AMQP), `http://localhost:15672` (Management)

## Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Email Service  │────│ Template Service │────│    Database     │
│   Port: 3001    │    │   Port: 3002     │    │ PostgreSQL:5432 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │              ┌─────────────────┐              │
         └──────────────│      Redis      │──────────────┘
                        │   Port: 6379    │
                        └─────────────────┘
         │
┌─────────────────┐
│    RabbitMQ     │
│   Port: 5672    │
│  Mgmt: 15672    │
└─────────────────┘
```
