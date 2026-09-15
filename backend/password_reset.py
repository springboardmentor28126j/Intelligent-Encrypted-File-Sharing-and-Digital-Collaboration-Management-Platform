from datetime import datetime, timedelta, timezone
import secrets
import bcrypt
import os
import smtplib

from email.message import EmailMessage

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from dotenv import load_dotenv

from database import SessionLocal
from models import User


# =========================
# LOAD ENVIRONMENT VARIABLES
# =========================

load_dotenv()


# =========================
# ROUTER
# =========================

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
# SEND RESET EMAIL
# =========================

def send_reset_email(
    recipient_email: str,
    reset_link: str
):

    sender_email = os.getenv(
        "EMAIL_ADDRESS"
    )

    sender_password = os.getenv(
        "EMAIL_APP_PASSWORD"
    )

    # Check email configuration
    if not sender_email:
        raise RuntimeError(
            "EMAIL_ADDRESS is missing in .env"
        )

    if not sender_password:
        raise RuntimeError(
            "EMAIL_APP_PASSWORD is missing in .env"
        )

    # Create email
    message = EmailMessage()

    message["Subject"] = (
        "Trust Share - Reset Your Password"
    )

    message["From"] = sender_email

    message["To"] = recipient_email

    message.set_content(
        f"""
Hello,

We received a request to reset your Trust Share password.

Click the link below to reset your password:

{reset_link}

This password reset link will expire in 15 minutes.

If you did not request a password reset,
you can safely ignore this email.

Regards,

Trust Share Team
"""
    )

    # Connect to Gmail SMTP
    with smtplib.SMTP(
        "smtp.gmail.com",
        587
    ) as server:

        server.starttls()

        # Login using Gmail App Password
        server.login(
            sender_email,
            sender_password
        )

        # Send email
        server.send_message(
            message
        )


# =========================
# FORGOT PASSWORD
# =========================

@router.post("/forgot-password")
def forgot_password(
    request: ForgotPasswordRequest,
    db: Session = Depends(get_db)
):

    # Clean email
    email = request.email.strip()

    # Find user
    user = (
        db.query(User)
        .filter(
            User.email == email
        )
        .first()
    )

    # =========================
    # EMAIL NOT REGISTERED
    # =========================

    if user is None:

        return {
            "success": False,
            "message": (
                "Email address is not registered."
            )
        }

    # =========================
    # GENERATE RESET TOKEN
    # =========================

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

    # =========================
    # CREATE RESET LINK
    # =========================

    reset_link = (
        "http://localhost:3000/reset-password/"
        + reset_token
    )

    # =========================
    # SEND EMAIL
    # =========================

    try:

        send_reset_email(
            user.email,
            reset_link
        )

    except Exception as error:

        print(
            "EMAIL SENDING ERROR:",
            repr(error)
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "Unable to send password reset email."
            )
        )

    # =========================
    # SUCCESS
    # =========================

    print()
    print("==============================")
    print("PASSWORD RESET EMAIL SENT")
    print("==============================")
    print("Email:", user.email)
    print("Reset Link:", reset_link)
    print("Expires:", expires_at)
    print("==============================")
    print()

    return {
        "success": True,
        "message": (
            "Password reset link sent successfully."
        )
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
        .filter(
            User.reset_token == request.token
        )
        .first()
    )

    # =========================
    # INVALID TOKEN
    # =========================

    if user is None:

        raise HTTPException(
            status_code=400,
            detail=(
                "Invalid or expired reset link."
            )
        )

    # =========================
    # CHECK EXPIRATION
    # =========================

    if user.reset_token_expires is None:

        raise HTTPException(
            status_code=400,
            detail=(
                "Invalid or expired reset link."
            )
        )

    now = datetime.now(timezone.utc)

    expires_at = user.reset_token_expires

    # Handle naive datetime
    if expires_at.tzinfo is None:

        expires_at = expires_at.replace(
            tzinfo=timezone.utc
        )

    # Token expired
    if expires_at < now:

        user.reset_token = None

        user.reset_token_expires = None

        db.commit()

        raise HTTPException(
            status_code=400,
            detail="Reset link has expired."
        )

    # =========================
    # PASSWORD VALIDATION
    # =========================

    if len(request.new_password) < 6:

        raise HTTPException(
            status_code=400,
            detail=(
                "Password must be at least 6 characters."
            )
        )

    # =========================
    # HASH NEW PASSWORD
    # =========================

    password_bytes = (
        request.new_password.encode(
            "utf-8"
        )
    )

    hashed_password = bcrypt.hashpw(
        password_bytes,
        bcrypt.gensalt()
    ).decode("utf-8")

    # =========================
    # SAVE NEW PASSWORD
    # =========================

    user.password = hashed_password

    # Make token single-use
    user.reset_token = None

    user.reset_token_expires = None

    db.commit()

    db.refresh(user)

    # =========================
    # SUCCESS
    # =========================

    return {
        "success": True,
        "message": (
            "Password reset successfully."
        )
    }