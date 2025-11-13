# Template Service

The Template Service is a critical component of the distributed notification system responsible for managing notification templates with comprehensive enterprise patterns including caching, circuit breakers, observability, and validation.

## Features

### Core Functionality
- **Template Management**: Full CRUD operations for notification templates
- **Template Versioning**: Version control with activation/deactivation capabilities
- **Template Rendering**: Variable substitution with validation
- **Template Validation**: Comprehensive validation for content, variables, and metadata
- **Multi-language Support**: Template localization capabilities

### Enterprise Patterns
- **Circuit Breakers**: Fault tolerance for database and Redis operations
- **Caching Strategy**: Redis-based caching with intelligent invalidation
- **Structured Logging**: JSON-based logging with correlation IDs
- **Health Checks**: Comprehensive health monitoring endpoints
- **Metrics Collection**: Performance and operational metrics
- **Database Management**: PostgreSQL with connection pooling and transactions

### API Endpoints

#### Template Management
- `POST /api/v1/templates` - Create a new template
- `GET /api/v1/templates/:id` - Get template by ID
- `GET /api/v1/templates/code/:code` - Get template by code
- `GET /api/v1/templates` - Search templates with filters
- `PUT /api/v1/templates/:id` - Update template
- `DELETE /api/v1/templates/:id` - Delete template

#### Template Versioning
- `GET /api/v1/templates/:id/versions` - Get template versions
- `POST /api/v1/templates/:id/versions` - Create new version
- `POST /api/v1/templates/:id/versions/:version/activate` - Activate version

#### Template Rendering
- `POST /api/v1/templates/render/:code` - Render template with variables

#### Utility Endpoints
- `GET /api/v1/templates/active/all` - Get active templates
- `GET /api/v1/templates/stats/overview` - Get template statistics
- `GET /api/v1/templates/validate/code/:code` - Check code availability

#### Health & Monitoring
- `GET /api/v1/health` - Comprehensive health check
- `GET /api/v1/health/ready` - Readiness probe
- `GET /api/v1/health/live` - Liveness probe
- `GET /api/v1/metrics/system` - System metrics
- `GET /api/v1/metrics/application` - Application metrics
- `GET /api/v1/metrics/performance` - Performance metrics
- `GET /api/v1/metrics/prometheus` - Prometheus format metrics

## Technology Stack

- **Framework**: NestJS with TypeScript
- **Database**: PostgreSQL with connection pooling
- **Cache**: Redis with circuit breaker protection
- **Message Queue**: RabbitMQ (integration ready)
- **Monitoring**: Custom metrics and Prometheus integration
- **Validation**: class-validator with custom business rules

## Configuration

### Environment Variables

```bash
# Server Configuration
PORT=3002
NODE_ENV=development
VERSION=1.0.0

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USER=template_user
DB_PASSWORD=template_password
DB_NAME=template_db

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=2

# Cache Configuration
CACHE_TTL=3600
CACHE_MAX_SIZE=1000

# Circuit Breaker Configuration
CIRCUIT_BREAKER_FAILURE_THRESHOLD=5
CIRCUIT_BREAKER_RECOVERY_TIMEOUT=30000
```

## Installation & Setup

### Development Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Database Setup**:
   ```bash
   # Create PostgreSQL database
   createdb template_db
   
   # Run migrations (tables created automatically on startup)
   ```

3. **Redis Setup**:
   ```bash
   # Start Redis server
   redis-server
   ```

4. **Environment Configuration**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

5. **Start Development Server**:
   ```bash
   npm run start:dev
   ```

### Docker Deployment

```bash
# Build image
docker build -t template-service .

# Run container
docker run -p 3002:3002 \
  -e DB_HOST=host.docker.internal \
  -e REDIS_HOST=host.docker.internal \
  template-service
```

### Production Deployment

```bash
# Build for production
npm run build

# Start production server
npm run start:prod
```

## Database Schema

### Templates Table
- `id` (UUID, Primary Key)
- `code` (VARCHAR, Unique Index)
- `name` (VARCHAR)
- `description` (TEXT)
- `type` (email|push)
- `subject` (VARCHAR)
- `content` (TEXT)
- `variables` (TEXT[])
- `language` (VARCHAR)
- `version` (INTEGER)
- `is_active` (BOOLEAN)
- `tags` (TEXT[])
- `metadata` (JSONB)
- `created_at`, `updated_at` (TIMESTAMP)
- `created_by`, `updated_by` (VARCHAR)

### Template Versions Table
- `id` (UUID, Primary Key)
- `template_id` (UUID, Foreign Key)
- `version` (INTEGER)
- `subject` (VARCHAR)
- `content` (TEXT)
- `variables` (TEXT[])
- `is_active` (BOOLEAN)
- `created_at` (TIMESTAMP)
- `created_by` (VARCHAR)
- `change_log` (TEXT)
- `metadata` (JSONB)

## Architecture

### Service Architecture
```
┌─────────────────────────────────────────────┐
│                Controllers                   │
├─────────────────────────────────────────────┤
│              Business Logic                  │
│  ┌─────────────┐  ┌──────────────────────┐  │
│  │   Template  │  │    Validation        │  │
│  │   Service   │  │    Service           │  │
│  └─────────────┘  └──────────────────────┘  │
├─────────────────────────────────────────────┤
│              Repository Layer                │
│  ┌─────────────────────────────────────────┐ │
│  │         Template Repository             │ │
│  └─────────────────────────────────────────┘ │
├─────────────────────────────────────────────┤
│            Infrastructure Layer              │
│ ┌─────────────┐ ┌─────────┐ ┌──────────────┐ │
│ │  Database   │ │  Cache  │ │   Circuit    │ │
│ │   Service   │ │ Service │ │   Breaker    │ │
│ └─────────────┘ ┌─────────┐ └──────────────┘ │
└─────────────────────────────────────────────┘
```

### Key Components

1. **Configuration Service**: Centralized configuration management
2. **Database Service**: PostgreSQL connection with health checks
3. **Cache Service**: Redis-based caching with circuit breaker
4. **Circuit Breaker Service**: Fault tolerance patterns
5. **Logger Service**: Structured JSON logging
6. **Validation Service**: Business rule validation
7. **Template Repository**: Data access layer
8. **Template Service**: Business logic layer

## Usage Examples

### Creating a Template

```bash
curl -X POST http://localhost:3002/api/v1/templates \
  -H "Content-Type: application/json" \
  -H "x-correlation-id: 123e4567-e89b-12d3-a456-426614174000" \
  -H "x-user-id: user123" \
  -d '{
    "code": "welcome_email",
    "name": "Welcome Email Template",
    "type": "email",
    "subject": "Welcome {{firstName}}!",
    "content": "<h1>Welcome {{firstName}} {{lastName}}!</h1><p>Thank you for joining us.</p>",
    "variables": ["firstName", "lastName"],
    "language": "en",
    "tags": ["welcome", "onboarding"]
  }'
```

### Rendering a Template

```bash
curl -X POST http://localhost:3002/api/v1/templates/render/welcome_email \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John",
    "lastName": "Doe"
  }'
```

## Testing

```bash
# Run unit tests
npm run test

# Run tests with coverage
npm run test:cov

# Run e2e tests
npm run test:e2e
```

## Monitoring & Observability

### Health Checks
The service provides multiple health check endpoints:
- `/api/v1/health` - Full health status
- `/api/v1/health/ready` - Kubernetes readiness probe
- `/api/v1/health/live` - Kubernetes liveness probe

### Metrics
- Template creation/update/deletion rates
- Cache hit/miss rates
- Database connection pool status
- Circuit breaker states
- Response time percentiles
- Memory and CPU usage

### Logging
All operations are logged with:
- Correlation IDs for request tracing
- Structured JSON format
- Performance metrics
- Error details with stack traces

## Development

### Code Structure
```
src/
├── config/           # Configuration management
├── controllers/      # REST API controllers
├── infrastructure/   # External service integrations
├── repositories/     # Data access layer
├── services/        # Business logic
├── types/           # TypeScript type definitions
├── utils/           # Utility services
├── app.module.ts    # Main application module
└── main.ts          # Application bootstrap
```

### Adding New Features

1. Define types in `src/types/`
2. Implement repository methods if needed
3. Add business logic to services
4. Create/update controllers
5. Add comprehensive tests
6. Update documentation

## License

This project is licensed under the UNLICENSED License.