from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str
    MONGODB_URL: str
    REDIS_URL: str
    JWT_SECRET: str
    FILE_ENCRYPTION_KEY: str

    model_config = SettingsConfigDict(
        env_file=".env",
        #env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()  #type: ignore[call-arg]