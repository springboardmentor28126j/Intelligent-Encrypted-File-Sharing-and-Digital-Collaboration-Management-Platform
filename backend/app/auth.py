import os
import secrets
import hashlib

from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv
from jose import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from .database import SessionLocal
from .models import User, PasswordResetToken


# Load environment variables
load_dotenv()


# ============================================================
# JWT CONFIGURATION
# ============================================================

SECRET_KEY = os.getenv("JWT_SECRET_KEY")

if not SECRET_KEY:
    raise RuntimeError(
        "JWT_SECRET_KEY is not configured in .env"
    )

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

security = HTTPBearer()


# ============================================================
# JWT ACCESS TOKEN
# ============================================================

def create_access_token(user_id: int):
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=ACCESS_TOKEN_EXPIRE_MINUTES
    )

    payload = {
        "sub": str(user_id),
        "exp": expire
    }

    return jwt.encode(
        payload,
        SECRET_KEY,
        algorithm=ALGORITHM
    )


# ============================================================
# GET CURRENT USER
# ============================================================

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    token = credentials.credentials

    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )

        user_id = payload.get("sub")

        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication token"
            )

        user_id = int(user_id)

    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token"
        )

    db: Session = SessionLocal()

    try:
        user = (
            db.query(User)
            .filter(User.id == user_id)
            .first()
        )

        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User no longer exists"
            )

        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User account is inactive"
            )

        return user

    finally:
        db.close()


# ============================================================
# ADMIN ACCESS
# ============================================================

def require_admin(
    current_user: User = Depends(get_current_user)
):
    if current_user.role.upper() != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator access required"
        )

    return current_user


# ============================================================
# CREATE PASSWORD RESET TOKEN
# ============================================================

def create_password_reset_token(user_id: int):
    """
    Create a secure password-reset token.

    Only the SHA-256 hash is stored in the database.
    The raw token is returned so it can be sent by email.
    The token expires after 30 minutes.
    """

    token = secrets.token_urlsafe(32)

    token_hash = hashlib.sha256(
        token.encode("utf-8")
    ).hexdigest()

    expires_at = datetime.now(timezone.utc) + timedelta(
        minutes=30
    )

    db: Session = SessionLocal()

    try:
        # Invalidate previous unused reset tokens
        db.query(PasswordResetToken).filter(
            PasswordResetToken.user_id == user_id,
            PasswordResetToken.used_at.is_(None)
        ).update({
            PasswordResetToken.used_at: datetime.now(timezone.utc)
        })

        # Create new reset token
        reset_token = PasswordResetToken(
            user_id=user_id,
            token_hash=token_hash,
            expires_at=expires_at
        )

        db.add(reset_token)
        db.commit()

        return token

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()


# ============================================================
# VERIFY PASSWORD RESET TOKEN
# ============================================================

def verify_password_reset_token(token: str):
    """
    Validate a password-reset token.

    Returns the token ID and user ID if valid.
    Returns None if the token is invalid, expired, or already used.
    """

    token_hash = hashlib.sha256(
        token.encode("utf-8")
    ).hexdigest()

    db: Session = SessionLocal()

    try:
        reset_token = (
            db.query(PasswordResetToken)
            .filter(
                PasswordResetToken.token_hash == token_hash,
                PasswordResetToken.used_at.is_(None)
            )
            .first()
        )

        if not reset_token:
            return None

        # Get current UTC time
        now = datetime.now(timezone.utc)

        # Handle timezone-naive database timestamps
        expires_at = reset_token.expires_at

        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(
                tzinfo=timezone.utc
            )

        # Check whether token has expired
        if expires_at <= now:
            reset_token.used_at = now
            db.commit()
            return None

        return {
            "token_id": reset_token.id,
            "user_id": reset_token.user_id
        }

    finally:
        db.close()