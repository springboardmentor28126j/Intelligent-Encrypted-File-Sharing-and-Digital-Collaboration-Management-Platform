import hashlib
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import pyotp
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str: 
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str | None) -> bool:
    return bool(hashed_password) and pwd_context.verify(plain_password, hashed_password)
    

def hash_identifier(value: str) -> str: 
    return hashlib.sha256(value.encode()).hexdigest()

def create_access_token(user_id: int, role: str, expires_minutes: int | None = None, jti: str | None = None) -> tuple[str, str, datetime]:
    jti = jti or uuid.uuid4().hex
    minutes = expires_minutes if expires_minutes is not None else settings.ACCESS_TOKEN_EXPIRE_MINUTES
    expire = datetime.now(timezone.utc) + timedelta(minutes=minutes)
    payload = {"sub": str(user_id), "role": role, "jti": jti, "exp": expire, "iat": datetime.now(timezone.utc)}
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM), jti, expire

def decode_access_token(token: str) -> dict[str, Any]:
    return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])

def generate_mfa_secret() -> str: return pyotp.random_base32()

def get_mfa_uri(secret: str, email: str) -> str: return pyotp.TOTP(secret).provisioning_uri(name=email, issuer_name="TrustShare")

def verify_mfa_code(secret: str, code: str) -> bool:
    return bool(secret and code and code.strip().isdigit() and len(code.strip()) == 6 and pyotp.TOTP(secret).verify(code.strip(), valid_window=1))
