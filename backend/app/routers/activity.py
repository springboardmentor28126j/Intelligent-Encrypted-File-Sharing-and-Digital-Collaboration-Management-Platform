from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import ActivityLog, User
from ..schemas.activity import ActivityResponse
from ..utils.dependencies import get_current_user

router = APIRouter(prefix="/api/activity", tags=["Activity"])


@router.get("", response_model=list[ActivityResponse])
def list_activity(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(ActivityLog).filter(ActivityLog.user_id == current_user.id).order_by(ActivityLog.created_at.desc()).limit(100).all()
