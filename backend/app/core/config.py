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
    rate_limit_enabled: bool = True
    permission_cache_ttl_seconds: int = 60

    cors_origins: list[str] = ["*"]

    jwt_secret: str = "change-this-secret-before-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 720
    refresh_token_expire_days: int = 30
    encryption_key: str = ""
    vault_master_key: str = ""

    redis_url: str = "redis://localhost:6379/0"
    celery_broker_url: str = "redis://localhost:6379/1"
    celery_result_backend: str = "redis://localhost:6379/2"

    whatsapp_verify_token: str = ""
    whatsapp_app_secret: str = ""
    whatsapp_access_token: str = ""
    whatsapp_api_version: str = "v19.0"
    whatsapp_dry_run: bool = True

    gemini_api_key: str = ""
    default_ai_provider: str = "local"
    ai_fallback_providers: str = "local,gemini,openai,anthropic"
    fcm_enabled: bool = False
    default_timezone: str = "UTC"

    stripe_secret_key: str = ""
    media_storage_backend: str = "local"
    s3_bucket: str = ""
    s3_region: str = ""
    deepgram_api_key: str = ""
    elevenlabs_api_key: str = ""

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
