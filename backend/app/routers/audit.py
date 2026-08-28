from typing import List

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from datetime import datetime
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.user import User
from app.models.audit_log import AuditLog

router = APIRouter(prefix="/api/audit", tags=["audit"])


class AuditLogOut(BaseModel):
    id: int
    action: str
    resource_type: str | None
    resource_id: str | None
    ip_address: str | None
    detail: str | None
    created_at: datetime

    class Config:
        from_attributes = True


@router.get("/me", response_model=List[AuditLogOut])
def my_activity(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return (
        db.query(AuditLog)
        .filter(AuditLog.user_id == current_user.id)
        .order_by(AuditLog.created_at.desc())
        .limit(200)
        .all()
    )


# --- Security Dashboard (spec section 4.7): admin-only, platform-wide view ---
SECURITY_ACTIONS = [
    "user.login_failed",
    "security.account_locked",
    "security.login_blocked_locked_account",
]


@router.get("/security", response_model=List[AuditLogOut])
def security_events(
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """
    Unauthorized-access-attempt / suspicious-activity feed for admins.
    To test this locally: manually set a user's `role` column to 'admin'
    in the database (see README 'Promoting an admin user').
    """
    return (
        db.query(AuditLog)
        .filter(AuditLog.action.in_(SECURITY_ACTIONS))
        .order_by(AuditLog.created_at.desc())
        .limit(200)
        .all()
    )
