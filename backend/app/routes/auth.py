from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_reset_token,
    decode_reset_token,
)
from app.core.mongo import log_activity
from app.models.models import User

router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ForgotPasswordResponse(BaseModel):
    message: str
    # NOTE: In production this token is emailed, never returned in the API
    # response. It's returned here only because no email service is wired
    # up yet — this is a local-dev convenience, not a security pattern to
    # keep once SendGrid/SES is added.
    reset_token: str | None = None


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


@router.post("/register", response_model=TokenResponse)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    user = User(email=payload.email, password_hash=hash_password(payload.password))
    db.add(user)
    db.commit()
    db.refresh(user)

    log_activity(str(user.id), "register")
    token = create_access_token(str(user.id))
    return TokenResponse(access_token=token)


@router.post("/login", response_model=TokenResponse)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")

    log_activity(str(user.id), "login")
    token = create_access_token(str(user.id))
    return TokenResponse(access_token=token)


@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    return {"id": str(current_user.id), "email": current_user.email, "role": current_user.role}


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()

    # Always return the same message whether or not the email exists,
    # so this endpoint can't be used to enumerate registered accounts.
    generic_message = "If that email is registered, a reset link has been generated."

    if not user:
        return ForgotPasswordResponse(message=generic_message)

    reset_token = create_reset_token(str(user.id))
    log_activity(str(user.id), "forgot_password_requested")

    return ForgotPasswordResponse(message=generic_message, reset_token=reset_token)


@router.post("/reset-password", response_model=TokenResponse)
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    user_id = decode_reset_token(payload.token)
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reset link is invalid or has expired",
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.password_hash = hash_password(payload.new_password)
    db.commit()

    log_activity(str(user.id), "password_reset")
    token = create_access_token(str(user.id))
    return TokenResponse(access_token=token)
