# Push Service

## Overview

The Push Service handles push notification delivery via Firebase Cloud Messaging (FCM). It consumes messages from RabbitMQ, renders templates, sends push notifications, and reports status back to the API Gateway.

## Features

- ✅ **Firebase Cloud Messaging (FCM)** integration
- ✅ **Template rendering** with Jinja2
- ✅ **Multi-platform support** (iOS, Android, Web)
- ✅ **Circuit breaker** for FCM resilience
- ✅ **Idempotency** via Redis
- ✅ **Status reporting** to API Gateway
- ✅ **Structured logging** with correlation IDs

## Status Update Flow

The Push Service reports status back to the API Gateway at three key points:

### 1. **Processing** (Start)

When a message is received and processing begins:

```json
{
  "new_status": "processing",
  "changed_by": "push-service",
  "metadata": {
    "request_id": "abc-123"
  }
}
```

### 2. **Delivered** (Success)

When FCM successfully sends the push notification:

```json
{
  "new_status": "delivered",
  "changed_by": "push-service",
  "metadata": {
    "device_token": "token...",
    "provider": "fcm",
    "fcm_response": "projects/..."
  }
}
```

### 3. **Failed** (Error)

When any error occurs (invalid token, timeout, circuit breaker, etc.):

```json
{
  "new_status": "failed",
  "error_message": "Invalid registration token: Token is unregistered",
  "changed_by": "push-service",
  "metadata": {
    "error_type": "UnregisteredError",
    "provider": "fcm"
  }
}
```

## Environment Variables

| Variable               | Description                           | Required | Default            |
| ---------------------- | ------------------------------------- | -------- | ------------------ |
| `RABBITMQ_HOST`        | RabbitMQ connection URL               | ✅       | -                  |
| `REDIS_HOST`           | Redis connection URL                  | ✅       | -                  |
| `FIREBASE_CREDENTIALS` | Path to Firebase service account JSON | ✅       | -                  |
| `PUSH_QUEUE_NAME`      | Name of the push queue                | ❌       | `push.queue`       |
| `API_GATEWAY_BASE_URL` | Base URL of API Gateway               | ✅       | See `.env.example` |
| `API_GATEWAY_API_KEY`  | Service-to-service API key            | ✅       | -                  |

### Configuration Notes

**API Gateway Configuration** (Required for status updates):

```bash
API_GATEWAY_BASE_URL=https://your-gateway.railway.app
API_GATEWAY_API_KEY=your_service_api_key
```

If `API_GATEWAY_API_KEY` is not set, status updates will be skipped with a warning log.

## Message Format

Expected message from RabbitMQ:

```json
{
  "notification_id": "uuid-here",
  "request_id": "unique-request-id",
  "push_token": "fcm-device-token",
  "template_data": {
    "template_id": "welcome",
    "subject": "Welcome {{name}}!",
    "body": "Hello {{name}}, welcome to our app!"
  },
  "variables": {
    "name": "John",
    "image": "https://example.com/image.png",
    "link": "https://example.com/welcome",
    "data": {
      "action": "open_welcome_screen"
    }
  }
}
```

## API Endpoints

### Health Check

```http
GET /health
```

Returns service health status.

### Get Notification Status

```http
GET /notification/{request_id}/status
```

Returns the cached status of a notification.

### Enqueue Notification (Test)

```http
POST /enqueue
```

Test endpoint to manually enqueue messages to the push queue.

### Send Push Directly (Test)

```http
POST /send
```

Test endpoint to send push notifications directly without queue.

## Error Handling

The service handles various error scenarios:

| Error Type            | Status Update | Retry            |
| --------------------- | ------------- | ---------------- |
| `UnregisteredError`   | `failed`      | ❌ No            |
| `CircuitBreakerError` | `failed`      | ✅ Yes (requeue) |
| `General FCM Error`   | `failed`      | ✅ Yes (requeue) |
| `Invalid Message`     | -             | ❌ No (to DLQ)   |

## Circuit Breaker

FCM calls are protected by a circuit breaker:

- **Fail Max**: 5 failures
- **Reset Timeout**: 60 seconds

When the circuit opens, messages are requeued for retry.

## Idempotency

Duplicate requests (same `request_id`) within 24 hours are automatically ignored to prevent duplicate push notifications.

## Development

### Run Locally

```bash
cd services/push_service
pip install -r requirements.txt
python -m app.main
```

### Run Tests

```bash
pytest tests/
```

## Deployment

The service is designed to run in a containerized environment (Docker/Railway).

### Docker

```bash
docker build -t push-service .
docker run -p 8003:8003 --env-file .env push-service
```

## Logging

All logs are structured JSON with:

- `timestamp` (ISO format)
- `correlation_id` (from request headers)
- `notification_id`
- `request_id`
- Event-specific fields

Example log:

```json
{
  "timestamp": "2025-11-14T10:30:00Z",
  "correlation_id": "abc-123",
  "notification_id": "uuid",
  "request_id": "req-456",
  "event": "Push delivered",
  "fcm_response": "projects/..."
}
```

## Status Update API (API Gateway)

The Push Service calls the following API Gateway endpoint:

```http
POST /push/status?notification_id={uuid}
Headers:
  X-API-Key: {service_api_key}
  Content-Type: application/json
Body:
  {
    "new_status": "delivered",    // or "failed", "processing"
    "error_message": "",           // optional
    "changed_by": "push-service",
    "metadata": {}                 // optional
  }
```

### Valid Status Values

- `processing` - Notification processing started
- `delivered` - Successfully sent to device
- `failed` - Error occurred during send

⚠️ **Important**: Status values must be **lowercase** and **exact match** or the API will return `422 VALIDATION_ERROR`.
