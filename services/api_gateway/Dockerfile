# -------------------------------------
# 🚀 API Gateway Dockerfile
# -------------------------------------
FROM python:3.12-slim AS builder

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy only dependency files first (leverage Docker layer caching)
COPY pyproject.toml poetry.lock* ./

# Install dependencies in editable mode
RUN pip install --no-cache-dir -e .[all] || pip install --no-cache-dir .

# -------------------------------------
# 🏃 Runtime image (minimal & secure)
# -------------------------------------
FROM python:3.12-slim

# Avoid running as root
RUN adduser --disabled-password --gecos '' appuser

WORKDIR /app

# Copy installed packages from builder
COPY --from=builder /usr/local /usr/local

# Copy application code
COPY app ./app
COPY alembic ./alembic
COPY alembic.ini ./
COPY .env.docker ./.env

# Environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    APP_NAME=api-gateway \
    ENVIRONMENT=production \
    LOG_LEVEL=INFO \
    PORT=8000 \
    ENV=docker

# Expose port
EXPOSE 8000

# Healthcheck with curl (install curl in runtime if not present)
RUN apt-get update && apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Switch to non-root user
USER appuser

# Run Uvicorn with production settings
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]