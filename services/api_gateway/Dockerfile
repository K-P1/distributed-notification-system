# -------------------------------------
# 🚀 API Gateway Dockerfile
# -------------------------------------
FROM python:3.12-slim AS builder

# Install only what we need to compile packages (psycopg2, etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential gcc libpq-dev curl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency files
COPY pyproject.toml ./

# Install dependencies
RUN pip install --no-cache-dir -e .

# -------------------------------------
# 🏃 Runtime image (super small)
# -------------------------------------
FROM python:3.12-slim

# Create non-root user
RUN useradd -m appuser

WORKDIR /app

# Copy Python environment from builder
COPY --from=builder /usr/local /usr/local

# Copy only the app code (not tests, docs, etc.)
COPY app ./app
COPY alembic ./alembic
COPY alembic.ini ./
COPY .env.docker ./.env.docker

# Set runtime env vars
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    APP_NAME=api-gateway \
    ENVIRONMENT=production \
    LOG_LEVEL=INFO \
    PORT=8000 \
    ENV=docker

# Expose port
EXPOSE 8000

# Healthcheck — this is GOLD for Kubernetes / Docker Compose
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Switch to non-root user
USER appuser

# Run with reasonable number of workers in prod
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]