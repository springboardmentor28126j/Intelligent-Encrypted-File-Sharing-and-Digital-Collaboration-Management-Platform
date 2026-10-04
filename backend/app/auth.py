"""
auth.py – Authentication utilities & token verification.

Provides:
  - Password hashing and verification via passlib/bcrypt
  - JWT access token creation and lifetime management
  - Redis token blacklist checking on every authenticated request
  - `get_current_user` FastAPI dependency for protected routes
  - `require_admin` RBAC dependency
"""

import bcrypt
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import User, UserRole
from app.schemas import TokenData
from app.services.redis_service import is_token_blacklisted, blacklist_token

# ─── Password Hashing ─────────────────────────────────────────────────────────

def hash_password(plain_password: str) -> str:
    """Hash a plain-text password using native bcrypt."""
    pw_bytes = plain_password.encode("utf-8")
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(pw_bytes, salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain-text password against a stored bcrypt hash."""
    try:
        pw_bytes = plain_password.encode("utf-8")
        hash_bytes = hashed_password.encode("utf-8")
        return bcrypt.checkpw(pw_bytes, hash_bytes)
    except Exception:
        return False


# ─── JWT Token Creation ───────────────────────────────────────────────────────

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a signed JWT access token with expiration timestamp."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_access_token(token: str) -> dict:
    """Decode and validate a JWT access token."""
    return jwt.decode(
        token,
        settings.SECRET_KEY,
        algorithms=[settings.ALGORITHM],
    )


# ─── JWT Bearer Scheme ────────────────────────────────────────────────────────
bearer_scheme = HTTPBearer(auto_error=True)


# ─── Protected Route Dependencies ─────────────────────────────────────────────

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """
    FastAPI dependency that:
      1. Reads the JWT from the Authorization: Bearer header
      2. Validates against Redis blacklist to ensure token hasn't been revoked/logged out
      3. Decodes and validates the token signature + expiry
      4. Looks up the user in the database
      5. Returns the User ORM object
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    token = credentials.credentials

    # Check Redis Blacklist
    if is_token_blacklisted(token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has been terminated. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = decode_access_token(token)
        email: Optional[str] = payload.get("sub")
        if email is None:
            raise credentials_exception
        token_data = TokenData(email=email)
    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.email == token_data.email).first()
    if user is None:
        raise credentials_exception

    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """RBAC dependency: Restricts endpoint access strictly to admin role."""
    if current_user.role != UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Administrator privileges required.",
        )
    return current_user


def revoke_token(token: str):
    """
    Revoke a JWT token by adding it to Redis blacklist for remaining lifetime.
    """
    try:
        payload = decode_access_token(token)
        exp = payload.get("exp")
        if exp:
            now = datetime.now(timezone.utc).timestamp()
            remaining = int(exp - now)
            if remaining > 0:
                blacklist_token(token, expire_seconds=remaining)
                return
        blacklist_token(token, expire_seconds=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60)
    except Exception:
        # If token already invalid/expired, still blacklist for safety
        blacklist_token(token, expire_seconds=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60)
