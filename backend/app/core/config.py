from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str
    MONGO_URL: str
    REDIS_URL: str
    JWT_SECRET: str
    MASTER_ENCRYPTION_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    UPLOAD_DIR: str = "/app/uploads"

    # Email (all optional — if SMTP_HOST/USERNAME/PASSWORD aren't set,
    # email sending is skipped and password reset falls back to dev mode)
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = ""
    SMTP_FROM_NAME: str = "TrustShare"
    FRONTEND_URL: str = "http://localhost:3000"

    # File storage backend: "local" (default, disk inside the container)
    # or "s3" (AWS S3, or any S3-compatible provider like Backblaze B2 —
    # set S3_ENDPOINT_URL to point at a non-AWS provider). If
    # STORAGE_BACKEND=s3 but the AWS_*/S3_* vars below aren't filled in,
    # the app falls back to local storage rather than failing to start.
    STORAGE_BACKEND: str = "local"
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_REGION: str = "us-east-1"
    S3_BUCKET_NAME: str = ""
    S3_ENDPOINT_URL: str = ""  # leave blank for real AWS S3

    class Config:
        env_file = ".env"


settings = Settings()
