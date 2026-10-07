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

    # Encryption & Key Management (AES-256-GCM)
    # Master Key (KEK) used in Envelope Encryption to encrypt Data Encryption Keys (DEKs).
    # 32 bytes (64 hex chars). In production, set via MASTER_KEY_HEX or connect to AWS KMS/Azure Key Vault.
    MASTER_KEY_HEX: str = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"

    # Password Reset & Token Settings
    PASSWORD_RESET_EXPIRE_MINUTES: int = 30
    FRONTEND_URL: str = "http://localhost:3000"

    # Email Service Configuration ("smtp", "resend", "sendgrid", or "console")
    EMAIL_PROVIDER: str = "smtp"
    EMAIL_FROM_ADDRESS: str = "no-reply@trustshare.io"
    EMAIL_FROM_NAME: str = "TrustShare Security"

    # SMTP Configuration (Works with Gmail App Password, AWS SES, Mailgun, SendGrid SMTP, etc.)
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_USE_TLS: bool = True
    SMTP_USE_SSL: bool = False
    SMTP_TIMEOUT_SECONDS: int = 10

    # API-based Email Providers
    RESEND_API_KEY: str = ""
    SENDGRID_API_KEY: str = ""

    # Rate Limiting & Account Security Controls
    RATE_LIMIT_LOGIN_MAX: int = 5
    RATE_LIMIT_LOGIN_WINDOW_SEC: int = 300
    RATE_LIMIT_RESET_MAX: int = 3
    RATE_LIMIT_RESET_WINDOW_SEC: int = 900

    # Milestone 3 Security Monitoring & Account Lockout Settings
    FAILED_LOGIN_THRESHOLD: int = 5
    LOCKOUT_DURATION_MINUTES: int = 15
    FAILED_LOGIN_WINDOW_MINUTES: int = 10
    UNAUTHORIZED_ACCESS_THRESHOLD: int = 5
    UNAUTHORIZED_ACCESS_WINDOW_MINUTES: int = 10
    EXCESSIVE_DOWNLOAD_THRESHOLD: int = 10
    EXCESSIVE_DOWNLOAD_WINDOW_MINUTES: int = 5

    # Storage Backend Configuration ("supabase" or "local")
    STORAGE_BACKEND: str = "supabase"

    # Supabase Cloud Storage Configuration
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""
    SUPABASE_STORAGE_BUCKET: str = "trustshare-files"
    SUPABASE_SIGNED_URL_EXPIRY_SECONDS: int = 300  # 5 minutes


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

