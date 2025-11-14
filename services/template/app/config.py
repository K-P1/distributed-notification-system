"""Configuration management for Template Service."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings."""

    # Application
    app_name: str = "template-service"
    environment: str = "development"
    log_level: str = "INFO"

    # Database
    database_url: str

    # API Keys
    valid_api_keys: str = "test"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    def get_api_keys(self) -> set[str]:
        """Parse and return valid API keys."""
        return {key.strip() for key in self.valid_api_keys.split(",") if key.strip()}


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
