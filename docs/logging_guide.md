# Logging Guide – Uniform Structured Logs

All services **must** emit **JSON logs** to STDOUT. No colored logs, no pretty-print in production.

## Why JSON?
- Easy parsing by ELK, Loki, Datadog, etc.
- Correlation IDs travel automatically
- Uniform across Python, TypeScript, Bun

## Required Fields (every log line)
```json
{
  "timestamp": "2025-11-09T18:43:21.123Z",
  "level": "info|warn|error|debug",
  "service": "api-gateway|user|template|email|push",
  "correlation_id": "corr-123e4567-e89b-12d3-a456-426614174000",
  "message": "human readable message",
  "request_id": "req-abc123",               // optional, for idempotency
  "user_id": 12345,                         // optional
  "duration_ms": 123.4,                     // optional
  "error": "full error string",             // when level=error
  "stack": "stack trace"                    // when level=error (optional)
}
```

## Implementation per Stack

### Python/FastAPI (uvicorn + structlog)
```python
import structlog
import logging
import uuid
from fastapi import Request

structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer()
    ]
)
log = structlog.get_logger()

# Middleware to inject correlation_id
@app.middleware("http")
async def add_correlation_id(request: Request, call_next):
    corr_id = request.headers.get("X-Correlation-ID", str(uuid.uuid4()))
    structlog.contextvars.bind_contextvars(correlation_id=corr_id)
    response = await call_next(request)
    response.headers["X-Correlation-ID"] = corr_id
    return response

# Usage
log.info("notification received", request_id=payload["request_id"], user_id=user_id)
log.error("smtp failed", error=str(exc), exc_info=True)
```

### TypeScript/NestJS (Pino)
```ts
// main.ts
import { Logger } from 'nestjs-pino';
app.useLogger(app.get(Logger));

// Add correlation ID interceptor
@Injectable()
export class CorrelationIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const corrId = context.switchToHttp().getRequest().headers['x-correlation-id'] ?? randomUUID();
    context.switchToHttp().getResponse().set('X-Correlation-ID', corrId);
    return next.handle().pipe(tap(() => Logger.log({ correlation_id: corrId })));
  }
}

// Usage
this.logger.log({ message: 'template fetched', template_id, duration_ms: 45 });
this.logger.error({ message: 'FCM failed', error: err.message, stack: err.stack });
```

### Bun/Hono (built-in console + custom wrapper)
```ts
// logger.ts
export const logger = {
  info: (msg: string, extra?: Record<string, any>) => {
    console.log(JSON.stringify({ ...baseLog(), level: "info", message: msg, ...extra }));
  },
  error: (msg: string, extra?: Record<string, any>) => {
    console.error(JSON.stringify({ ...baseLog(), level: "error", message: msg, ...extra }));
  }
};

function baseLog() {
  return {
    timestamp: new Date().toISOString(),
    service: "push",
    correlation_id: getCorrelationId(), // from context or header
  };
}
```

## Propagation of correlation_id
- **API Gateway** generates or reads `X-Correlation-ID` header
- **Adds it to RabbitMQ message properties** (`headers.x-correlation-id`)
- **Consumers** read it from message headers and bind to logger context
- **All downstream logs** automatically contain the same ID
