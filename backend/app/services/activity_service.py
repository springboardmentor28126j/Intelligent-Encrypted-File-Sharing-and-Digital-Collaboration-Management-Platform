from sqlalchemy.orm import Session
from ..models import ActivityLog, User


def log_activity(db: Session, user: User, action: str, description: str, file_id: int | None = None):
    db.add(ActivityLog(user_id=user.id, action=action, description=description, file_id=file_id))
    db.commit()
