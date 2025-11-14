# Multi-stage build for Template Service
# Stage 1: Builder
FROM python:3.12-slim as builder

RUN apt-get update && apt-get install -y build-essential && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt ./
COPY README.md ./
COPY app ./app

RUN python -m venv .venv && \
    . .venv/bin/activate && \
    pip install --no-cache-dir -r requirements.txt

# Stage 2: Runtime
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/app/.venv/bin:$PATH" \
    PORT=8002

RUN groupadd -r appuser && useradd -r -g appuser appuser

WORKDIR /app

COPY --from=builder /app/.venv /app/.venv

COPY alembic.ini ./
COPY alembic ./alembic
COPY app ./app

RUN chown -R appuser:appuser /app

USER appuser

EXPOSE ${PORT}

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:${PORT}/health').read()"

CMD sh -c "python -m alembic upgrade head && python -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --workers 1 --loop uvloop"
