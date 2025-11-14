"""
Pytest configuration and shared fixtures for API Gateway tests.

Provides test fixtures for:
- Database sessions (in-memory SQLite)
- Redis client (fakeredis)
- RabbitMQ client (mocked)
- HTTP service clients (mocked)
- FastAPI test client
"""

import pytest
import pytest_asyncio
from typing import AsyncGenerator, Generator
from unittest.mock import AsyncMock, MagicMock
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import sessionmaker
from uuid import uuid4

from app.main import app
from app.models import Base
from app.config import Settings


# Test configuration
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture(scope="session")
def test_settings() -> Settings:
    """Get test configuration settings"""
    return Settings(
        database_url=TEST_DATABASE_URL,
        environment="testing",
        log_level="DEBUG",
        user_service_url="http://localhost:8001",
        template_service_url="http://localhost:8002",
        jwt_secret_key="test-secret-key-for-testing-only",
    )


@pytest_asyncio.fixture
async def db_engine():
    """Create test database engine with in-memory SQLite"""
    engine = create_async_engine(
        TEST_DATABASE_URL,
        echo=False,
        connect_args={"check_same_thread": False},
    )

    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield engine

    # Drop tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(db_engine) -> AsyncGenerator[AsyncSession, None]:
    """Create test database session"""
    async_session_factory = async_sessionmaker(
        db_engine, class_=AsyncSession, expire_on_commit=False
    )

    async with async_session_factory() as session:
        yield session
        await session.rollback()


@pytest_asyncio.fixture
async def redis_client():
    """Create fake Redis client for testing"""
    try:
        import fakeredis.aioredis

        client = fakeredis.aioredis.FakeRedis(decode_responses=True)
        yield client
        await client.flushall()
        # FakeRedis doesn't require explicit close
    except ImportError:
        pytest.skip("fakeredis not installed")


@pytest.fixture
def mock_rabbitmq():
    """Mock RabbitMQ client"""
    mock = AsyncMock()
    mock.connect = AsyncMock()
    mock.disconnect = AsyncMock()
    mock.setup_topology = AsyncMock()
    mock.publish = AsyncMock(return_value=True)
    return mock


@pytest.fixture
def mock_user_service():
    """Mock User Service HTTP client"""
    mock = AsyncMock()
    mock.get_user = AsyncMock(
        return_value={
            "id": str(uuid4()),
            "email": "test@example.com",
            "name": "Test User",
            "device_token": "fake_device_token",
            "preferences": {"channels": ["email", "push"]},
            "is_active": True,
        }
    )
    return mock


@pytest.fixture
def mock_template_service():
    """Mock Template Service HTTP client"""
    mock = AsyncMock()
    mock.get_template = AsyncMock(
        return_value={
            "template_code": "welcome_email",
            "template_id": str(uuid4()),
            "type": "email",
            "subject": "Welcome!",
            "body": "Hello {{name}}!",
            "is_active": True,
            "version": 1,
        }
    )
    return mock


@pytest_asyncio.fixture
async def test_app(
    mock_rabbitmq, mock_user_service, mock_template_service, redis_client, db_engine
):
    """Create FastAPI test application with mocked dependencies"""
    from app.clients.redis_client import (
        RedisManager,
        IdempotencyCache,
        StatusCache,
        ServiceCache,
        RateLimiter,
    )
    from app.database import DatabaseManager
    from app.dependencies import verify_api_key

    # Override API key verification for tests
    async def mock_verify_api_key() -> str:
        return "test_api_key"

    app.dependency_overrides[verify_api_key] = mock_verify_api_key

    # Setup app state with mocks
    app.state.rabbitmq = mock_rabbitmq
    app.state.user_service = mock_user_service
    app.state.template_service = mock_template_service

    # Setup Redis clients - use FakeRedis directly, no RedisManager in tests
    app.state.redis = redis_client  # Use FakeRedis directly instead of RedisManager
    app.state.idempotency_cache = IdempotencyCache(redis_client, ttl=3600)
    app.state.status_cache = StatusCache(redis_client, ttl=3600)
    app.state.service_cache = ServiceCache(redis_client, ttl=300)
    app.state.rate_limiter = RateLimiter(redis_client, window=60)

    # Setup database - use engine directly in tests, no DatabaseManager
    # Create a minimal mock DatabaseManager with just the engine
    class MockDatabaseManager:
        def __init__(self, engine):
            self.engine = engine
            self.session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
        
        async def get_session(self) -> AsyncGenerator[AsyncSession, None]:
            """Get database session"""
            async with self.session_factory() as session:
                yield session
    
    app.state.db = MockDatabaseManager(db_engine)

    yield app

    # Cleanup
    app.dependency_overrides.clear()
    delattr(app.state, "rabbitmq")
    delattr(app.state, "user_service")
    delattr(app.state, "template_service")
    delattr(app.state, "redis")
    delattr(app.state, "idempotency_cache")
    delattr(app.state, "status_cache")
    delattr(app.state, "service_cache")
    delattr(app.state, "rate_limiter")
    delattr(app.state, "db")


@pytest_asyncio.fixture
async def client(test_app) -> AsyncGenerator[AsyncClient, None]:
    """Create async HTTP client for testing FastAPI app"""
    async with AsyncClient(app=test_app, base_url="http://test") as ac:
        yield ac


@pytest.fixture
def sample_notification_request():
    """Sample notification request payload"""
    return {
        "notification_type": "email",
        "user_id": str(uuid4()),
        "template_code": "welcome_email",
        "variables": {"name": "John Doe", "link": "https://example.com"},
        "request_id": f"req-{uuid4()}",
        "priority": 1,
        "metadata": {"source": "test"},
    }


@pytest.fixture
def sample_user_data():
    """Sample user data from User Service"""
    return {
        "id": str(uuid4()),
        "email": "user@example.com",
        "name": "Test User",
        "device_token": "test_device_token",
        "preferences": {"channels": ["email", "push"]},
        "is_active": True,
    }


@pytest.fixture
def sample_template_data():
    """Sample template data from Template Service"""
    return {
        "template_code": "welcome_email",
        "template_id": str(uuid4()),
        "type": "email",
        "subject": "Welcome to our service",
        "body": "Hello {{name}}, welcome!",
        "is_active": True,
        "version": 1,
    }
