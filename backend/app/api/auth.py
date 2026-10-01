import secrets
import smtplib
from datetime import datetime, timezone
from email.message import EmailMessage
from urllib.parse import urlencode

import httpx
import pyotp
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_active_user
from app.core.config import settings
from app.core.database import get_db
from app.core.redis import get_redis_client
from app.core.security import (
    generate_mfa_secret,
    get_mfa_uri,
    hash_identifier,
    hash_password,
    verify_mfa_code,
)
from app.models.collaboration import PasswordResetToken, UserSession
from app.models.user import User
from app.schemas.auth import *
from app.services.audit import log_activity
from app.services.auth import (
    authenticate_user,
    create_reset_token,
    create_session,
    register_user,
    revoke_all_sessions,
    revoke_session,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])

def _send_reset_email(email: str, token: str) -> None:
    if not all([settings.SMTP_HOST, settings.SMTP_USERNAME, settings.SMTP_PASSWORD, settings.SMTP_FROM]): 
        return
    
    # Explicit type narrowing for static analyzer
    host: str = settings.SMTP_HOST  # type: ignore[assignment]
    
    msg = EmailMessage()
    msg["Subject"] = "TrustShare password reset"
    msg["From"] = settings.SMTP_FROM
    msg["To"] = email
    msg.set_content(
        f"Reset your TrustShare password: {settings.FRONTEND_URL}/reset-password?token={token}\n"
        f"This link expires in {settings.PASSWORD_RESET_EXPIRE_MINUTES} minutes."
    )
    with smtplib.SMTP(host, settings.SMTP_PORT) as server:
        server.starttls()
        server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD) # type: ignore[arg-type]
        server.send_message(msg)

def _send_mfa_email(email: str, code: str) -> None:
    if not all([settings.SMTP_HOST, settings.SMTP_USERNAME, settings.SMTP_PASSWORD, settings.SMTP_FROM]): 
        print("[SMTP ERROR] SMTP configurations are missing in .env")
        return
    
    host: str = settings.SMTP_HOST  # type: ignore[assignment]
    
    msg = EmailMessage()
    msg["Subject"] = "Your TrustShare Security Verification Code"
    msg["From"] = settings.SMTP_FROM
    msg["To"] = email
    msg.set_content(
        f"Your TrustShare MFA verification code is: {code}\n\n"
        f"Enter this 6-digit code on the settings page to complete setting up Multi-Factor Authentication."
    )
    with smtplib.SMTP(host, settings.SMTP_PORT) as server:
        server.starttls()
        server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD) # type: ignore[arg-type]
        server.send_message(msg)

@router.post("/register", response_model=UserResponse, status_code=201)
def register(user_data: UserCreate, db: Session = Depends(get_db)):
    try: return register_user(db, user_data)
    except ValueError as exc: raise HTTPException(400, str(exc)) from exc

@router.post("/login", response_model=TokenResponse | MFARequiredResponse)
def login(login_data: LoginRequest, request: Request, db: Session = Depends(get_db)):
    user = authenticate_user(db, login_data.email, login_data.password)
    if not user:
        log_activity(
            "LOGIN",
            None,
            status="failed",
            ip=request.client.host if request.client else None,
            details={"email": login_data.email},
        )
        raise HTTPException(401, "Invalid email or password")

    if not user.is_active:
        raise HTTPException(403, "Account is inactive")

    if user.mfa_enabled:
        # Step 1: User provided valid credentials, but no MFA code yet
        if not login_data.mfa_code:
            if user.mfa_secret:
                code = pyotp.TOTP(user.mfa_secret).now()
                try:
                    _send_mfa_email(user.email, code)
                except Exception as exc:
                    print(f"[SMTP ERROR] Failed to send MFA login email: {str(exc)}")
            return MFARequiredResponse()

        # Step 2: User submitted their MFA code, verify it
        if not user.mfa_secret or not verify_mfa_code(user.mfa_secret, login_data.mfa_code):
            log_activity(
                "LOGIN",
                user.id,
                status="failed",
                ip=request.client.host if request.client else None,
                details={"reason": "invalid_mfa"},
            )
            raise HTTPException(401, "Invalid MFA code")

    token, _ = create_session(
        db,
        user,
        request.headers.get("user-agent"),
        request.client.host if request.client else None,
    )
    log_activity("LOGIN", user.id, ip=request.client.host if request.client else None)
    return TokenResponse(
        access_token=token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )

@router.post("/logout")
def logout(request: Request, current_user: User=Depends(get_current_active_user), db: Session=Depends(get_db)):
    auth=request.headers.get("authorization",""); token=auth[7:] if auth.lower().startswith("bearer ") else ""
    from app.core.security import decode_access_token
    try:
        payload=decode_access_token(token); jti=payload.get("jti")
        if jti: revoke_session(db,jti)
    except Exception: pass
    return {"message":"Logged out"}

@router.post("/logout-all")
def logout_all(current_user: User=Depends(get_current_active_user), db: Session=Depends(get_db)):
    revoke_all_sessions(db,current_user.id); return {"message":"All sessions revoked"}

@router.get("/sessions", response_model=list[SessionResponse])
def sessions(request: Request, current_user: User=Depends(get_current_active_user), db: Session=Depends(get_db)):
    auth=request.headers.get("authorization",""); token=auth[7:] if auth.lower().startswith("bearer ") else ""
    from app.core.security import decode_access_token
    current_jti=None
    try: current_jti=decode_access_token(token).get("jti")
    except Exception: pass
    rows=db.scalars(select(UserSession).where(UserSession.user_id==current_user.id).order_by(UserSession.created_at.desc())).all()
    out=[]
    for row in rows:
        item=SessionResponse.model_validate(row); item.current=bool(current_jti and row.jti_hash==hash_identifier(current_jti)); out.append(item)
    return out

@router.delete("/sessions/{session_id}")
def revoke_one_session(session_id:int,current_user:User=Depends(get_current_active_user),db:Session=Depends(get_db)):
    row=db.scalar(select(UserSession).where(UserSession.id==session_id,UserSession.user_id==current_user.id))
    if not row: raise HTTPException(404,"Session not found")
    row.revoked_at=datetime.now(timezone.utc); db.commit(); return {"message":"Session revoked"}

@router.post("/forgot-password")
def forgot_password(data: ForgotPasswordRequest, db: Session=Depends(get_db)):
    user=db.scalar(select(User).where(User.email==data.email.lower()))
    response={"message":"If the account exists, a password reset link has been issued."}
    if user and user.password_hash:
        token=create_reset_token(db,user); _send_reset_email(user.email,token)
        if settings.DEBUG: response["development_token"]=token
    return response

@router.post("/reset-password")
def reset_password(data: ResetPasswordRequest, db: Session=Depends(get_db)):
    row=db.scalar(select(PasswordResetToken).where(PasswordResetToken.token_hash==hash_identifier(data.token),PasswordResetToken.used_at.is_(None)))
    now=datetime.now(timezone.utc)
    if not row or row.expires_at.replace(tzinfo=timezone.utc) <= now: raise HTTPException(400,"Invalid or expired reset token")
    user=db.get(User,row.user_id)
    if not user: raise HTTPException(400,"Invalid reset token")
    user.password_hash=hash_password(data.new_password); row.used_at=now; db.commit(); revoke_all_sessions(db,user.id)
    return {"message":"Password reset successfully"}

@router.get("/google/url")
def google_url():
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_REDIRECT_URI: raise HTTPException(503,"Google SSO is not configured")
    state=secrets.token_urlsafe(32)
    try: get_redis_client().setex(f"trustshare:oauth:state:{state}",300,"1")
    except Exception: pass
    params={"client_id":settings.GOOGLE_CLIENT_ID,"redirect_uri":settings.GOOGLE_REDIRECT_URI,"response_type":"code","scope":"openid email profile","state":state,"access_type":"offline","prompt":"select_account"}
    return {"authorization_url":"https://accounts.google.com/o/oauth2/v2/auth?"+urlencode(params)}

@router.get("/google/callback")
async def google_callback(
    code:str,
    request:Request,
    state:str|None=None,
    db:Session=Depends(get_db),):
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET or not settings.GOOGLE_REDIRECT_URI: raise HTTPException(503,"Google SSO is not configured")
    if not state: raise HTTPException(400,"Missing OAuth state")
    try:
        valid=get_redis_client().get(f"trustshare:oauth:state:{state}"); get_redis_client().delete(f"trustshare:oauth:state:{state}")
        if not valid: raise HTTPException(400,"Invalid OAuth state")
    except HTTPException: raise
    except Exception: raise HTTPException(503,"OAuth state store unavailable")
    async with httpx.AsyncClient(timeout=10) as client:
        token_resp=await client.post("https://oauth2.googleapis.com/token",data={"code":code,"client_id":settings.GOOGLE_CLIENT_ID,"client_secret":settings.GOOGLE_CLIENT_SECRET,"redirect_uri":settings.GOOGLE_REDIRECT_URI,"grant_type":"authorization_code"})
        if token_resp.status_code!=200: raise HTTPException(400,"Google authorization failed")
        access=token_resp.json().get("access_token")
        profile=(await client.get("https://openidconnect.googleapis.com/v1/userinfo",headers={"Authorization":f"Bearer {access}"})).json()
    email=(profile.get("email") or "").lower(); subject=profile.get("sub")
    if not email or not subject: raise HTTPException(400,"Google account email unavailable")
    user=db.scalar(select(User).where(User.oauth_provider=="google",User.oauth_subject==subject)) or db.scalar(select(User).where(User.email==email))
    if not user:
        user=User(name=profile.get("name") or email.split("@")[0],email=email,password_hash=None,role="USER",oauth_provider="google",oauth_subject=subject,is_active=True); db.add(user); db.commit(); db.refresh(user)
    elif not user.oauth_subject:
        user.oauth_provider="google"; user.oauth_subject=subject; db.commit()
    token,_=create_session(db,user,request.headers.get("user-agent") if request else None,request.client.host if request and request.client else None)
    return {"access_token":token,"token_type":"bearer","expires_in":settings.ACCESS_TOKEN_EXPIRE_MINUTES*60}

@router.get("/me", response_model=UserResponse)
def me(current_user=Depends(get_current_active_user)): 
    return current_user

@router.post("/mfa/setup", response_model=MFASetupResponse)
def setup_mfa(
    current_user=Depends(get_current_active_user),
    db:Session=Depends(get_db)
    ):
    secret=generate_mfa_secret()
    current_user.mfa_secret=secret
    current_user.mfa_enabled=False
    db.commit()

    code = pyotp.TOTP(secret).now()
    try:
        _send_mfa_email(current_user.email, code)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to send email verification code: {str(exc)}"
        ) from exc

    return MFASetupResponse(
        secret=secret,
        provisioning_uri=get_mfa_uri(secret,current_user.email)
    )

@router.post("/mfa/enable")
def enable_mfa(
    data:MFAEnableRequest,
    current_user=Depends(get_current_active_user),
    db:Session=Depends(get_db)
    ):
    if not current_user.mfa_secret or not verify_mfa_code(current_user.mfa_secret,data.code): 
        raise HTTPException(400,"Invalid MFA code")
    current_user.mfa_enabled=True; 
    db.commit(); 
    return {"message":"MFA enabled successfully"}

@router.post("/mfa/disable")
def disable_mfa(
    current_user=Depends(get_current_active_user),
    db:Session=Depends(get_db)
    ):
    current_user.mfa_enabled=False; 
    current_user.mfa_secret=None; 
    db.commit(); 
    return {"message":"MFA disabled successfully"}