
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import SessionLocal
from models import Notification
from dependencies import get_current_user


# =========================================================
# Notifications Router
# =========================================================

router = APIRouter(
    prefix="/notifications",
    tags=["Notifications"]
)


# =========================================================
# Database Session
# =========================================================

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# =========================================================
# GET: Retrieve Notifications for Logged-in User
# =========================================================

@router.get("/")
def get_notifications(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    user_id = current_user["user_id"]

    notifications = (
        db.query(Notification)
        .filter(Notification.user_id == user_id)
        .order_by(Notification.created_at.desc())
        .all()
    )

    return {
        "success": True,
        "notifications": [
            {
                "id": notification.id,
                "message": notification.message,
                "type": notification.type,
                "is_read": notification.is_read,
                "created_at": notification.created_at.isoformat()
                if notification.created_at
                else None,
            }
            for notification in notifications
        ]
    }


# =========================================================
# GET: Retrieve Unread Notification Count
# =========================================================

@router.get("/unread-count")
def get_unread_count(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    user_id = current_user["user_id"]

    count = (
        db.query(Notification)
        .filter(
            Notification.user_id == user_id,
            Notification.is_read.is_(False)
        )
        .count()
    )

    return {
        "success": True,
        "unread_count": count
    }


# =========================================================
# PATCH: Mark One Notification as Read
# =========================================================

@router.patch("/{notification_id}/read")
def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    user_id = current_user["user_id"]

    notification = (
        db.query(Notification)
        .filter(
            Notification.id == notification_id,
            Notification.user_id == user_id
        )
        .first()
    )

    if notification is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found"
        )

    notification.is_read = True
    db.commit()

    return {
        "success": True,
        "message": "Notification marked as read"
    }


# =========================================================
# PATCH: Mark All Notifications as Read
# =========================================================

@router.patch("/mark-all-read")
def mark_all_notifications_read(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    user_id = current_user["user_id"]

    (
        db.query(Notification)
        .filter(
            Notification.user_id == user_id,
            Notification.is_read.is_(False)
        )
        .update(
            {Notification.is_read: True},
            synchronize_session=False
        )
    )

    db.commit()

    return {
        "success": True,
        "message": "All notifications marked as read"
    }


# =========================================================
# POST: Create a Notification
# =========================================================

@router.post("/")
def create_notification(
    message: str,
    notification_type: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    user_id = current_user["user_id"]

    if not message.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Notification message cannot be empty"
        )

    notification = Notification(
        user_id=user_id,
        message=message.strip(),
        type=notification_type.strip(),
        is_read=False
    )

    db.add(notification)
    db.commit()
    db.refresh(notification)

    return {
        "success": True,
        "message": "Notification created successfully",
        "notification": {
            "id": notification.id,
            "message": notification.message,
            "type": notification.type,
            "is_read": notification.is_read,
            "created_at": notification.created_at.isoformat()
            if notification.created_at
            else None
        }
    }
