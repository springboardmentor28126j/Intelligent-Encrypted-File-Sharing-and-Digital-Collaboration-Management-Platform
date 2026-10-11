from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database.connection import engine
from models.user import User
from passlib.context import CryptContext
from auth_utils import create_access_token, verify_access_token
from activity_logger import log_activity
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from notification_logger import create_notification

from fastapi_mail import FastMail, MessageSchema, ConnectionConfig
from pydantic_settings import BaseSettings

import secrets
from datetime import datetime, timedelta

import io
import base64
import pyotp
import qrcode

from datetime import datetime, timedelta


router = APIRouter()

security = HTTPBearer()

pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto"
)


# =========================================================
# EMAIL CONFIGURATION
# =========================================================

class MailSettings(BaseSettings):
    MAIL_USERNAME: str
    MAIL_PASSWORD: str
    MAIL_FROM: str

    class Config:
        env_file = ".env"
        extra = "ignore"


mail_settings = MailSettings()


print("======================================")
print("MAIL_USERNAME:", mail_settings.MAIL_USERNAME)
print("MAIL_FROM:", mail_settings.MAIL_FROM)
print("MAIL_PASSWORD loaded:", bool(mail_settings.MAIL_PASSWORD))
print("======================================")


conf = ConnectionConfig(
    MAIL_USERNAME=mail_settings.MAIL_USERNAME,
    MAIL_PASSWORD=mail_settings.MAIL_PASSWORD,
    MAIL_FROM=mail_settings.MAIL_FROM,
    MAIL_PORT=587,
    MAIL_SERVER="smtp.gmail.com",
    MAIL_STARTTLS=True,
    MAIL_SSL_TLS=False,
    USE_CREDENTIALS=True,
)


# =========================================================
# PASSWORD RESET TOKENS
# =========================================================

reset_tokens = {}


# =========================================================
# REGISTER
# =========================================================

class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str


@router.post("/register")
def register(user: RegisterRequest):

    db = Session(bind=engine)

    existing_email = db.query(User).filter(
        User.email == user.email
    ).first()

    if existing_email:
        db.close()
        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )

    existing_username = db.query(User).filter(
        User.username == user.username
    ).first()

    if existing_username:
        db.close()
        raise HTTPException(
            status_code=400,
            detail="Username already registered"
        )

    hashed_password = pwd_context.hash(user.password)

    new_user = User(
        username=user.username,
        email=user.email,
        password=hashed_password
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    db.close()

    return {
        "message": "User registered successfully",
        "username": new_user.username,
        "email": new_user.email
    }

# =========================================================
# LOGIN
# =========================================================

class LoginRequest(BaseModel):
    email: str
    password: str


@router.post("/login")
def login(user: LoginRequest):
    db = Session(bind=engine)

    existing_user = db.query(User).filter(
        User.email == user.email
    ).first()

    # -----------------------------------------------------
    # Email not found
    # -----------------------------------------------------
    if not existing_user:
        log_activity(
            action="LOGIN_FAILED",
            user_id=None,
            user_email=user.email,
            details="Login failed: email not found"
        )

        db.close()

        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    # -----------------------------------------------------
    # Password incorrect
    # -----------------------------------------------------
    if not pwd_context.verify(
        user.password,
        existing_user.password
    ):
        log_activity(
            action="LOGIN_FAILED",
            user_id=existing_user.id,
            user_email=existing_user.email,
            details="Login failed: incorrect password"
        )

        create_notification(
            user_id=existing_user.id,
            title="Login Failed",
            message="A failed login attempt was detected for your account.",
            notification_type="SECURITY_ALERT"
        )

        db.close()

        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    # -----------------------------------------------------
    # MFA ENABLED
    # -----------------------------------------------------
    if existing_user.mfa_enabled:
        mfa_token = create_access_token(
            data={
                "user_id": existing_user.id,
                "email": existing_user.email,
                "mfa_pending": True
            },
            expires_minutes=5
        )

        username = existing_user.username
        email = existing_user.email

        db.close()

        return {
            "message": "MFA verification required",
            "mfa_required": True,
            "mfa_token": mfa_token,
            "username": username,
            "email": email
        }

    # -----------------------------------------------------
    # MFA NOT ENABLED
    # -----------------------------------------------------
    access_token = create_access_token(
        data={
            "user_id": existing_user.id,
            "email": existing_user.email
        }
    )

    log_activity(
        action="LOGIN_SUCCESS",
        user_id=existing_user.id,
        user_email=existing_user.email,
        details="User logged in successfully"
    )

    username = existing_user.username
    email = existing_user.email

    db.close()

    return {
        "message": "Login successful",
        "mfa_required": False,
        "access_token": access_token,
        "username": username,
        "email": email
    }




# =========================================================
# MULTI-FACTOR AUTHENTICATION (MFA)
# =========================================================

class MFAVerifyRequest(BaseModel):
    otp: str


@router.post("/mfa/setup")
def setup_mfa(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    token = credentials.credentials

    payload = verify_access_token(token)

    if not payload:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token"
        )

    user_id = payload.get("user_id")

    db = Session(bind=engine)

    user = db.query(User).filter(
        User.id == user_id
    ).first()

    if not user:
        db.close()
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    # Generate a fresh TOTP secret
    secret = pyotp.random_base32()

    # Store secret but do not enable MFA yet
    user.mfa_secret = secret
    user.mfa_enabled = False

    db.commit()

    email = user.email

    # Create authenticator URI
    totp = pyotp.TOTP(secret)

    provisioning_uri = totp.provisioning_uri(
        name=email,
        issuer_name="TrustShare"
    )

    # Generate QR code
    qr = qrcode.QRCode(
        version=1,
        box_size=10,
        border=4
    )

    qr.add_data(provisioning_uri)
    qr.make(fit=True)

    qr_image = qr.make_image()

    buffer = io.BytesIO()

    qr_image.save(
        buffer,
        format="PNG"
    )

    qr_base64 = base64.b64encode(
        buffer.getvalue()
    ).decode("utf-8")

    db.close()

    return {
        "message": "MFA setup initiated",
        "qr_code": f"data:image/png;base64,{qr_base64}",
        "secret": secret,
        "otpauth_url": provisioning_uri
    }


@router.post("/mfa/verify-setup")
def verify_mfa_setup(
    request: MFAVerifyRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    token = credentials.credentials

    payload = verify_access_token(token)

    if not payload:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token"
        )

    user_id = payload.get("user_id")

    db = Session(bind=engine)

    user = db.query(User).filter(
        User.id == user_id
    ).first()

    if not user:
        db.close()
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    if not user.mfa_secret:
        db.close()
        raise HTTPException(
            status_code=400,
            detail="MFA setup has not been initiated"
        )

    # Verify the 6-digit authenticator code
    totp = pyotp.TOTP(user.mfa_secret)

    if not totp.verify(
        request.otp,
        valid_window=1
    ):
        db.close()

        create_notification(
            user_id=user.id,
            title="MFA Setup Failed",
            message="An incorrect MFA verification code was entered.",
            notification_type="SECURITY_ALERT"
        )

        raise HTTPException(
            status_code=400,
            detail="Invalid MFA verification code"
        )

    # MFA successfully verified
    user.mfa_enabled = True

    db.commit()

    log_activity(
        action="MFA_ENABLED",
        user_id=user.id,
        user_email=user.email,
        details="Two-factor authentication enabled successfully"
    )

    create_notification(
        user_id=user.id,
        title="MFA Enabled",
        message="Two-factor authentication has been enabled on your TrustShare account.",
        notification_type="SECURITY_ALERT"
    )

    db.close()

    return {
        "message": "MFA enabled successfully",
        "mfa_enabled": True
    }


@router.post("/mfa/disable")
def disable_mfa(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    token = credentials.credentials

    payload = verify_access_token(token)

    if not payload:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token"
        )

    user_id = payload.get("user_id")

    db = Session(bind=engine)

    user = db.query(User).filter(
        User.id == user_id
    ).first()

    if not user:
        db.close()
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    user.mfa_enabled = False
    user.mfa_secret = None

    db.commit()

    log_activity(
        action="MFA_DISABLED",
        user_id=user.id,
        user_email=user.email,
        details="Two-factor authentication disabled"
    )

    create_notification(
        user_id=user.id,
        title="MFA Disabled",
        message="Two-factor authentication has been disabled on your TrustShare account.",
        notification_type="SECURITY_ALERT"
    )

    db.close()

    return {
        "message": "MFA disabled successfully",
        "mfa_enabled": False
    }
# =========================================================
# MFA LOGIN VERIFICATION
# =========================================================

@router.post("/mfa/verify-login")
def verify_mfa_login(
    request: MFAVerifyRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    # Get MFA challenge token
    mfa_token = credentials.credentials

    # Verify the short-lived MFA token
    payload = verify_access_token(mfa_token)

    if not payload:
        raise HTTPException(
            status_code=401,
            detail="MFA session expired. Please log in again."
        )

    # Make sure this is an MFA challenge token
    if payload.get("mfa_pending") is not True:
        raise HTTPException(
            status_code=401,
            detail="Invalid MFA challenge token"
        )

    user_id = payload.get("user_id")

    if not user_id:
        raise HTTPException(
            status_code=401,
            detail="Invalid MFA challenge"
        )

    db = Session(bind=engine)

    user = db.query(User).filter(
        User.id == user_id
    ).first()

    if not user:
        db.close()

        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    # Make sure MFA is enabled
    if not user.mfa_enabled or not user.mfa_secret:
        db.close()

        raise HTTPException(
            status_code=400,
            detail="MFA is not enabled for this account"
        )

    # Verify 6-digit authenticator code
    totp = pyotp.TOTP(user.mfa_secret)

    if not totp.verify(
        request.otp,
        valid_window=1
    ):
        log_activity(
            action="MFA_LOGIN_FAILED",
            user_id=user.id,
            user_email=user.email,
            details="Incorrect MFA verification code during login"
        )

        create_notification(
            user_id=user.id,
            title="MFA Login Failed",
            message="An incorrect MFA verification code was entered during login.",
            notification_type="SECURITY_ALERT"
        )

        db.close()

        raise HTTPException(
            status_code=401,
            detail="Invalid MFA verification code"
        )

    # MFA verification successful
    access_token = create_access_token(
        data={
            "user_id": user.id,
            "email": user.email
        }
    )

    log_activity(
        action="MFA_LOGIN_SUCCESS",
        user_id=user.id,
        user_email=user.email,
        details="MFA verification completed successfully"
    )

    create_notification(
        user_id=user.id,
        title="MFA Login Successful",
        message="Two-factor authentication was successfully verified during login.",
        notification_type="SECURITY_ALERT"
    )

    username = user.username
    email = user.email

    db.close()

    return {
        "message": "MFA verification successful",
        "access_token": access_token,
        "username": username,
        "email": email
    }

# =========================================================
# CURRENT USER
# =========================================================

@router.get("/me")
def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    token = credentials.credentials

    payload = verify_access_token(token)

    if not payload:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token"
        )

    user_id = payload.get("user_id")

    db = Session(bind=engine)

    try:
        user = db.query(User).filter(
            User.id == user_id
        ).first()

        if not user:
            raise HTTPException(
                status_code=404,
                detail="User not found"
            )

        return {
            "message": "Authenticated user",
            "user_id": user.id,
            "email": user.email,
            "username": user.username,
            "mfa_enabled": bool(user.mfa_enabled)
        }

    finally:
        db.close()


# =========================================================
# FORGOT PASSWORD
# =========================================================

class ForgotPasswordRequest(BaseModel):
    email: str


@router.post("/forgot-password")
async def forgot_password(
    request: ForgotPasswordRequest
):

    print("--------------------------------------")
    print("Password reset requested for:", request.email)

    db = Session(bind=engine)

    user = db.query(User).filter(
        User.email == request.email
    ).first()

    db.close()

    # Don't reveal whether account exists
    if not user:
        print("No account found for this email")

        return {
            "message": (
                "If an account exists with this email, "
                "a password reset link has been sent."
            )
        }

    print("User found:", user.username)

    # -----------------------------------------------------
    # Generate secure reset token
    # -----------------------------------------------------

    token = secrets.token_urlsafe(32)

    expires_at = datetime.utcnow() + timedelta(minutes=15)

    reset_tokens[token] = {
        "user_id": user.id,
        "email": user.email,
        "expires_at": expires_at
    }

    # -----------------------------------------------------
    # Reset URL
    # -----------------------------------------------------

    reset_link = (
        f"http://localhost:5173/reset-password?token={token}"
    )

    print("Reset link generated:")
    print(reset_link)

    # -----------------------------------------------------
    # Email
    # -----------------------------------------------------

    message = MessageSchema(
        subject="TrustShare - Reset Your Password",
        recipients=[user.email],
        body=f"""
Hello {user.username},

We received a request to reset your TrustShare password.

Click the link below to create a new password:

{reset_link}

This link will expire in 15 minutes.

If you did not request a password reset, you can safely ignore this email.

For your security, do not share this link with anyone.

Regards,
TrustShare Security Team
""",
        subtype="plain"
    )

    try:

        print("Connecting to Gmail SMTP...")
        print("Sending password reset email...")

        fm = FastMail(conf)

        await fm.send_message(message)

        print("EMAIL SENT SUCCESSFULLY")
        print("--------------------------------------")

    except Exception as e:

        print("======================================")
        print("EMAIL SENDING FAILED")
        print("ERROR TYPE:", type(e).__name__)
        print("ERROR:", str(e))
        print("======================================")

        # Remove token because email was not sent
        reset_tokens.pop(token, None)

        raise HTTPException(
            status_code=500,
            detail="Unable to send password reset email"
        )

    return {
        "message": (
            "If an account exists with this email, "
            "a password reset link has been sent."
        )
    }


# =========================================================
# RESET PASSWORD
# =========================================================

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


@router.post("/reset-password")
def reset_password(
    request: ResetPasswordRequest
):

    reset_data = reset_tokens.get(request.token)

    if not reset_data:
        raise HTTPException(
            status_code=400,
            detail="Invalid or expired reset link"
        )

    # -----------------------------------------------------
    # Check expiration
    # -----------------------------------------------------

    if datetime.utcnow() > reset_data["expires_at"]:

        del reset_tokens[request.token]

        raise HTTPException(
            status_code=400,
            detail="Reset link has expired"
        )

    # -----------------------------------------------------
    # Validate password
    # -----------------------------------------------------

    if len(request.new_password) < 6:

        raise HTTPException(
            status_code=400,
            detail="Password must contain at least 6 characters"
        )

    # -----------------------------------------------------
    # Find user
    # -----------------------------------------------------

    db = Session(bind=engine)

    user = db.query(User).filter(
        User.id == reset_data["user_id"]
    ).first()

    if not user:

        db.close()

        reset_tokens.pop(request.token, None)

        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    # -----------------------------------------------------
    # Update password
    # -----------------------------------------------------

    user.password = pwd_context.hash(
        request.new_password
    )

    db.commit()
    db.close()

    # -----------------------------------------------------
    # Prevent token reuse
    # -----------------------------------------------------

    del reset_tokens[request.token]

    return {
        "message": (
            "Password reset successfully. "
            "You can now sign in."
        )
    }