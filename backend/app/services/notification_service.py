import logging
from sqlalchemy.orm import Session
from ..models.notification import Notification
from ..models import User

logger = logging.getLogger(__name__)


def create_notification(
    db: Session,
    user_id: int,
    type: str,
    title: str,
    message: str,
) -> Notification:
    """Create a new in-app notification for a user."""
    notification = Notification(
        user_id=user_id,
        type=type,
        title=title,
        message=message,
        is_read=False,
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)
    return notification


def notify_admins(
    db: Session,
    type: str,
    title: str,
    message: str,
    exclude_user_id: int | None = None,
) -> int:
    """Notify active administrators about platform-level events."""
    admins = db.query(User).filter(
        User.role.ilike("admin"),
        User.is_active.is_(True),
    )
    if exclude_user_id is not None:
        admins = admins.filter(User.id != exclude_user_id)
    admin_ids = [admin.id for admin in admins.all()]
    for admin_id in admin_ids:
        db.add(Notification(user_id=admin_id, type=type, title=title, message=message, is_read=False))
    if admin_ids:
        db.commit()
    return len(admin_ids)


def get_user_notifications(db: Session, user_id: int, limit: int = 100) -> list[Notification]:
    """Retrieve the most recent notifications for a user."""
    return (
        db.query(Notification)
        .filter(Notification.user_id == user_id)
        .order_by(Notification.created_at.desc())
        .limit(limit)
        .all()
    )


def count_unread_notifications(db: Session, user_id: int) -> int:
    """Count unread notifications for a user."""
    return (
        db.query(Notification)
        .filter(Notification.user_id == user_id, Notification.is_read.is_(False))
        .count()
    )


def mark_notification_as_read(db: Session, notification_id: int, user_id: int) -> Notification | None:
    """Mark a specific notification as read."""
    notification = (
        db.query(Notification)
        .filter(Notification.id == notification_id, Notification.user_id == user_id)
        .first()
    )
    if not notification:
        return None
    notification.is_read = True
    db.commit()
    db.refresh(notification)
    return notification


def mark_all_notifications_as_read(db: Session, user_id: int) -> int:
    """Mark all notifications for a user as read."""
    updated = (
        db.query(Notification)
        .filter(Notification.user_id == user_id, Notification.is_read.is_(False))
        .update({Notification.is_read: True}, synchronize_session=False)
    )
    db.commit()
    return updated


def delete_notification_by_id(db: Session, notification_id: int, user_id: int) -> bool:
    """Delete a specific notification for a user."""
    notification = (
        db.query(Notification)
        .filter(Notification.id == notification_id, Notification.user_id == user_id)
        .first()
    )
    if not notification:
        return False
    db.delete(notification)
    db.commit()
    return True


def delete_all_user_notifications(db: Session, user_id: int) -> int:
    """Delete all notifications for a user."""
    deleted = (
        db.query(Notification)
        .filter(Notification.user_id == user_id)
        .delete(synchronize_session=False)
    )
    db.commit()
    return deleted

