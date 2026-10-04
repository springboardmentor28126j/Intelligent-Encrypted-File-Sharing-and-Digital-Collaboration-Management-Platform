"""
routers/auth.py – Authentication API endpoints.

Routes:
  POST /register – Create a new user account
  POST /login    – Authenticate and receive a JWT
  POST /logout   – Blacklist the current token in Redis and terminate session
  GET  /me       – Return the currently authenticated user's profile (protected)
"""

from datetime import datetime, timedelta, timezone
import hashlib
import secrets
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.auth import (
    bearer_scheme,
    create_access_token,
    get_current_user,
    hash_password,
    revoke_token,
    verify_password,
)
from app.config import settings
from app.database import get_db
from app.models import PasswordResetToken, User
from app.schemas import (
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    MessageResponse,
    ResetPasswordRequest,
    Token,
    UserCreate,
    UserLogin,
    UserOut,
)
from app.services.audit_service import get_client_ip, get_user_agent, log_audit_event
from app.services.email_service import send_password_reset_email
from app.services.security_service import (
    clear_failed_logins,
    detect_new_ip_access,
    record_failed_login,
)

router = APIRouter(tags=["Authentication"])



# ─── POST /register ───────────────────────────────────────────────────────────

@router.post(
    "/register",
    response_model=UserOut,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user",
    description="Creates a new TrustShare account. Returns 409 if the email is already registered.",
)
def register(
    user_data: UserCreate,
    request: Request,
    db: Session = Depends(get_db),
) -> UserOut:
    existing = db.query(User).filter(User.email == user_data.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"An account with email '{user_data.email}' already exists.",
        )

    hashed = hash_password(user_data.password)

    new_user = User(
        full_name=user_data.full_name,
        email=user_data.email,
        hashed_password=hashed,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    log_audit_event(
        db=db,
        user_id=new_user.id,
        action="register",
        request=request,
        details=f"User account created for {new_user.email}",
        status="success",
    )

    return new_user


# ─── POST /login ──────────────────────────────────────────────────────────────

@router.post(
    "/login",
    response_model=Token,
    summary="Login and receive a JWT access token",
    description="Authenticates with email and password. Returns Bearer JWT.",
)
def login(
    credentials: UserLogin,
    request: Request,
    db: Session = Depends(get_db),
) -> Token:
    ip_addr = get_client_ip(request)
    ua = get_user_agent(request)
    user = db.query(User).filter(User.email == credentials.email).first()

    if not user or not verify_password(credentials.password, user.hashed_password):
        # Record failed login attempt and check for brute-force triggers
        record_failed_login(
            db=db,
            email=credentials.email,
            ip_address=ip_addr,
            user_agent=ua,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Success: clear failed login counter
    clear_failed_logins(email=user.email, ip_address=ip_addr)

    # Detect new IP address
    detect_new_ip_access(db=db, user=user, ip_address=ip_addr, user_agent=ua)

    # Audit log login
    log_audit_event(
        db=db,
        user_id=user.id,
        action="login",
        ip_address=ip_addr,
        user_agent=ua,
        details=f"User {user.email} authenticated successfully",
        status="success",
    )

    access_token = create_access_token(data={"sub": user.email})
    return Token(access_token=access_token, token_type="bearer")


# ─── POST /logout ─────────────────────────────────────────────────────────────

@router.post(
    "/logout",
    response_model=MessageResponse,
    summary="Log out and revoke JWT session in Redis",
    description="Revokes the active JWT token by adding it to Redis blacklist.",
)
def logout(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageResponse:
    token = credentials.credentials
    revoke_token(token)

    log_audit_event(
        db=db,
        user_id=current_user.id,
        action="logout",
        request=request,
        details=f"User {current_user.email} logged out",
        status="success",
    )

    return MessageResponse(message="Successfully logged out and session revoked.")


# ─── GET /me ──────────────────────────────────────────────────────────────────

@router.get(
    "/me",
    response_model=UserOut,
    summary="Get current user profile",
    description="Returns profile of authenticated user.",
)
def get_me(current_user: User = Depends(get_current_user)) -> UserOut:
    return current_user


# ─── POST /forgot-password ────────────────────────────────────────────────────

@router.post(
    "/forgot-password",
    response_model=ForgotPasswordResponse,
    summary="Request a secure password reset email",
    description="Verifies user email, generates single-use reset token (15-30m expiry), and sends email with reset link.",
)
def forgot_password(
    payload: ForgotPasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> ForgotPasswordResponse:
    ip_addr = get_client_ip(request)
    ua = get_user_agent(request)
    email_clean = payload.email.lower().strip()

    user = db.query(User).filter(User.email == email_clean).first()
    if not user:
        # Prevent email enumeration: return generic message and audit non-existent attempt
        log_audit_event(
            db=db,
            user_id=None,
            action="forgot_password_unknown_email",
            ip_address=ip_addr,
            user_agent=ua,
            details=f"Forgot password requested for non-existent email: {email_clean}",
            status="warning",
        )
        return ForgotPasswordResponse(
            message="If your email is registered with TrustShare, you will receive a password reset link shortly.",
            email_sent=True,
            delivery_status="sent",
        )

    # Invalidate previous unused reset tokens for this user
    db.query(PasswordResetToken).filter(
        PasswordResetToken.user_id == user.id,
        PasswordResetToken.used == False,
    ).update({"used": True})

    # Generate high-entropy 32-byte URL-safe token
    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()

    expiry_minutes = getattr(settings, "PASSWORD_RESET_EXPIRE_MINUTES", 30)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=expiry_minutes)

    reset_record = PasswordResetToken(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=expires_at,
        used=False,
        created_at=datetime.now(timezone.utc),
    )
    db.add(reset_record)
    db.commit()
    db.refresh(reset_record)

    # Build reset URL
    frontend_base = getattr(settings, "FRONTEND_URL", "http://localhost:3000").rstrip("/")
    reset_url = f"{frontend_base}/reset-password?token={raw_token}"

    # Dispatch email
    delivery = send_password_reset_email(
        to_email=user.email,
        reset_url=reset_url,
        expires_minutes=expiry_minutes,
    )

    log_audit_event(
        db=db,
        user_id=user.id,
        action="forgot_password_requested",
        ip_address=ip_addr,
        user_agent=ua,
        details=f"Password reset token issued for {user.email} (Provider: {delivery.provider}, Success: {delivery.success})",
        status="success" if delivery.success else "warning",
    )

    return ForgotPasswordResponse(
        message="If your email is registered with TrustShare, you will receive a password reset link shortly.",
        email_sent=delivery.success,
        delivery_status=f"Dispatched via {delivery.provider}" if delivery.success else f"Delivery error: {delivery.error}",
    )


# ─── POST /reset-password ─────────────────────────────────────────────────────

@router.post(
    "/reset-password",
    response_model=MessageResponse,
    summary="Complete password reset using secure token",
    description="Validates single-use token, verifies expiry, updates password with bcrypt hash, and invalidates token.",
)
def reset_password(
    payload: ResetPasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> MessageResponse:
    ip_addr = get_client_ip(request)
    ua = get_user_agent(request)

    token_hash = hashlib.sha256(payload.token.strip().encode("utf-8")).hexdigest()
    record = (
        db.query(PasswordResetToken)
        .filter(PasswordResetToken.token_hash == token_hash)
        .first()
    )

    if not record:
        log_audit_event(
            db=db,
            user_id=None,
            action="reset_password_invalid_token",
            ip_address=ip_addr,
            user_agent=ua,
            details="Password reset attempted with non-existent or invalid token.",
            status="failed",
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or unrecognized password reset token.",
        )

    if record.used:
        log_audit_event(
            db=db,
            user_id=record.user_id,
            action="reset_password_token_reused",
            ip_address=ip_addr,
            user_agent=ua,
            details="Password reset attempted with already-used token.",
            status="failed",
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This password reset link has already been used. Please request a new one.",
        )

    # Check expiration
    now = datetime.now(timezone.utc)
    record_exp = record.expires_at
    if record_exp.tzinfo is None:
        record_exp = record_exp.replace(tzinfo=timezone.utc)

    if now > record_exp:
        log_audit_event(
            db=db,
            user_id=record.user_id,
            action="reset_password_token_expired",
            ip_address=ip_addr,
            user_agent=ua,
            details="Password reset attempted with expired token.",
            status="failed",
        )
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="This password reset link has expired. Please request a new one.",
        )

    # Update user password
    user = db.query(User).filter(User.id == record.user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User account associated with this token was not found.",
        )

    new_hash = hash_password(payload.new_password)
    user.hashed_password = new_hash
    record.used = True
    db.commit()

    log_audit_event(
        db=db,
        user_id=user.id,
        action="password_reset_completed",
        ip_address=ip_addr,
        user_agent=ua,
        details=f"Password successfully reset for user {user.email}",
        status="success",
    )

    return MessageResponse(
        message="Your password has been successfully reset. You may now log in with your new password.",
        success=True,
    )


