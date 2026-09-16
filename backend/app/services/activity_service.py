from datetime import datetime

from sqlalchemy.orm import Session

from ..models import ActivityLog, User
from ..mongo import activity_collection


def log_activity(
    db: Session,
    user: User,
    action: str,
    description: str,
    file_id: int | None = None
):
    # Existing PostgreSQL activity logging
    db.add(
        ActivityLog(
            user_id=user.id,
            action=action,
            description=description,
            file_id=file_id
        )
    )
    db.commit()

    # MongoDB activity logging
    try:
        activity_collection.insert_one(
            {
                "user_id": user.id,
                "action": action,
                "description": description,
                "file_id": file_id,
                "created_at": datetime.utcnow()
            }
        )
    except Exception:
        # MongoDB failure should not break the existing
        # PostgreSQL activity logging.
        pass


def log_download_notification(
    db: Session,
    owner: User,
    downloader: User,
    file_name: str,
    file_id: int | None = None
):
    description = (
        f"{downloader.name} ({downloader.email}) "
        f"downloaded '{file_name}'"
    )

    db.add(
        ActivityLog(
            user_id=owner.id,
            action="shared_download",
            description=description,
            file_id=file_id
        )
    )
    db.commit()

    # Also store the download notification in MongoDB
    try:
        activity_collection.insert_one(
            {
                "user_id": owner.id,
                "action": "shared_download",
                "description": description,
                "file_id": file_id,
                "created_at": datetime.utcnow()
            }
        )
    except Exception:
        pass