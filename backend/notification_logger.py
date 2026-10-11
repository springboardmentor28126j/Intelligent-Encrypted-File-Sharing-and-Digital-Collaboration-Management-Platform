from database.connection import SessionLocal
from models.notification import Notification
from models.user import User

import asyncio
import threading

from email_service import send_notification_email


def _send_email_in_background(
    recipient_email: str,
    title: str,
    message: str
):
    try:
        asyncio.run(
            send_notification_email(
                recipient_email,
                title,
                message
            )
        )

        print(f"Notification email sent to {recipient_email}")

    except Exception as e:
        print(f"Notification email failed: {e}")


def create_notification(
    user_id,
    title,
    message,
    notification_type="info"
):
    db = SessionLocal()

    try:
        # Create in-app notification
        notification = Notification(
            user_id=user_id,
            title=title,
            message=message,
            notification_type=notification_type,
            is_read=False
        )

        db.add(notification)
        db.commit()
        db.refresh(notification)

        # Find user's email
        user = db.query(User).filter(
            User.id == user_id
        ).first()

        # Send email without blocking the notification system
        if user and user.email:
            email_thread = threading.Thread(
                target=_send_email_in_background,
                args=(
                    user.email,
                    title,
                    message
                ),
                daemon=True
            )

            email_thread.start()

        return notification

    finally:
        db.close()