from datetime import datetime, timedelta, timezone
import secrets
import bcrypt

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import SessionLocal
from models import User


router = APIRouter(
    prefix="/auth",
    tags=["Password Reset"]
)


# =========================
# DATABASE CONNECTION
# =========================

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# =========================
# REQUEST MODELS
# =========================

class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


# =========================
# FORGOT PASSWORD
# =========================

@router.post("/forgot-password")
def forgot_password(
    request: ForgotPasswordRequest,
    db: Session = Depends(get_db)
):
    user = (
        db.query(User)
        .filter(User.email == request.email)
        .first()
    )

    # Do not reveal whether an email exists
    if user is None:
        return {
            "message": (
                "If the email is registered, "
                "a reset link has been sent."
            )
        }

    # Generate secure token
    reset_token = secrets.token_urlsafe(32)

    # Token expires after 15 minutes
    expires_at = (
        datetime.now(timezone.utc)
        + timedelta(minutes=15)
    )

    # Save token
    user.reset_token = reset_token
    user.reset_token_expires = expires_at

    db.commit()
    db.refresh(user)

    # Create frontend reset link
    reset_link = (
        "http://localhost:3000/reset-password/"
        + reset_token
    )

    # Temporary development output
    print()
    print("==============================")
    print("PASSWORD RESET REQUEST")
    print("==============================")
    print("Email:", user.email)
    print("Reset Link:", reset_link)
    print("Expires:", expires_at)
    print("==============================")
    print()

    return {
        "message": (
            "If the email is registered, "
            "a reset link has been sent."
        ),
        "reset_link": reset_link
    }


# =========================
# RESET PASSWORD
# =========================

@router.post("/reset-password")
def reset_password(
    request: ResetPasswordRequest,
    db: Session = Depends(get_db)
):
    # Find user using reset token
    user = (
        db.query(User)
        .filter(User.reset_token == request.token)
        .first()
    )

    # Token does not exist
    if user is None:
        raise HTTPException(
            status_code=400,
            detail="Invalid or expired reset link."
        )

    # Check token expiration
    if user.reset_token_expires is None:
        raise HTTPException(
            status_code=400,
            detail="Invalid or expired reset link."
        )

    now = datetime.now(timezone.utc)

    # Handle databases that return a naive datetime
    expires_at = user.reset_token_expires

    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(
            tzinfo=timezone.utc
        )

    if expires_at < now:
        # Remove expired token
        user.reset_token = None
        user.reset_token_expires = None

        db.commit()

        raise HTTPException(
            status_code=400,
            detail="Reset link has expired."
        )

    # Validate password
    if len(request.new_password) < 6:
        raise HTTPException(
            status_code=400,
            detail="Password must be at least 6 characters."
        )

    # =========================
    # HASH NEW PASSWORD
    # =========================

    password_bytes = request.new_password.encode(
        "utf-8"
    )

    hashed_password = bcrypt.hashpw(
        password_bytes,
        bcrypt.gensalt()
    ).decode("utf-8")

    # Save new password
    user.password = hashed_password

    # Make reset token single-use
    user.reset_token = None
    user.reset_token_expires = None

    db.commit()
    db.refresh(user)

    return {
        "message": "Password reset successfully."
    }