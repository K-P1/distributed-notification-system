"""Template Service FastAPI application."""

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import health, templates

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)

logger = logging.getLogger(__name__)

settings = get_settings()

# Create FastAPI app
app = FastAPI(
    title=settings.app_name,
    description="Template Service for Distributed Notification System",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router)
app.include_router(templates.router)


@app.on_event("startup")
async def startup_event() -> None:
    """Execute on application startup."""
    logger.info(f"Starting {settings.app_name} in {settings.environment} mode")


@app.on_event("shutdown")
async def shutdown_event() -> None:
    """Execute on application shutdown."""
    logger.info(f"Shutting down {settings.app_name}")
