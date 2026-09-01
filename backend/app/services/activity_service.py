from sqlalchemy.orm import Session
from ..models import ActivityLog, User


def log_activity(db: Session, user: User, action: str, description: str, file_id: int | None = None):
    db.add(ActivityLog(user_id=user.id, action=action, description=description, file_id=file_id))
    db.commit()


def log_download_notification(db: Session, owner: User, downloader: User, file_name: str, file_id: int | None = None):
    description = f"{downloader.name} ({downloader.email}) downloaded '{file_name}'"
    db.add(ActivityLog(user_id=owner.id, action="shared_download", description=description, file_id=file_id))
    db.commit()
