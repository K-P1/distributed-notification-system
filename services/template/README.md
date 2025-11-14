# Template Service

Template management and rendering service for the Distributed Notification System.

## Features

- Template CRUD operations
- Multi-language support
- Jinja2 template rendering with variable substitution
- Template version history
- API key authentication
- Database migrations with Alembic
- Health check endpoint

## API Endpoints

### Create Template

```http
POST /api/v1/templates/
X-API-Key: test

{
  "code": "welcome_email",
  "language": "en",
  "subject": "Welcome {{name}}!",
  "body_html": "<h1>Hello {{name}}</h1><p>Click <a href='{{link}}'>here</a></p>",
  "body_text": "Hello {{name}}! Visit: {{link}}"
}
```

### Get Template by ID

```http
GET /api/v1/templates/{template_id}
X-API-Key: test
```

### Get Template by Code (for API Gateway)

```http
GET /api/v1/templates/code/{code}?language=en
X-API-Key: test
```

### Render Template

```http
POST /api/v1/templates/code/{code}/render?language=en
X-API-Key: test

{
  "variables": {
    "name": "John Doe",
    "link": "https://example.com"
  }
}
```

### Update Template

```http
PUT /api/v1/templates/{template_id}
X-API-Key: test

{
  "subject": "Updated Subject {{name}}",
  "body_html": "<h1>Updated HTML {{name}}</h1>",
  "body_text": "Updated text {{name}}"
}
```

### Delete Template

```http
DELETE /api/v1/templates/{template_id}
X-API-Key: test
```

### List Templates

```http
GET /api/v1/templates/?skip=0&limit=100&language=en
X-API-Key: test
```

### Health Check

```http
GET /health
```

## Jinja2 Variables

Templates support Jinja2 syntax for variable substitution:

- Simple variables: `{{name}}`, `{{email}}`
- Filters: `{{name|upper}}`, `{{price|round(2)}}`
- Control structures: `{% if condition %}...{% endif %}`

## Running Locally

1. Copy environment file:

```bash
cp .env.example .env
```

2. Install dependencies:

```bash
uv sync
```

3. Run migrations:

```bash
uv run alembic upgrade head
```

4. Start the service:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8002
```

## Docker

Build and run:

```bash
docker build -t template-service .
docker run -p 8002:8002 --env-file .env template-service
```

## Configuration

See `.env.example` for all configuration options.

## Database Schema

**templates** table:

- `id` (UUID) - Primary key
- `code` (VARCHAR) - Unique template identifier
- `language` (VARCHAR) - Language code (e.g., en, es)
- `subject` (VARCHAR) - Email subject with Jinja2 variables
- `body_html` (TEXT) - HTML body with Jinja2 variables
- `body_text` (TEXT) - Plain text body with Jinja2 variables
- `version` (INTEGER) - Template version number
- `is_active` (BOOLEAN) - Active status
- `created_at` (TIMESTAMP) - Creation timestamp
- `updated_at` (TIMESTAMP) - Last update timestamp

## Template Versioning

When templates are updated, the version number is automatically incremented. This allows tracking changes over time and ensures that notifications reference the correct template version.
