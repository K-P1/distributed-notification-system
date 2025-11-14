# Multi-stage build for Template Service
# Stage 1: Builder
FROM python:3.11-slim as builder

# Install build dependencies for asyncpg
RUN apt-get update && apt-get install -y build-essential && rm -rf /var/lib/apt/lists/*

# Install uv for fast dependency resolution
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Set working directory
WORKDIR /app

# Copy dependency files and app directory (needed for editable install)
COPY pyproject.toml ./
COPY README.md ./
COPY app ./app

# Install dependencies using uv (creates .venv)
RUN uv sync --no-dev

# Stage 2: Runtime
FROM python:3.11-slim

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/app/.venv/bin:$PATH" \
    PORT=8002 \
    UV_CACHE_DIR=/app/.uv_cache

# Create non-root user
RUN groupadd -r appuser && useradd -r -g appuser appuser

# Set working directory
WORKDIR /app

# Install uv for running commands
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Copy virtual environment from builder
COPY --from=builder /app/.venv /app/.venv

# Copy application code
COPY alembic.ini ./
COPY alembic ./alembic
COPY app ./app

# Change ownership to non-root user
RUN chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Expose port (Railway will set PORT env var)
EXPOSE ${PORT}

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:${PORT}/health').read()"

# Run the application
CMD sh -c "python -m alembic upgrade head && python -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --workers 1 --loop uvloop"
