from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from src.models.sql.database import get_db
from src.models.sql.user import User
from src.schemas.auth import UserRegister, UserLogin, TokenResponse, UserResponse, MFASetupResponse
from src.services.auth_service import AuthService
from src.api.deps import get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: UserRegister, db: AsyncSession = Depends(get_db)):
    return await AuthService.register(db, payload)

@router.post("/login", response_model=TokenResponse)
async def login(payload: UserLogin, db: AsyncSession = Depends(get_db)):
    return await AuthService.login(db, payload)

@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(user: User = Depends(get_current_user)):
    return UserResponse.model_validate(user)

@router.post("/mfa/setup", response_model=MFASetupResponse)
async def setup_mfa(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await AuthService.setup_mfa(db, user)

@router.post("/mfa/verify")
async def verify_mfa(code: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    success = await AuthService.verify_and_enable_mfa(db, user, code)
    return {"mfa_enabled": success}
