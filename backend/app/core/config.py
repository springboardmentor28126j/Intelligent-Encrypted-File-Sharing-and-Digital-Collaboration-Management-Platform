"""
Central configuration for TrustShare.
All values are overridable via environment variables (.env file supported).
"""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    APP_NAME: str = "TrustShare"
    ENV: str = "development"

    # --- Database ---
    # Defaults to local SQLite so the project runs out of the box.
    # Point this at Postgres in production, e.g.:
    # postgresql+psycopg2://user:pass@localhost:5432/trustshare
    DATABASE_URL: str = "sqlite:///./trustshare.db"

    # --- Auth / JWT ---
    JWT_SECRET_KEY: str = "CHANGE_ME_IN_PRODUCTION_USE_A_LONG_RANDOM_VALUE"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # --- Encryption ---
    # Master key used to wrap/protect individual per-file AES-256 keys.
    # In production this should come from a KMS (AWS KMS / Azure Key Vault),
    # not a plain env var.
    MASTER_ENCRYPTION_KEY: str = "CHANGE_ME_32_BYTE_BASE64_MASTER_KEY_XXXXXX"

    # --- Storage ---
    # "local" writes encrypted blobs to disk (default, works with no cloud setup).
    # "s3" uses AWS S3 (requires AWS_* env vars below).
    STORAGE_BACKEND: str = "local"
    LOCAL_STORAGE_DIR: str = "./storage/encrypted"

    AWS_ACCESS_KEY_ID: str | None = None
    AWS_SECRET_ACCESS_KEY: str | None = None
    AWS_REGION: str = "us-east-1"
    S3_BUCKET_NAME: str | None = None

    # --- Sharing ---
    DEFAULT_SHARE_LINK_EXPIRY_HOURS: int = 72
    MAX_UPLOAD_SIZE_MB: int = 100

    # --- CORS ---
    FRONTEND_ORIGIN: str = "http://localhost:3000"


settings = Settings()
