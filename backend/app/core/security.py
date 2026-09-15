"""
JWT authentication + bcrypt password hashing.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models.user import User


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/auth/login"
)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(
    subject: str,
    expires_delta: Optional[timedelta] = None
) -> str:
    expire = datetime.now(timezone.utc) + (
        expires_delta
        or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )

    payload = {
        "sub": subject,
        "exp": expire,
        "type": "access",
    }

    return jwt.encode(
        payload,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )


def create_mfa_pending_token(subject: str) -> str:
    """
    Short-lived token issued after a correct password when MFA is enabled.
    """

    expire = datetime.now(timezone.utc) + timedelta(minutes=5)

    payload = {
        "sub": subject,
        "exp": expire,
        "type": "mfa_pending",
    }

    return jwt.encode(
        payload,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )


def create_password_reset_token(subject: str) -> str:
    """
    Short-lived token for password recovery.
    """

    expire = datetime.now(timezone.utc) + timedelta(minutes=30)

    payload = {
        "sub": subject,
        "exp": expire,
        "type": "password_reset",
    }

    return jwt.encode(
        payload,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )

def create_password_reset_token(subject: str) -> str:
    """
    Short-lived token proving control of an email/account for password
    recovery. Cannot be used to access protected endpoints - only to
    complete POST /api/auth/reset-password. Expires in 30 minutes so an
    old, unused reset link/email can't be replayed later.
    """
    expire = datetime.now(timezone.utc) + timedelta(minutes=30)
    payload = {"sub": subject, "exp": expire, "type": "password_reset"}
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)

def create_refresh_token(subject: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        days=settings.REFRESH_TOKEN_EXPIRE_DAYS
    )

    payload = {
        "sub": subject,
        "exp": expire,
        "type": "refresh",
    }

    return jwt.encode(
        payload,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )

    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:

    payload = decode_token(token)

    # Only access tokens can access protected endpoints
    if payload.get("type") != "access":
        raise HTTPException(
            status_code=401,
            detail="Invalid token type",
        )

    user_id = payload.get("sub")

    if not user_id:
        raise HTTPException(
            status_code=401,
            detail="Invalid user ID",
        )

    # Database uses UUID, not integer ID
    try:
        user_uuid = UUID(user_id)

    except (ValueError, TypeError):
        raise HTTPException(
            status_code=401,
            detail="Invalid user ID",
        )

    user = (
        db.query(User)
        .filter(User.id == user_uuid)
        .first()
    )

    # Shared users table does not contain is_active
    if not user:
        raise HTTPException(
            status_code=401,
            detail="User not found",
        )

    return user


def require_role(*roles: str):

    def checker(
        user: User = Depends(get_current_user)
    ) -> User:

        if user.role not in roles:
            raise HTTPException(
                status_code=403,
                detail="Insufficient permissions",
            )

        return user

    return checker