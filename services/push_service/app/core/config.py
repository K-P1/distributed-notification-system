import os
import structlog
from pydantic_settings import BaseSettings


# Global clients
redis = None  # to be initialized in main.py
rabbit_connection = None
channel = None
httpx_client = None


# Logger configuration
structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer()]
    )
logger = structlog.get_logger()



class Settings(BaseSettings):
    RABBITMQ_URL: str = os.getenv("RABBITMQ_HOST")
    REDIS_URL: str = os.getenv("REDIS_HOST")
    FCM_CREDENTIALS_PATH: str = os.getenv("FIREBASE_CREDENTIALS")
    PUSH_QUEUE_NAME: str = os.getenv("PUSH_QUEUE_NAME", "push.queue")


settings = Settings()


def api_response(success: bool, data=None, error: str = None, message: str = "", meta=None):
    """Standardized API response format."""
    default_meta = {
        "total": 0, "limit": 10, "page": 1, "total_pages": 0,
        "has_next": False, "has_previous": False
    }
    return {
        "success": success,
        "data": data,
        "error": error,
        "message": message,
        "meta": meta or default_meta
    }


