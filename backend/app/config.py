import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent

class Settings(BaseSettings):
    """
    Application configuration.
    Values are loaded from .env (or real environment variables).
    Sensible defaults are provided for seamless local development.
    """

    # Database: defaults to SQLite for local development; override with PostgreSQL in production/Docker
    DATABASE_URL: str = "sqlite:///./trustshare.db"

    # MongoDB Configuration
    MONGODB_URL: str = "mongodb://localhost:27017"
    MONGODB_DB_NAME: str = "trustshare_db"

    # Redis Configuration
    REDIS_URL: str = "redis://localhost:6379/0"

    # File Storage & Upload Configuration
    UPLOAD_DIR: str = str(BASE_DIR / "uploads")
    MAX_FILE_SIZE_MB: int = 50
    ALLOWED_EXTENSIONS: str = ".pdf,.doc,.docx,.txt,.rtf,.odt,.xlsx,.xls,.csv,.pptx,.ppt,.png,.jpg,.jpeg,.gif,.webp,.svg,.bmp,.zip,.tar,.gz,.7z"

    # JWT
    SECRET_KEY: str = "supersecretkey_change_in_production_32chars"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # CORS: comma-separated list of allowed origins
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000,http://127.0.0.1:3001"

    model_config = SettingsConfigDict(
        env_file=(str(BASE_DIR / ".env"), ".env"),
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


# Singleton settings instance – imported across the app
settings = Settings()
