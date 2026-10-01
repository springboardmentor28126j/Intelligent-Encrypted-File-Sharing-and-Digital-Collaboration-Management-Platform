from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    APP_NAME: str = "TrustShare"
    APP_VERSION: str = "2.0.0"
    DEBUG: bool = True
    DATABASE_URL: str
    MONGODB_URL: str = "mongodb://localhost:27017"
    MONGODB_DB: str = "trustshare"
    REDIS_URL: str = "redis://localhost:6379"
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    FILE_ENCRYPTION_KEY: str
    STORAGE_BACKEND: str = "local"
    STORAGE_DIR: str = "storage"
    MAX_UPLOAD_SIZE: int = 50 * 1024 * 1024
    AWS_ACCESS_KEY_ID: str | None = None
    AWS_SECRET_ACCESS_KEY: str | None = None
    AWS_REGION: str | None = None
    AWS_S3_BUCKET: str | None = None
    CORS_ORIGINS: str = "http://localhost:3000"
    FRONTEND_URL: str = "http://localhost:3000"
    PASSWORD_RESET_EXPIRE_MINUTES: int = 30
    GOOGLE_CLIENT_ID: str | None = None
    GOOGLE_CLIENT_SECRET: str | None = None
    GOOGLE_REDIRECT_URI: str | None = None
    SMTP_HOST: str | None = None
    SMTP_PORT: int = 587
    SMTP_USERNAME: str | None = None
    SMTP_PASSWORD: str | None = None
    SMTP_FROM: str | None = None
    model_config = SettingsConfigDict(
        env_file=".env", 
        env_file_encoding="utf-8", 
        case_sensitive=True, 
        extra="ignore"
        )
    
    @property
    def cors_origins_list(self) -> list[str]:
        return [x.strip() for x in self.CORS_ORIGINS.split(",") if x.strip()]

@lru_cache
def get_settings() -> Settings:
    return Settings() #type: ignore[call-arg]
    
settings = get_settings()
