"""
routers/notifications.py – In-app notifications API endpoints.

Routes:
  GET    /notifications                 – List user's notifications (supports unread_only filter)
  GET    /notifications/unread-count    – Fast counter for header badge
  PATCH  /notifications/{id}/read       – Mark single notification as read
  POST   /notifications/read-all        – Mark all notifications as read
  DELETE /notifications/{id}            – Delete a notification
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import User
from app.schemas import MessageResponse, NotificationOut, UnreadCountOut
from app.services.notification_service import (
    delete_notification,
    get_unread_count,
    get_user_notifications,
    mark_all_as_read,
    mark_as_read,
)

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get(
    "",
    response_model=List[NotificationOut],
    summary="Retrieve user notifications",
)
def list_notifications(
    unread_only: bool = Query(False, description="Filter for only unread notifications"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_user_notifications(
        db=db,
        user_id=current_user.id,
        unread_only=unread_only,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/unread-count",
    response_model=UnreadCountOut,
    summary="Get count of unread notifications for badge",
)
def get_user_unread_count(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    count = get_unread_count(db=db, user_id=current_user.id)
    return {"unread_count": count}


@router.patch(
    "/{notification_id}/read",
    response_model=MessageResponse,
    summary="Mark a notification as read",
)
def read_notification(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    success = mark_as_read(db=db, notification_id=notification_id, user_id=current_user.id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found.",
        )
    return {"message": "Notification marked as read.", "success": True}


@router.post(
    "/read-all",
    response_model=MessageResponse,
    summary="Mark all user notifications as read",
)
def read_all_notifications(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    count = mark_all_as_read(db=db, user_id=current_user.id)
    return {"message": f"{count} notifications marked as read.", "success": True}


@router.delete(
    "/{notification_id}",
    response_model=MessageResponse,
    summary="Delete a notification",
)
def remove_notification(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    success = delete_notification(
        db=db, notification_id=notification_id, user_id=current_user.id
    )
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found.",
        )
    return {"message": "Notification deleted.", "success": True}
