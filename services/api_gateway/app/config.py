"""Configuration module for API Gateway"""

from functools import lru_cache
import os

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings with validation"""

    # === App ===
    app_name: str = "api-gateway"
    app_version: str = "1.0.0"
    environment: str = "development"
    log_level: str = "INFO"

    # === Server ===
    host: str = "0.0.0.0"
    port: int = 8000
    workers: int = 4

    # === RabbitMQ ===
    rabbitmq_host: str = "rabbitmq"
    rabbitmq_port: int = 5672
    rabbitmq_user: str = "admin"
    rabbitmq_password: str = "secretpassword"
    rabbitmq_vhost: str = "/"
    rabbitmq_url: str = ""
    rabbitmq_mgmt_host: str = "rabbitmq"
    rabbitmq_mgmt_port: int = 15672
    rabbitmq_mgmt_url: str = "http://rabbitmq:15672"
    rabbitmq_exchange: str = "notifications.direct"
    rabbitmq_dlx: str = "notifications.dlx"
    rabbitmq_email_queue: str = "email.queue"
    rabbitmq_push_queue: str = "push.queue"
    rabbitmq_failed_queue: str = "failed.queue"
    queue_message_ttl: int = 86400000
    queue_max_length: int = 100000
    rabbitmq_connection_timeout: int = 10
    rabbitmq_heartbeat: int = 60
    rabbitmq_prefetch_count: int = 10

    # === User Service ===
    user_service_url: str = ""
    user_service_timeout: float = 2.0
    user_service_max_retries: int = 3
    user_service_retry_delay: float = 0.5
    user_service_circuit_failure_threshold: int = 5
    user_service_circuit_recovery_timeout: int = 30
    user_service_api_key: str = ""

    # === Template Service ===
    template_service_url: str = ""
    template_service_timeout: float = 2.0
    template_service_max_retries: int = 3
    template_service_retry_delay: float = 0.5
    template_service_circuit_failure_threshold: int = 5
    template_service_circuit_recovery_timeout: int = 30
    template_service_api_key: str = ""

    # === Redis ===
    redis_host: str = "redis"
    redis_port: int = 6379
    redis_db: int = 0
    redis_password: str = "redispassword"
    redis_url: str = ""
    redis_max_connections: int = 50
    redis_socket_timeout: int = 5
    redis_socket_connect_timeout: int = 5
    idempotency_ttl: int = 86400
    status_cache_ttl: int = 3600
    service_cache_ttl: int = 300
    rate_limit_window: int = 60

    # === PostgreSQL ===
    postgres_host: str = "postgres"
    postgres_port: int = 5433
    postgres_user: str = "gateway_user"
    postgres_password: str = "gatewaypassword"
    postgres_db: str = "gateway_db"
    database_url: str = ""
    db_pool_size: int = 20
    db_max_overflow: int = 10
    db_pool_timeout: int = 30
    db_pool_recycle: int = 3600

    # === Authentication ===
    jwt_secret_key: str = ""
    jwt_algorithm: str = "HS256"
    jwt_expiration_minutes: int = 60
    api_key_prefix: str = "apk_"
    api_key_length: int = 32

    # === Rate Limiting ===
    rate_limit_default: int = 100
    rate_limit_admin: int = 1000 # Not used currently
    rate_limit_client: int = 100 # Not used currently
    rate_limit_service: int = 500 # Not used currently

    # === Monitoring ===
    metrics_port: int = 9090
    metrics_path: str = "/metrics"
    health_check_path: str = "/health"
    health_check_interval: int = 30

    # === Correlation ID ===
    correlation_id_header: str = "X-Correlation-ID"
    correlation_id_length: int = 32

    # === Pydantic v2 Config (ONLY ONE) ===
    model_config = SettingsConfigDict(
        env_file=".env.local" if os.getenv("ENV") != "docker" else ".env.docker",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",  # Recommended: ignore unknown env vars
    )

    @model_validator(mode="after")
    def construct_urls(self):
        if not self.rabbitmq_url:
            self.rabbitmq_url = f"amqp://{self.rabbitmq_user}:{self.rabbitmq_password}@{self.rabbitmq_host}:{self.rabbitmq_port}/{self.rabbitmq_vhost}"

        if not self.redis_url:
            self.redis_url = f"redis://:{self.redis_password}@{self.redis_host}:{self.redis_port}/{self.redis_db}"

        if not self.database_url:
            self.database_url = f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"

        # Validate required fields
        if not self.user_service_url:
            raise ValueError("USER_SERVICE_URL must be set in environment variables")
        if not self.template_service_url:
            raise ValueError("TEMPLATE_SERVICE_URL must be set in environment variables")
        if not self.user_service_api_key:
            raise ValueError("USER_SERVICE_API_KEY must be set in environment variables")
        if not self.jwt_secret_key:
            raise ValueError("JWT_SECRET_KEY must be set in environment variables")

        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()