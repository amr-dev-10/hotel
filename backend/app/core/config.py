from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Hotel Cloud Platform"
    environment: str = "development"
    database_url: str = "sqlite:///./hotel_cloud_dev.db"
    jwt_secret: str = "change-this-development-secret-minimum-32-chars"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 30
    redis_url: str = "redis://localhost:6379/0"
    guest_otp_code: str = "123456"
    whatsapp_verify_token: str = "change-this-whatsapp-verify-token"
    whatsapp_access_token: str | None = None
    whatsapp_graph_api_url: str = "https://graph.facebook.com/v20.0"
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-1.5-flash"
    firebase_credentials_path: str | None = None

    model_config = SettingsConfigDict(
        env_file="backend/.env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
