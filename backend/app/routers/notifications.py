from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User
from ..schemas.notification import NotificationListResponse, NotificationResponse
from ..services.notification_service import (
    count_unread_notifications,
    delete_all_user_notifications,
    delete_notification_by_id,
    get_user_notifications,
    mark_all_notifications_as_read,
    mark_notification_as_read,
)
from ..utils.dependencies import get_current_user

router = APIRouter(prefix="/api/notifications", tags=["Notifications"])


@router.get("", response_model=NotificationListResponse)
def list_notifications(
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Returns list of notifications for current_user ordered by created_at.desc() (limit default 100) along with an unread_count."""
    notifications = get_user_notifications(db, current_user.id, limit=limit)
    unread_count = count_unread_notifications(db, current_user.id)
    return {
        "notifications": notifications,
        "unread_count": unread_count,
    }


@router.patch("/{id}/read", response_model=NotificationResponse)
def mark_notification_read(
    id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Marks a specific notification owned by current_user as is_read = True."""
    notification = mark_notification_as_read(db, notification_id=id, user_id=current_user.id)
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )
    return notification


@router.post("/read-all")
def mark_all_read(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Marks all notifications for current_user as is_read = True."""
    mark_all_notifications_as_read(db, user_id=current_user.id)
    return {"message": "All notifications marked as read"}


@router.delete("/{id}")
def delete_notification(
    id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Deletes a specific notification owned by current_user."""
    success = delete_notification_by_id(db, notification_id=id, user_id=current_user.id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )
    return {"message": "Notification deleted successfully"}


@router.delete("")
def clear_all_notifications(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Deletes all notifications for current_user."""
    delete_all_user_notifications(db, user_id=current_user.id)
    return {"message": "All notifications cleared"}

