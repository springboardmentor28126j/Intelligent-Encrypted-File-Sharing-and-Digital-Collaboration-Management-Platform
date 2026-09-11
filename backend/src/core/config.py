from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field
from typing import Optional
import os
import secrets

class Settings(BaseSettings):
    PROJECT_NAME: str = "TrustShare"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Security
    SECRET_KEY: str = Field(default_factory=lambda: os.getenv("SECRET_KEY", secrets.token_urlsafe(32)))
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # Master Key Encryption Key (KEK) for envelope encryption (32 bytes base64 or hex)
    MASTER_KEK: str = Field(default_factory=lambda: os.getenv("MASTER_KEK", "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"))
    
    # Database Configuration (PostgreSQL / SQLite)
    DATABASE_URL: Optional[str] = Field(default_factory=lambda: os.getenv("DATABASE_URL"))
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str = "trustshare_user"
    POSTGRES_PASSWORD: str = "trustshare_password"
    POSTGRES_DB: str = "trustshare_db"
    
    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        if self.DATABASE_URL:
            from urllib.parse import urlparse, parse_qs, urlencode, urlunparse
            parsed = urlparse(self.DATABASE_URL)
            scheme = parsed.scheme
            if scheme in ("postgres", "postgresql"):
                scheme = "postgresql+asyncpg"
            elif scheme == "sqlite":
                scheme = "sqlite+aiosqlite"
            
            if parsed.query:
                query_dict = parse_qs(parsed.query)
                if "sslmode" in query_dict:
                    query_dict["ssl"] = query_dict.pop("sslmode")
                if "channel_binding" in query_dict:
                    del query_dict["channel_binding"]
                new_query = urlencode({k: v[0] if len(v) == 1 else v for k, v in query_dict.items()})
                parsed = parsed._replace(scheme=scheme, query=new_query)
            else:
                parsed = parsed._replace(scheme=scheme)
            return urlunparse(parsed)
        return f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

    @property
    def SYNC_SQLALCHEMY_DATABASE_URI(self) -> str:
        if self.DATABASE_URL:
            return self.DATABASE_URL.replace("+asyncpg", "").replace("+aiosqlite", "")
        return f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        
    # MongoDB
    MONGODB_URI: str = "mongodb://localhost:27017"
    MONGODB_DB_NAME: str = "trustshare_telemetry"
    
    # Redis
    REDIS_URI: str = "redis://localhost:6379/0"
    
    # Storage (MinIO / S3)
    STORAGE_TYPE: str = Field(default_factory=lambda: os.getenv("STORAGE_TYPE", "local"))
    LOCAL_STORAGE_DIR: str = "/tmp/trustshare_storage"
    S3_ENDPOINT_URL: str = "http://localhost:9000"
    S3_ACCESS_KEY: str = "minioadmin"
    S3_SECRET_KEY: str = "minioadminpassword"
    S3_BUCKET_NAME: str = "trustshare-encrypted-files"
    S3_REGION: str = "us-east-1"
    
    # Rate Limiting & Limits
    MAX_FILE_SIZE_BYTES: int = 524288000  # 500 MB
    CHUNK_SIZE_BYTES: int = 65536  # 64 KB
    
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True, extra="ignore")

settings = Settings()
