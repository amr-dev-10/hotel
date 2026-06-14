from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=("backend/.env", ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "Arcadia Hotel Platform"
    environment: str = "development"
    api_v1_prefix: str = "/api/v1"
    database_url: str = "sqlite:///./hotel_cloud_dev.db"
    auto_create_tables: bool = True

    cors_origins: list[str] = ["*"]

    jwt_secret: str = "change-this-secret-before-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 720

    redis_url: str = "redis://localhost:6379/0"
    celery_broker_url: str = "redis://localhost:6379/1"
    celery_result_backend: str = "redis://localhost:6379/2"

    whatsapp_verify_token: str = ""
    whatsapp_app_secret: str = ""
    whatsapp_access_token: str = ""
    whatsapp_api_version: str = "v19.0"
    whatsapp_dry_run: bool = True

    gemini_api_key: str = ""
    fcm_enabled: bool = False
    default_timezone: str = "UTC"

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
