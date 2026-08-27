import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "TrustShare"
    DATABASE_URL: str = "postgresql://postgres:Vickey%40812027@localhost:5432/TrustShare"
    SECRET_KEY: str = "SUPER_SECRET_KEY_TRUSTSHARE_2026"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    class Config:
        env_file = ".env"

settings = Settings()