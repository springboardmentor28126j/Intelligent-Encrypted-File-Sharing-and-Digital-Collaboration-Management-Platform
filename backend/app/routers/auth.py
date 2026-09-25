import hashlib
import logging
import time
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Form, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from starlette.requests import Request

from ..config import settings
from ..database import get_db
from ..models import PasswordResetToken, User
from ..redis_client import redis_conn
from ..schemas.auth import (
    ForgotPasswordRequest,
    LoginRequest,
    LoginResponse,
    MFASetupResponse,
    MFAStatusResponse,
    MFAVerifyRequest,
    RegisterRequest,
    ResetPasswordRequest,
    UserResponse,
    VerifyOTPRequest,
)
from ..services.activity_service import log_activity
from ..services.email_service import send_password_reset_otp
from ..services.mfa_service import (
    build_provisioning_uri,
    generate_mfa_secret,
    verify_totp_code,
)
from ..services.notification_service import create_notification
from ..services.security_service import (
    check_login_lockout,
    record_failed_login,
    reset_failed_login,
)
from ..utils.dependencies import get_current_user
from ..utils.security import (
    create_access_token,
    create_otp,
    create_reset_verification_token,
    get_reset_verification_subject,
    get_token_expiration,
    hash_password,
    hash_reset_token,
    verify_password,
)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])
logger = logging.getLogger(__name__)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token")


def _extract_client_ip(request: Request) -> tuple[str, str | None]:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        ip = forwarded.split(",")[0].strip()
    else:
        ip = request.client.host if request.client else "Unknown"
    ua = request.headers.get("user-agent")
    return ip, ua


@router.post("/register", response_model=UserResponse, status_code=201)
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    if data.password != data.confirm_password:
        raise HTTPException(400, "Passwords do not match")

    if db.query(User).filter(User.email == data.email.lower()).first():
        raise HTTPException(409, "An account with this email already exists")

    user = User(
        name=data.name.strip(),
        email=data.email.lower(),
        password_hash=hash_password(data.password),
        role="user",
        mfa_enabled=False,
        mfa_secret=None,
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return user


@router.post("/login", response_model=LoginResponse)
def login(data: LoginRequest, request: Request, db: Session = Depends(get_db)):
    email = data.email.lower().strip()
    ip_address, user_agent = _extract_client_ip(request)

    # 1. Check for active lockout
    is_locked, lockout_msg, remaining_seconds = check_login_lockout(email)
    if is_locked:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "message": lockout_msg,
                "retry_after_seconds": remaining_seconds,
            },
        )

    user = db.query(User).filter(User.email == email).first()

    if not user or not verify_password(data.password, user.password_hash):
        record_failed_login(db, email, ip_address, user_agent)
        is_locked_now, msg_now, remaining_now = check_login_lockout(email)
        if is_locked_now:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={
                    "message": msg_now,
                    "retry_after_seconds": remaining_now,
                },
            )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if user.mfa_enabled:
        if not verify_totp_code(user.mfa_secret, data.totp_code):
            record_failed_login(db, email, ip_address, user_agent)
            is_locked_now, msg_now, remaining_now = check_login_lockout(email)
            if is_locked_now:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail={
                        "message": msg_now,
                        "retry_after_seconds": remaining_now,
                    },
                )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or missing MFA code",
            )

    # Reset failure counter on successful login
    reset_failed_login(email)
    log_activity(db, user, "login", "Logged in", ip_address=ip_address, user_agent=user_agent)

    return {
        "access_token": create_access_token(user.id),
        "user": user,
    }


@router.post("/token")
def token(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    totp_code: str | None = Form(None),
    db: Session = Depends(get_db),
):
    email = form_data.username.lower().strip()
    ip_address, user_agent = _extract_client_ip(request)

    is_locked, lockout_msg, remaining_seconds = check_login_lockout(email)
    if is_locked:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "message": lockout_msg,
                "retry_after_seconds": remaining_seconds,
            },
        )

    user = db.query(User).filter(User.email == email).first()

    if not user or not verify_password(form_data.password, user.password_hash):
        record_failed_login(db, email, ip_address, user_agent)
        is_locked_now, msg_now, remaining_now = check_login_lockout(email)
        if is_locked_now:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={
                    "message": msg_now,
                    "retry_after_seconds": remaining_now,
                },
            )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if user.mfa_enabled:
        if not verify_totp_code(user.mfa_secret, totp_code):
            record_failed_login(db, email, ip_address, user_agent)
            is_locked_now, msg_now, remaining_now = check_login_lockout(email)
            if is_locked_now:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail={
                        "message": msg_now,
                        "retry_after_seconds": remaining_now,
                    },
                )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or missing MFA code",
            )

    reset_failed_login(email)
    log_activity(db, user, "login", "Logged in through OAuth2", ip_address=ip_address, user_agent=user_agent)

    return {
        "access_token": create_access_token(user.id),
        "token_type": "bearer",
    }


@router.get("/mfa/status", response_model=MFAStatusResponse)
def mfa_status(current_user: User = Depends(get_current_user)):
    return {"mfa_enabled": bool(current_user.mfa_enabled)}


@router.post("/mfa/setup", response_model=MFASetupResponse)
def mfa_setup(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.mfa_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="MFA is already enabled",
        )

    secret = generate_mfa_secret()
    current_user.mfa_secret = secret
    current_user.mfa_enabled = False
    db.commit()
    db.refresh(current_user)

    return {
        "secret": secret,
        "otpauth_uri": build_provisioning_uri(current_user.email, secret),
        "mfa_enabled": False,
    }


@router.post("/mfa/enable", response_model=MFAStatusResponse)
def mfa_enable(
    data: MFAVerifyRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.mfa_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="MFA is already enabled",
        )
    if not current_user.mfa_secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="MFA setup is required before it can be enabled",
        )
    if not verify_totp_code(current_user.mfa_secret, data.totp_code):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid MFA code",
        )

    current_user.mfa_enabled = True
    db.commit()
    log_activity(db, current_user, "mfa_enable", "Enabled authenticator MFA")
    create_notification(
        db=db,
        user_id=current_user.id,
        type="security_alert",
        title="Two-Factor Authentication Enabled",
        message="Two-factor authentication (MFA) was enabled for your account.",
    )
    return {"mfa_enabled": True}


@router.post("/mfa/disable", response_model=MFAStatusResponse)
def mfa_disable(
    data: MFAVerifyRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not current_user.mfa_enabled:
        return {"mfa_enabled": False}
    if not verify_totp_code(current_user.mfa_secret, data.totp_code):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid MFA code",
        )

    current_user.mfa_enabled = False
    current_user.mfa_secret = None
    db.commit()
    log_activity(db, current_user, "mfa_disable", "Disabled authenticator MFA")
    create_notification(
        db=db,
        user_id=current_user.id,
        type="security_alert",
        title="Two-Factor Authentication Disabled",
        message="Two-factor authentication (MFA) was disabled for your account.",
    )
    return {"mfa_enabled": False}


@router.post("/logout")
def logout(token: str = Depends(oauth2_scheme)):
    expiration = get_token_expiration(token)

    if expiration is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    remaining_seconds = expiration - int(time.time())

    if remaining_seconds <= 0:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token is already expired",
        )

    token_hash = hashlib.sha256(token.encode()).hexdigest()

    redis_conn.setex(
        f"blacklist:{token_hash}",
        remaining_seconds,
        "revoked",
    )

    return {
        "message": "Successfully logged out"
    }


@router.post("/forgot-password")
def forgot_password(
    data: ForgotPasswordRequest,
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(
        User.email == data.email.lower()
    ).first()

    response = {
        "message": "If that email exists, an OTP was sent."
    }

    if not user:
        return response

    db.query(PasswordResetToken).filter(
        PasswordResetToken.user_id == user.id,
        PasswordResetToken.used.is_(False),
    ).update(
        {PasswordResetToken.used: True}
    )

    otp = create_otp()

    db.add(
        PasswordResetToken(
            user_id=user.id,
            token_hash=hash_reset_token(otp),
            expires_at=datetime.utcnow()
            + timedelta(minutes=settings.otp_expire_minutes),
        )
    )

    db.commit()

    try:
        send_password_reset_otp(user.email, otp)

    except Exception as error:
        logger.error(
            "Password reset email failed: smtp_host=%s smtp_port=%s "
            "smtp_username=%s exception_type=%s exception_message=%s",
            settings.smtp_host or "<empty>",
            settings.smtp_port,
            settings.smtp_username or "<empty>",
            type(error).__name__,
            str(error),
        )

        raise HTTPException(
            503,
            "Password reset email could not be sent"
        ) from error

    return response


@router.post("/verify-otp")
def verify_otp(
    data: VerifyOTPRequest,
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(
        User.email == data.email.lower()
    ).first()

    reset = db.query(PasswordResetToken).filter(
        PasswordResetToken.user_id == (
            user.id if user else 0
        ),
        PasswordResetToken.token_hash == hash_reset_token(data.otp),
        PasswordResetToken.used.is_(False),
    ).first()

    if not reset or reset.expires_at < datetime.utcnow():
        raise HTTPException(
            400,
            "OTP is invalid or expired"
        )

    reset.used = True
    db.commit()

    return {
        "reset_token": create_reset_verification_token(
            reset.user_id
        )
    }


@router.post("/reset-password")
def reset_password(
    data: ResetPasswordRequest,
    db: Session = Depends(get_db)
):
    user_id = get_reset_verification_subject(data.token)

    user = db.get(User, user_id) if user_id else None

    if not user:
        raise HTTPException(
            400,
            "Reset verification is invalid or expired"
        )

    user.password_hash = hash_password(data.new_password)
    db.commit()
    create_notification(
        db=db,
        user_id=user.id,
        type="security_alert",
        title="Password Reset Successful",
        message="Your account password was successfully reset.",
    )

    return {
        "message": "Password reset successfully"
    }