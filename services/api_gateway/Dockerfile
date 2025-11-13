# -------------------------------------
# API Gateway Dockerfile (Railway + Local)
# -------------------------------------
FROM python:3.12-slim AS builder

# Install build tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential gcc libpq-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy only dependency files (cache layer)
COPY pyproject.toml ./
COPY app ./app

# Install dependencies (fallback if no extras)
RUN pip install --no-cache-dir .

# Copy full app code
COPY . .

# Install project in editable mode
RUN pip install --no-cache-dir -e . || pip install --no-cache-dir .

# -------------------------------------
# Runtime (super small)
# -------------------------------------
FROM python:3.12-slim

# Non-root user
RUN adduser --disabled-password --gecos '' appuser

WORKDIR /app

# Copy installed packages
COPY --from=builder /usr/local /usr/local

# Copy app code
COPY app ./app
COPY alembic ./alembic
COPY alembic.ini ./

# Install curl for healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

# Environment (Railway sets these in UI)
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

USER appuser

CMD uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 2