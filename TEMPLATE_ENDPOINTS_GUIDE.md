# Template Service API Endpoints Guide

The Template Service provides a comprehensive REST API for managing notification templates with full CRUD operations, versioning, rendering, and statistics. Below is a complete guide to all available endpoints.

## Base URL

```
http://localhost:3002/api/v1
```

## Endpoint Overview

| Method | Endpoint                                    | Purpose                             |
| ------ | ------------------------------------------- | ----------------------------------- |
| POST   | `/templates`                                | Create a new template               |
| GET    | `/templates/:id`                            | Get template by ID                  |
| GET    | `/templates/code/:code`                     | Get template by code                |
| GET    | `/templates`                                | Search templates with filters       |
| PUT    | `/templates/:id`                            | Update existing template            |
| DELETE | `/templates/:id`                            | Delete template                     |
| GET    | `/templates/:id/versions`                   | Get template version history        |
| POST   | `/templates/:id/versions`                   | Create new template version         |
| POST   | `/templates/:id/versions/:version/activate` | Activate specific version           |
| POST   | `/templates/render/:code`                   | Render template with variables      |
| GET    | `/templates/active/all`                     | Get all active templates            |
| GET    | `/templates/stats/overview`                 | Get template statistics             |
| GET    | `/templates/validate/code/:code`            | Check if template code is available |
| GET    | `/health`                                   | Health check endpoint               |
| GET    | `/metrics`                                  | Service metrics                     |

---

## 1. Create Template

**POST** `/templates`

Creates a new notification template.

### Request Body

```json
{
  "code": "welcome-email",
  "name": "Welcome Email Template",
  "description": "Welcome email sent to new users",
  "type": "email",
  "subject": "Welcome to {{company_name}}!",
  "content": "Hello {{user_name}}, welcome to {{company_name}}! Your account has been created.",
  "variables": ["user_name", "company_name"],
  "language": "en",
  "tags": ["welcome", "onboarding"],
  "metadata": {
    "priority": "high",
    "category": "user-management"
  }
}
```

### Response

```json
{
  "success": true,
  "message": "Template created successfully",
  "data": {
    "id": "uuid-here",
    "code": "welcome-email",
    "name": "Welcome Email Template",
    "version": 1,
    "is_active": true,
    "created_at": "2024-01-15T10:00:00Z"
  }
}
```

### Use Cases

- API Gateway creating templates for different notification types
- Admin panel template management
- Automated template creation from configuration

---

## 2. Get Template by ID

**GET** `/templates/:id`

Retrieves a specific template by its unique ID.

### Parameters

- `id` (path): Template UUID

### Response

```json
{
  "success": true,
  "data": {
    "id": "uuid-here",
    "code": "welcome-email",
    "name": "Welcome Email Template",
    "description": "Welcome email sent to new users",
    "type": "email",
    "subject": "Welcome to {{company_name}}!",
    "content": "Hello {{user_name}}, welcome to {{company_name}}!",
    "variables": ["user_name", "company_name"],
    "language": "en",
    "version": 1,
    "is_active": true,
    "tags": ["welcome", "onboarding"],
    "created_at": "2024-01-15T10:00:00Z",
    "updated_at": "2024-01-15T10:00:00Z",
    "created_by": "admin",
    "updated_by": "admin",
    "metadata": {
      "priority": "high",
      "category": "user-management"
    }
  }
}
```

### Use Cases

- Admin panel template editing
- Template preview functionality
- Audit trail investigations

---

## 3. Get Template by Code

**GET** `/templates/code/:code`

Retrieves a template by its unique code identifier.

### Parameters

- `code` (path): Template code (e.g., "welcome-email")

### Response

Same as Get Template by ID

### Use Cases

- **Email Service integration** - Fetching templates by memorable codes
- API Gateway template lookups
- External system integrations

---

## 4. Search Templates

**GET** `/templates`

Search and filter templates with pagination.

### Query Parameters

```
?type=email&language=en&tags=welcome,onboarding&isActive=true&search=welcome&page=1&limit=10
```

- `type`: Filter by template type (`email`, `push`)
- `language`: Filter by language code
- `tags`: Comma-separated list of tags
- `isActive`: Filter by active status (`true`, `false`)
- `search`: Text search in name/description/content
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10, max: 100)

### Response

```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": "uuid-here",
        "code": "welcome-email",
        "name": "Welcome Email Template",
        "type": "email",
        "version": 1,
        "is_active": true,
        "created_at": "2024-01-15T10:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 1,
      "totalPages": 1,
      "hasNext": false,
      "hasPrevious": false
    }
  }
}
```

### Use Cases

- Admin panel template listing
- Template discovery and browsing
- Bulk operations on filtered templates

---

## 5. Update Template

**PUT** `/templates/:id`

Updates an existing template and optionally creates a new version.

### Request Body

```json
{
  "name": "Updated Welcome Email Template",
  "content": "Hello {{user_name}}, welcome to our platform!",
  "variables": ["user_name"],
  "changeLog": "Simplified welcome message"
}
```

### Response

```json
{
  "success": true,
  "message": "Template updated successfully",
  "data": {
    "id": "uuid-here",
    "version": 2,
    "updated_at": "2024-01-15T11:00:00Z"
  }
}
```

### Use Cases

- Template content updates
- A/B testing new versions
- Content localization updates

---

## 6. Delete Template

**DELETE** `/templates/:id`

Soft deletes a template (marks as inactive).

### Response

```json
{
  "success": true,
  "message": "Template deleted successfully"
}
```

### Use Cases

- Template lifecycle management
- Cleanup of obsolete templates
- Admin panel management

---

## 7. Get Template Versions

**GET** `/templates/:id/versions`

Retrieves version history for a template.

### Response

```json
{
  "success": true,
  "data": [
    {
      "id": "version-uuid",
      "template_id": "template-uuid",
      "version": 2,
      "subject": "Welcome to {{company_name}}!",
      "content": "Updated content...",
      "variables": ["user_name", "company_name"],
      "is_active": true,
      "created_at": "2024-01-15T11:00:00Z",
      "created_by": "admin",
      "change_log": "Simplified welcome message"
    }
  ]
}
```

### Use Cases

- Template audit trails
- Version comparison
- Rollback functionality

---

## 8. Create Template Version

**POST** `/templates/:id/versions`

Creates a new version of an existing template.

### Request Body

```json
{
  "content": "New version of the template content",
  "variables": ["user_name", "company_name"],
  "changeLog": "Added personalization features",
  "metadata": {
    "test_group": "A"
  }
}
```

### Response

```json
{
  "success": true,
  "message": "Template version created successfully",
  "data": {
    "id": "version-uuid",
    "version": 3,
    "created_at": "2024-01-15T12:00:00Z"
  }
}
```

### Use Cases

- A/B testing scenarios
- Gradual template updates
- Content experimentation

---

## 9. Activate Template Version

**POST** `/templates/:id/versions/:version/activate`

Makes a specific version the active version for a template.

### Parameters

- `id` (path): Template ID
- `version` (path): Version number to activate

### Response

```json
{
  "success": true,
  "message": "Template version activated successfully",
  "data": {
    "activeVersion": 2,
    "updatedAt": "2024-01-15T12:30:00Z"
  }
}
```

### Use Cases

- Rolling back to previous versions
- A/B test conclusion
- Emergency template fixes

---

## 10. Render Template

**POST** `/templates/render/:code`

Renders a template with provided variables, returns the final content.

### Parameters

- `code` (path): Template code to render

### Request Body

```json
{
  "variables": {
    "user_name": "John Doe",
    "company_name": "Acme Corp",
    "activation_link": "https://app.acme.com/activate/abc123"
  },
  "language": "en"
}
```

### Response

```json
{
  "success": true,
  "data": {
    "content": "Hello John Doe, welcome to Acme Corp! Your account has been created.",
    "subject": "Welcome to Acme Corp!",
    "type": "email",
    "templateId": "uuid-here",
    "templateCode": "welcome-email",
    "templateVersion": 1,
    "variables": ["user_name", "company_name"],
    "language": "en"
  }
}
```

### Use Cases

- **Email Service** - Getting rendered email content before sending
- Template preview functionality
- Testing template rendering

---

## 11. Get All Active Templates

**GET** `/templates/active/all`

Retrieves all currently active templates.

### Response

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-1",
      "code": "welcome-email",
      "name": "Welcome Email Template",
      "type": "email",
      "version": 1,
      "language": "en"
    }
  ]
}
```

### Use Cases

- Service initialization
- Template discovery for integrations
- Cache warming

---

## 12. Get Template Statistics

**GET** `/templates/stats/overview`

Returns comprehensive statistics about template usage and performance.

### Response

```json
{
  "success": true,
  "data": {
    "totalTemplates": 25,
    "activeTemplates": 20,
    "templatesByType": {
      "email": 15,
      "push": 10
    },
    "templatesByLanguage": {
      "en": 20,
      "es": 3,
      "fr": 2
    },
    "averageVariableCount": 3.5,
    "cacheStatistics": {
      "hits": 1500,
      "misses": 100,
      "hitRate": 0.937
    }
  }
}
```

### Use Cases

- Admin dashboard analytics
- Performance monitoring
- Usage optimization

---

## 13. Validate Template Code

**GET** `/templates/validate/code/:code`

Checks if a template code is available for use.

### Parameters

- `code` (path): Template code to validate

### Response

```json
{
  "success": true,
  "data": {
    "available": true,
    "suggested": "welcome-email-v2"
  }
}
```

### Use Cases

- Template creation validation
- Preventing duplicate codes
- Code suggestion functionality

---

## 14. Health Check

**GET** `/health`

Returns service health status and dependency checks.

### Response

```json
{
  "status": "healthy",
  "version": "1.0.0",
  "timestamp": "2024-01-15T10:00:00Z",
  "dependencies": {
    "database": "healthy",
    "redis": "healthy"
  },
  "metrics": {
    "templates_count": 25,
    "cache_hit_rate": 0.95,
    "average_response_time": 45
  }
}
```

### Use Cases

- Service monitoring
- Load balancer health checks
- Dependency validation

---

## 15. Service Metrics

**GET** `/metrics`

Returns detailed service metrics in Prometheus format.

### Response

Prometheus metrics format including:

- HTTP request counts and durations
- Database connection pool metrics
- Cache performance metrics
- Custom business metrics

### Use Cases

- Monitoring and alerting
- Performance analysis
- Capacity planning

---

## Integration Examples

### Email Service Integration

```typescript
// Email service fetching and rendering template
const templateResponse = await fetch(
  `${TEMPLATE_SERVICE_URL}/templates/render/welcome-email`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      variables: {
        user_name: "John Doe",
        company_name: "Acme Corp",
      },
    }),
  }
);

const template = await templateResponse.json();
// Use template.data.content and template.data.subject for email
```

### API Gateway Integration

```typescript
// API Gateway creating notification request
const notificationRequest = {
  templateCode: "welcome-email",
  recipient: "user@example.com",
  variables: {
    user_name: "John Doe",
    company_name: "Acme Corp",
  },
};

// Email service will use template service to render content
await messageQueue.publish("email.send", notificationRequest);
```

---

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": {
    "code": "TEMPLATE_NOT_FOUND",
    "message": "Template with code 'invalid-code' not found",
    "details": {
      "requestedCode": "invalid-code"
    }
  },
  "message": "Template not found"
}
```

### Common Error Codes

- `TEMPLATE_NOT_FOUND` - Template does not exist
- `VALIDATION_ERROR` - Request validation failed
- `DUPLICATE_CODE` - Template code already exists
- `DATABASE_ERROR` - Database operation failed
- `RENDERING_ERROR` - Template rendering failed

---

This comprehensive API enables full template lifecycle management, from creation and versioning to rendering and analytics, supporting the complete distributed notification system workflow.
