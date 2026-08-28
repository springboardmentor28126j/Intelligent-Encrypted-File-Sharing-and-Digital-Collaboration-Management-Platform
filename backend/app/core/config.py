import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    # Database Settings (Fixed syntax error)
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://postgres:Vickey%40812027@localhost:5432/TrustShare")
    
    # Auth Settings
    SECRET_KEY: str = os.getenv("SECRET_KEY", "your-super-secret-key")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # Gmail SMTP Credentials
    MAIL_USERNAME: str = "trustshare.official@gmail.com"
    MAIL_PASSWORD: str = "rotkxojkofgfkykj"
    MAIL_FROM: str = "trustshare.official@gmail.com"
    MAIL_PORT: int = 587
    MAIL_SERVER: str = "smtp.gmail.com"

settings = Settings()