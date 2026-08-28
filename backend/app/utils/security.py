from datetime import datetime, timedelta
import hashlib
import secrets
from jose import JWTError, jwt
from passlib.context import CryptContext
from ..config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)


def create_access_token(user_id: int) -> str:
    expires = datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes)
    return jwt.encode({"sub": str(user_id), "exp": expires}, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def get_token_subject(token: str) -> int | None:
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        return int(payload.get("sub"))
    except (JWTError, TypeError, ValueError):
        return None


def create_reset_token() -> tuple[str, str]:
    token = secrets.token_urlsafe(32)
    return token, hashlib.sha256(token.encode()).hexdigest()


def hash_reset_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def create_otp() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def create_reset_verification_token(user_id: int) -> str:
    expires = datetime.utcnow() + timedelta(minutes=settings.otp_expire_minutes)
    payload = {"sub": str(user_id), "purpose": "password_reset", "exp": expires}
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def get_reset_verification_subject(token: str) -> int | None:
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        if payload.get("purpose") != "password_reset":
            return None
        return int(payload.get("sub"))
    except (JWTError, TypeError, ValueError):
        return None
