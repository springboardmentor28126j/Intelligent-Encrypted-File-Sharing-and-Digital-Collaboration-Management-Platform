from datetime import datetime, timedelta, timezone

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
)
from app.services.audit_service import log_action
from app.services.notification_service import notify
from app.services import mfa_service

router = APIRouter(prefix="/api/auth", tags=["auth"])

# --- Access monitoring / suspicious activity thresholds ---
MAX_FAILED_ATTEMPTS = 5
LOCKOUT_MINUTES = 15


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(payload: UserRegister, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    user = User(
        email=payload.email,
        full_name=payload.full_name,
        hashed_password=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    log_action(db, user_id=user.id, action="user.register", resource_type="user", resource_id=str(user.id))
    return user


@router.post("/login", response_model=None)
def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    ip = request.client.host if request.client else None
    user = db.query(User).filter(User.email == form_data.username).first()

    # --- Suspicious activity / lockout check ---
    if user and user.locked_until:
        locked_until = user.locked_until.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) < locked_until:
            log_action(
                db, user_id=user.id, action="security.login_blocked_locked_account",
                resource_type="user", resource_id=str(user.id), ip_address=ip,
            )
            raise HTTPException(
                status_code=403,
                detail=f"Account temporarily locked due to repeated failed logins. "
                       f"Try again after {locked_until.strftime('%H:%M:%S UTC')}.",
            )

    if not user or not verify_password(form_data.password, user.hashed_password):
        if user:
            user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
            log_action(
                db, user_id=user.id, action="user.login_failed",
                resource_type="user", resource_id=str(user.id), ip_address=ip,
                detail=f"attempt {user.failed_login_attempts}",
            )
            if user.failed_login_attempts >= MAX_FAILED_ATTEMPTS:
                user.locked_until = datetime.now(timezone.utc) + timedelta(minutes=LOCKOUT_MINUTES)
                log_action(
                    db, user_id=user.id, action="security.account_locked",
                    resource_type="user", resource_id=str(user.id), ip_address=ip,
                    detail=f"{MAX_FAILED_ATTEMPTS} failed attempts",
                )
                notify(
                    db, user, type="security.account_locked",
                    title="Account temporarily locked",
                    message=f"Your account was locked for {LOCKOUT_MINUTES} minutes after "
                             f"{MAX_FAILED_ATTEMPTS} failed login attempts. If this wasn't you, "
                             f"consider changing your password once unlocked.",
                    also_email=True,
                )
            db.commit()
        raise HTTPException(status_code=401, detail="Incorrect email or password")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account disabled")

    # --- Password correct. If MFA is enabled, stop here and require a TOTP code. ---
    if user.mfa_enabled:
        log_action(
            db, user_id=user.id, action="user.login_password_ok_awaiting_mfa",
            resource_type="user", resource_id=str(user.id), ip_address=ip,
        )
        return MfaRequiredResponse(mfa_token=create_mfa_pending_token(str(user.id)))

    # --- Successful login (no MFA): reset failure counter, record login metadata ---
    user.failed_login_attempts = 0
    user.locked_until = None
    user.last_login_at = datetime.now(timezone.utc)
    user.last_login_ip = ip
    db.commit()

    access_token = create_access_token(subject=str(user.id))
    refresh_token = create_refresh_token(subject=str(user.id))
    log_action(
        db, user_id=user.id, action="user.login",
        resource_type="user", resource_id=str(user.id), ip_address=ip,
    )
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/mfa/verify-login", response_model=TokenResponse)
def verify_mfa_login(payload: MfaVerifyRequest, request: Request, db: Session = Depends(get_db)):
    """Step 2 of login when MFA is enabled: exchange mfa_token + TOTP code for real tokens."""
    token_data = decode_token(payload.mfa_token)
    if token_data.get("type") != "mfa_pending":
        raise HTTPException(status_code=401, detail="Invalid or expired MFA session")

    user = db.query(User).filter(User.id == int(token_data["sub"])).first()
    if not user or not user.mfa_enabled or not user.mfa_secret:
        raise HTTPException(status_code=401, detail="MFA not set up for this account")

    ip = request.client.host if request.client else None
    if not mfa_service.verify_code(user.mfa_secret, payload.code):
        log_action(
            db, user_id=user.id, action="security.mfa_code_invalid",
            resource_type="user", resource_id=str(user.id), ip_address=ip,
        )
        raise HTTPException(status_code=401, detail="Invalid MFA code")

    user.failed_login_attempts = 0
    user.locked_until = None
    user.last_login_at = datetime.now(timezone.utc)
    user.last_login_ip = ip
    db.commit()

    access_token = create_access_token(subject=str(user.id))
    refresh_token = create_refresh_token(subject=str(user.id))
    log_action(
        db, user_id=user.id, action="user.login", resource_type="user",
        resource_id=str(user.id), ip_address=ip, detail="mfa",
    )
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/mfa/setup", response_model=MfaSetupResponse)
def mfa_setup(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Step 1 of enabling MFA: generate a secret + QR code. The secret is stored
    but MFA is NOT yet enforced until /mfa/enable confirms the user can
    actually generate a valid code (proves they scanned it correctly).
    """
    secret = mfa_service.generate_secret()
    current_user.mfa_secret = secret
    db.commit()

    uri = mfa_service.get_provisioning_uri(secret, current_user.email)
    return MfaSetupResponse(
        secret=secret,
        qr_code_data_uri=mfa_service.qr_code_data_uri(uri),
        provisioning_uri=uri,
    )


@router.post("/mfa/enable", response_model=UserOut)
def mfa_enable(
    payload: MfaEnableRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not current_user.mfa_secret:
        raise HTTPException(status_code=400, detail="Call /mfa/setup first")
    if not mfa_service.verify_code(current_user.mfa_secret, payload.code):
        raise HTTPException(status_code=401, detail="Invalid MFA code")

    current_user.mfa_enabled = True
    db.commit()
    db.refresh(current_user)
    log_action(db, user_id=current_user.id, action="security.mfa_enabled",
               resource_type="user", resource_id=str(current_user.id))
    notify(
        db, current_user, type="security.mfa_enabled",
        title="Two-factor authentication enabled",
        message="MFA is now required on every login for your account.",
    )
    return current_user


@router.post("/mfa/disable", response_model=UserOut)
def mfa_disable(
    payload: MfaDisableRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not current_user.mfa_enabled or not current_user.mfa_secret:
        raise HTTPException(status_code=400, detail="MFA is not enabled")
    if not mfa_service.verify_code(current_user.mfa_secret, payload.code):
        raise HTTPException(status_code=401, detail="Invalid MFA code")

    current_user.mfa_enabled = False
    current_user.mfa_secret = None
    db.commit()
    db.refresh(current_user)
    log_action(db, user_id=current_user.id, action="security.mfa_disabled",
               resource_type="user", resource_id=str(current_user.id))
    return current_user


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return current_user
