# -------------------------------------
# API Gateway Dockerfile (Railway + Local)
# -------------------------------------
FROM python:3.12-slim AS builder

# Install build tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential gcc libpq-dev curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency files first (cache layer)
COPY pyproject.toml ./

# Install dependencies
RUN pip install --upgrade pip && pip install uv && uv sync --frozen

# Copy the rest of the app
COPY . .

# -------------------------------------
# Runtime (lighter image)
# -------------------------------------
FROM python:3.12-slim

# Create non-root user
RUN adduser --disabled-password --gecos '' appuser

WORKDIR /app

# Copy installed packages & app code
COPY --from=builder /usr/local /usr/local
COPY --from=builder /app /app

# Environment
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000

EXPOSE 8000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

USER appuser

# Use shell form so $PORT expands properly
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 2
