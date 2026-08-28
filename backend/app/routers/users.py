from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import User
from ..schemas.auth import UserResponse
from ..schemas.user import ProfileUpdate
from ..services.activity_service import log_activity
from ..utils.dependencies import get_current_user

router = APIRouter(prefix="/api/users", tags=["Users"])


@router.get("/me", response_model=UserResponse)
def get_profile(current_user: User = Depends(get_current_user)):
    return current_user


@router.put("/me", response_model=UserResponse)
def update_profile(data: ProfileUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    current_user.name = data.name.strip()
    db.commit()
    db.refresh(current_user)
    log_activity(db, current_user, "profile_update", "Updated profile")
    return current_user
