from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    database_url: str
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    reset_token_expire_minutes: int = 30
    frontend_origin: str = "http://localhost:5173"
    max_file_size_mb: int = 10
    file_encryption_master_key: str = ""
    storage_backend: str = "local"
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    aws_region: str = ""
    aws_s3_bucket: str = ""
    aws_s3_prefix: str = "files"
    aws_endpoint_url: str = ""
    share_link_base_url: str = "http://localhost:8000/api/share-links"
    otp_expire_minutes: int = 10
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from_email: str = ""
    smtp_use_tls: bool = True

    mongodb_url: str
    mongodb_db_name: str = "trustshare"
    redis_url: str

    model_config = SettingsConfigDict(env_file=BACKEND_DIR / ".env", extra="ignore")


settings = Settings()
