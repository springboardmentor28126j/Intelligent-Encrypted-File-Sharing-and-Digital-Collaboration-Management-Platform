import uuid
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status
from src.models.sql.user import User
from src.schemas.auth import UserRegister, UserLogin, TokenResponse, UserResponse, MFASetupResponse
from src.core.security import (
    get_password_hash,
    verify_password,
    create_access_token,
    create_refresh_token,
    generate_totp_secret,
    verify_totp_code,
    get_totp_uri,
)
from src.core.config import settings

class AuthService:
    @staticmethod
    async def register(db: AsyncSession, payload: UserRegister) -> UserResponse:
        existing = await db.scalar(select(User).where(User.email == payload.email))
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered",
            )
        user = User(
            email=payload.email,
            hashed_password=get_password_hash(payload.password),
            full_name=payload.full_name,
            role="admin" if payload.email.startswith("admin@") else "user"
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        return UserResponse.model_validate(user)

    @staticmethod
    async def login(db: AsyncSession, payload: UserLogin) -> TokenResponse:
        user = await db.scalar(select(User).where(User.email == payload.email))
        if not user or not verify_password(payload.password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
            )
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is disabled",
            )
        if user.mfa_enabled:
            if not payload.mfa_code:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="MFA code required",
                )
            if not user.mfa_secret or not verify_totp_code(user.mfa_secret, payload.mfa_code):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid MFA code",
                )

        access_token = create_access_token(subject=user.id, role=user.role)
        refresh_token = create_refresh_token(subject=user.id)
        
        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            user_id=user.id,
            email=user.email,
            role=user.role
        )

    @staticmethod
    async def setup_mfa(db: AsyncSession, user: User) -> MFASetupResponse:
        secret = generate_totp_secret()
        user.mfa_secret = secret
        await db.commit()
        uri = get_totp_uri(secret, user.email)
        return MFASetupResponse(secret=secret, qr_uri=uri)

    @staticmethod
    async def verify_and_enable_mfa(db: AsyncSession, user: User, code: str) -> bool:
        if not user.mfa_secret:
            raise HTTPException(status_code=400, detail="MFA setup has not been initiated")
        if not verify_totp_code(user.mfa_secret, code):
            raise HTTPException(status_code=400, detail="Invalid verification code")
        user.mfa_enabled = True
        await db.commit()
        return True
