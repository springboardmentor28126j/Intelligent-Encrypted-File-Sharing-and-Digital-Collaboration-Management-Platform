"""
routers/auth.py – Authentication API endpoints.

Routes:
  POST /register – Create a new user account
  POST /login    – Authenticate and receive a JWT
  POST /logout   – Blacklist the current token in Redis and terminate session
  GET  /me       – Return the currently authenticated user's profile (protected)
"""

from fastapi import APIRouter, Depends, HTTPException, status
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
from app.database import get_db
from app.models import User
from app.schemas import MessageResponse, Token, UserCreate, UserLogin, UserOut

router = APIRouter(tags=["Authentication"])


# ─── POST /register ───────────────────────────────────────────────────────────

@router.post(
    "/register",
    response_model=UserOut,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user",
    description="Creates a new TrustShare account. Returns 409 if the email is already registered.",
)
def register(user_data: UserCreate, db: Session = Depends(get_db)) -> UserOut:
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

    return new_user


# ─── POST /login ──────────────────────────────────────────────────────────────

@router.post(
    "/login",
    response_model=Token,
    summary="Login and receive a JWT access token",
    description="Authenticates with email and password. Returns Bearer JWT.",
)
def login(credentials: UserLogin, db: Session = Depends(get_db)) -> Token:
    user = db.query(User).filter(User.email == credentials.email).first()

    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
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
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    current_user: User = Depends(get_current_user),
) -> MessageResponse:
    token = credentials.credentials
    revoke_token(token)
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
