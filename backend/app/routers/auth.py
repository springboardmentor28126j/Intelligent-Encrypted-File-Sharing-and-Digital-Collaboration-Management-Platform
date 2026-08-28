import logging
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from ..config import settings
from ..database import get_db
from ..models import PasswordResetToken, User
from ..schemas.auth import ForgotPasswordRequest, LoginRequest, LoginResponse, RegisterRequest, ResetPasswordRequest, UserResponse, VerifyOTPRequest
from ..services.email_service import send_password_reset_otp
from ..services.activity_service import log_activity
from ..utils.security import create_access_token, create_otp, create_reset_verification_token, hash_password, hash_reset_token, get_reset_verification_subject, verify_password

router = APIRouter(prefix="/api/auth", tags=["Authentication"])
logger = logging.getLogger(__name__)


@router.post("/register", response_model=UserResponse, status_code=201)
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    if data.password != data.confirm_password:
        raise HTTPException(400, "Passwords do not match")
    if db.query(User).filter(User.email == data.email.lower()).first():
        raise HTTPException(409, "An account with this email already exists")
    user = User(name=data.name.strip(), email=data.email.lower(), password_hash=hash_password(data.password), role="user")
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=LoginResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email.lower()).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    log_activity(db, user, "login", "Logged in")
    return {"access_token": create_access_token(user.id), "user": user}


@router.post("/token")
def token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.username.lower()).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    log_activity(db, user, "login", "Logged in through OAuth2")
    return {"access_token": create_access_token(user.id), "token_type": "bearer"}


@router.post("/forgot-password")
def forgot_password(data: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email.lower()).first()
    response = {"message": "If that email exists, an OTP was sent."}
    if not user:
        return response
    db.query(PasswordResetToken).filter(PasswordResetToken.user_id == user.id, PasswordResetToken.used.is_(False)).update({PasswordResetToken.used: True})
    otp = create_otp()
    db.add(PasswordResetToken(user_id=user.id, token_hash=hash_reset_token(otp), expires_at=datetime.utcnow() + timedelta(minutes=settings.otp_expire_minutes)))
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
        raise HTTPException(503, "Password reset email could not be sent") from error
    return response


@router.post("/verify-otp")
def verify_otp(data: VerifyOTPRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email.lower()).first()
    reset = db.query(PasswordResetToken).filter(PasswordResetToken.user_id == (user.id if user else 0), PasswordResetToken.token_hash == hash_reset_token(data.otp), PasswordResetToken.used.is_(False)).first()
    if not reset or reset.expires_at < datetime.utcnow():
        raise HTTPException(400, "OTP is invalid or expired")
    reset.used = True
    db.commit()
    return {"reset_token": create_reset_verification_token(reset.user_id)}


@router.post("/reset-password")
def reset_password(data: ResetPasswordRequest, db: Session = Depends(get_db)):
    user_id = get_reset_verification_subject(data.token)
    user = db.get(User, user_id) if user_id else None
    if not user:
        raise HTTPException(400, "Reset verification is invalid or expired")
    user.password_hash = hash_password(data.new_password)
    db.commit()
    return {"message": "Password reset successfully"}
