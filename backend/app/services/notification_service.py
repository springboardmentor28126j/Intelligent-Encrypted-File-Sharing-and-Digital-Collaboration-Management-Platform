"""
notification_service.py – In-app real-time notification engine for TrustShare.

Handles generation, querying, and state management for:
  - File Shared Notifications (Direct sharing alerts)
  - Download Notifications (File owners notified when their files are downloaded)
  - Security Alert Notifications (Failed logins, unusual IP, expired link attempts)
  - Expiration Reminders (Notice before share links expire)
"""

from datetime import datetime, timezone
import logging
from typing import Any, Dict, List, Optional
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.models import Notification, User

logger = logging.getLogger("trustshare.notifications")


def create_notification(
    db: Session,
    user_id: int,
    message: str,
    type: str = "system",
    link_url: Optional[str] = None,
) -> Notification:
    """Create and persist an in-app notification for a user."""
    notif = Notification(
        user_id=user_id,
        message=message,
        type=type,
        is_read=False,
        created_at=datetime.now(timezone.utc),
        link_url=link_url,
    )
    try:
        db.add(notif)
        db.commit()
        db.refresh(notif)
        return notif
    except Exception as exc:
        db.rollback()
        logger.error(f"Failed to create notification for user {user_id}: {exc}")
        raise


def notify_file_shared(
    db: Session,
    recipient_id: int,
    sender_email: str,
    filename: str,
    link_url: Optional[str] = None,
) -> Notification:
    """Notify recipient that a user shared an encrypted file with them."""
    msg = f"{sender_email} shared the encrypted file '{filename}' with you."
    return create_notification(
        db=db,
        user_id=recipient_id,
        message=msg,
        type="file_shared",
        link_url=link_url or "/dashboard?tab=shared",
    )


def notify_file_downloaded(
    db: Session,
    owner_id: int,
    filename: str,
    downloader_info: str = "A recipient",
) -> Notification:
    """Notify file owner that their file was downloaded."""
    msg = f"{downloader_info} downloaded your encrypted file '{filename}'."
    return create_notification(
        db=db,
        user_id=owner_id,
        message=msg,
        type="download_notification",
        link_url="/dashboard",
    )


def notify_security_alert(
    db: Session,
    user_id: int,
    message: str,
    link_url: Optional[str] = None,
) -> Notification:
    """Dispatch high-priority security alert to the user."""
    return create_notification(
        db=db,
        user_id=user_id,
        message=message,
        type="security_alert",
        link_url=link_url or "/dashboard?tab=audit",
    )


def notify_expiration_reminder(
    db: Session,
    user_id: int,
    filename: str,
    expires_in_hours: int = 24,
) -> Notification:
    """Send expiration warning for an active share link."""
    msg = f"The share link for '{filename}' will expire in {expires_in_hours} hours."
    return create_notification(
        db=db,
        user_id=user_id,
        message=msg,
        type="expiration_reminder",
        link_url="/dashboard?tab=shares",
    )


def get_user_notifications(
    db: Session,
    user_id: int,
    unread_only: bool = False,
    limit: int = 50,
    offset: int = 0,
) -> List[Notification]:
    """Fetch chronological notifications for a specific user."""
    query = db.query(Notification).filter(Notification.user_id == user_id)
    if unread_only:
        query = query.filter(Notification.is_read == False)
    return (
        query.order_by(desc(Notification.created_at))
        .offset(offset)
        .limit(limit)
        .all()
    )


def get_unread_count(db: Session, user_id: int) -> int:
    """Get total unread notifications for badge count."""
    return (
        db.query(Notification)
        .filter(Notification.user_id == user_id, Notification.is_read == False)
        .count()
    )


def mark_as_read(db: Session, notification_id: int, user_id: int) -> bool:
    """Mark single notification as read."""
    notif = (
        db.query(Notification)
        .filter(Notification.id == notification_id, Notification.user_id == user_id)
        .first()
    )
    if not notif:
        return False
    notif.is_read = True
    db.commit()
    return True


def mark_all_as_read(db: Session, user_id: int) -> int:
    """Mark all user's notifications as read."""
    updated = (
        db.query(Notification)
        .filter(Notification.user_id == user_id, Notification.is_read == False)
        .update({"is_read": True})
    )
    db.commit()
    return updated


def delete_notification(db: Session, notification_id: int, user_id: int) -> bool:
    """Delete a single notification."""
    notif = (
        db.query(Notification)
        .filter(Notification.id == notification_id, Notification.user_id == user_id)
        .first()
    )
    if not notif:
        return False
    db.delete(notif)
    db.commit()
    return True
