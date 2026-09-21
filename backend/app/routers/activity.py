from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import ActivityLog, User
from ..schemas.activity import ActivityResponse
from ..utils.dependencies import get_current_user

router = APIRouter(prefix="/api/activity", tags=["Activity"])


@router.get("", response_model=list[ActivityResponse])
def list_activity(
    action: str = Query(""),
    search: str = Query(""),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(ActivityLog).filter(ActivityLog.user_id == current_user.id)

    if action:
        query = query.filter(ActivityLog.action == action)
    if search:
        query = query.filter(ActivityLog.description.ilike(f"%{search}%"))

    return query.order_by(ActivityLog.created_at.desc()).limit(150).all()
