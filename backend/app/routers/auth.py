from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    create_mfa_pending_token,
    create_password_reset_token,
    decode_token,
    get_current_user,
)
from app.models.user import User
from app.schemas.auth import (
    UserRegister,
    TokenResponse,
    UserOut,
    MfaRequiredResponse,
    MfaVerifyRequest,
    MfaSetupResponse,
    MfaEnableRequest,
    MfaDisableRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
)
from app.services.audit_service import log_action
from app.services.notification_service import notify
from app.services import mfa_service

router = APIRouter(prefix="/api/auth", tags=["auth"])


# ---------------------------------------------------------
# REGISTER
# ---------------------------------------------------------

@router.post(
    "/register",
    response_model=UserOut,
    status_code=status.HTTP_201_CREATED
)
def register(
    payload: UserRegister,
    db: Session = Depends(get_db)
):
    existing = (
        db.query(User)
        .filter(User.email == payload.email)
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=409,
            detail="Email already registered"
        )

    user = User(
        email=payload.email,
        name=payload.full_name,
        password_hash=hash_password(payload.password),
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    log_action(
        db,
        user_id=user.id,
        action="user.register",
        resource_type="user",
        resource_id=str(user.id),
    )

    db.commit()

    return user


# ---------------------------------------------------------
# LOGIN
# ---------------------------------------------------------

@router.post(
    "/login",
    response_model=TokenResponse
)
def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    ip = request.client.host if request.client else None

    user = (
        db.query(User)
        .filter(User.email == form_data.username)
        .first()
    )

    if not user or not verify_password(
        form_data.password,
        user.password_hash
    ):
        if user:
            log_action(
                db,
                user_id=user.id,
                action="user.login_failed",
                resource_type="user",
                resource_id=str(user.id),
                ip_address=ip,
            )
            db.commit()

        raise HTTPException(
            status_code=401,
            detail="Incorrect email or password"
        )

    access_token = create_access_token(
        subject=str(user.id)
    )

    refresh_token = create_refresh_token(
        subject=str(user.id)
    )

    log_action(
        db,
        user_id=user.id,
        action="user.login",
        resource_type="user",
        resource_id=str(user.id),
        ip_address=ip,
    )

    db.commit()

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
    )


# ---------------------------------------------------------
# MFA VERIFY LOGIN
# ---------------------------------------------------------

@router.post(
    "/mfa/verify-login",
    response_model=TokenResponse
)
def verify_mfa_login(
    payload: MfaVerifyRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Verify an MFA code using a temporary MFA session.
    """

    token_data = decode_token(
        payload.mfa_token
    )

    if token_data.get("type") != "mfa_pending":
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired MFA session"
        )

    user_id = token_data.get("sub")

    user = (
        db.query(User)
        .filter(User.id == user_id)
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=401,
            detail="User not found"
        )

    secret = mfa_service.get_secret(
        str(user.id)
    )

    if not secret or not mfa_service.is_enabled(
        str(user.id)
    ):
        raise HTTPException(
            status_code=401,
            detail="MFA not set up for this account"
        )

    ip = request.client.host if request.client else None

    if not mfa_service.verify_code(
        secret,
        payload.code
    ):
        log_action(
            db,
            user_id=user.id,
            action="security.mfa_code_invalid",
            resource_type="user",
            resource_id=str(user.id),
            ip_address=ip,
        )

        db.commit()

        raise HTTPException(
            status_code=401,
            detail="Invalid MFA code"
        )

    access_token = create_access_token(
        subject=str(user.id)
    )

    refresh_token = create_refresh_token(
        subject=str(user.id)
    )

    log_action(
        db,
        user_id=user.id,
        action="user.login",
        resource_type="user",
        resource_id=str(user.id),
        ip_address=ip,
        detail="mfa",
    )

    db.commit()

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
    )


# ---------------------------------------------------------
# MFA SETUP
# ---------------------------------------------------------

@router.post(
    "/mfa/setup",
    response_model=MfaSetupResponse
)
def mfa_setup(
    current_user: User = Depends(get_current_user),
):
    """
    Generate a temporary MFA secret and QR code.

    The secret is stored only in backend memory.
    The shared database schema is not changed.
    """

    secret = mfa_service.generate_secret()

    mfa_service.save_secret(
        str(current_user.id),
        secret
    )

    uri = mfa_service.get_provisioning_uri(
        secret,
        current_user.email
    )

    return MfaSetupResponse(
        secret=secret,
        qr_code_data_uri=mfa_service.qr_code_data_uri(uri),
        provisioning_uri=uri,
    )


# ---------------------------------------------------------
# MFA ENABLE
# ---------------------------------------------------------

@router.post(
    "/mfa/enable",
    response_model=UserOut
)
def mfa_enable(
    payload: MfaEnableRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Confirm the MFA setup using a valid TOTP code.
    """

    secret = mfa_service.get_secret(
        str(current_user.id)
    )

    if not secret:
        raise HTTPException(
            status_code=400,
            detail="Call /mfa/setup first"
        )

    if not mfa_service.verify_code(
        secret,
        payload.code
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid MFA code"
        )

    mfa_service.enable_mfa(
        str(current_user.id)
    )

    log_action(
        db,
        user_id=current_user.id,
        action="security.mfa_enabled",
        resource_type="user",
        resource_id=str(current_user.id),
    )

    notify(
        db,
        current_user,
        type="security.mfa_enabled",
        title="Two-factor authentication enabled",
        message="MFA is now enabled for this account.",
    )

    db.commit()

    return current_user


# ---------------------------------------------------------
# MFA DISABLE
# ---------------------------------------------------------

@router.post(
    "/mfa/disable",
    response_model=UserOut
)
def mfa_disable(
    payload: MfaDisableRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Disable MFA using a valid TOTP code.
    """

    user_id = str(current_user.id)

    secret = mfa_service.get_secret(user_id)

    if not secret or not mfa_service.is_enabled(user_id):
        raise HTTPException(
            status_code=400,
            detail="MFA is not enabled"
        )

    if not mfa_service.verify_code(
        secret,
        payload.code
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid MFA code"
        )

    mfa_service.disable_mfa(user_id)

    log_action(
        db,
        user_id=current_user.id,
        action="security.mfa_disabled",
        resource_type="user",
        resource_id=user_id,
    )

    db.commit()

    return current_user


# ---------------------------------------------------------
# FORGOT PASSWORD
# ---------------------------------------------------------

@router.post(
    "/forgot-password",
    status_code=200
)
def forgot_password(
    payload: ForgotPasswordRequest,
    db: Session = Depends(get_db)
):
    """
    Request a password reset.

    A generic response is returned whether or not
    the email exists.
    """

    user = (
        db.query(User)
        .filter(User.email == payload.email)
        .first()
    )

    if user:
        reset_token = create_password_reset_token(
            str(user.id)
        )

        log_action(
            db,
            user_id=user.id,
            action="user.password_reset_requested",
            resource_type="user",
            resource_id=str(user.id),
        )

        notify(
            db,
            user,
            type="security.password_reset_requested",
            title="Password reset requested",
            message=(
                "Use this token to reset your password "
                f"(expires in 30 minutes): {reset_token}"
            ),
            also_email=True,
        )

        db.commit()

    return {
        "detail": (
            "If that email is registered, "
            "a password reset link has been sent."
        )
    }


# ---------------------------------------------------------
# RESET PASSWORD
# ---------------------------------------------------------

@router.post(
    "/reset-password",
    status_code=200
)
def reset_password(
    payload: ResetPasswordRequest,
    db: Session = Depends(get_db)
):
    """
    Reset the user's password using a valid reset token.
    """

    token_data = decode_token(
        payload.token
    )

    if token_data.get("type") != "password_reset":
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired reset token"
        )

    user_id = token_data.get("sub")

    user = (
        db.query(User)
        .filter(User.id == user_id)
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired reset token"
        )

    user.password_hash = hash_password(
        payload.new_password
    )

    db.commit()

    log_action(
        db,
        user_id=user.id,
        action="user.password_reset_completed",
        resource_type="user",
        resource_id=str(user.id),
    )

    notify(
        db,
        user,
        type="security.password_changed",
        title="Your password was changed",
        message=(
            "Your TrustShare password was just reset. "
            "If this wasn't you, contact support immediately."
        ),
        also_email=True,
    )

    db.commit()

    return {
        "detail": (
            "Password has been reset successfully. "
            "You can now log in."
        )
    }


# ---------------------------------------------------------
# CURRENT USER
# ---------------------------------------------------------

@router.get(
    "/me",
    response_model=UserOut
)
def me(
    current_user: User = Depends(get_current_user)
):
    return current_user