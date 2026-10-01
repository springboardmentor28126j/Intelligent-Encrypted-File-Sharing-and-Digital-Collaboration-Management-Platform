from typing import Annotated

from app.api.dependencies import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    RegisterRequest,
    TokenResponse,
)
from app.services.auth import (
    authenticate_user,
    generate_token,
    register_user,
)
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

# Reusable annotated types for cleaner signature definitions
CurrentUserDep = Annotated[User, Depends(get_current_user)]
DatabaseDep = Annotated[Session, Depends(get_db)]

router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)


@router.post("/register")
def register(
    data: RegisterRequest,
    db: DatabaseDep,
):
    try:
        user = register_user(db, data)

        return {
            "message": "User registered successfully",
            "user_id": user.id,
        }

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e),
        )


@router.post(
    "/login",
    response_model=TokenResponse,
)
def login(
    data: LoginRequest,
    db: DatabaseDep,
):
    user = authenticate_user(
        db,
        data.email,
        data.password,
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    token = generate_token(user)

    return {
        "access_token": token,
        "token_type": "bearer",
    }

@router.get("/me")
def get_me(
    current_user: CurrentUserDep,
):
    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "is_active": current_user.is_active,
        "created_at": current_user.created_at,
    }