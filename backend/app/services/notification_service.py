"""
Notification service.

In-app notifications are persisted to the DB and fetched via /api/notifications.
Email delivery is stubbed - it logs what WOULD be sent instead of requiring
real SMTP/SendGrid credentials, so the project runs out of the box. Swapping
in a real email provider later only means implementing `_send_email_stub`.
"""
import logging
from typing import Optional

from sqlalchemy.orm import Session

from app.models.notification import Notification
from app.models.user import User

logger = logging.getLogger("trustshare.notifications")
logging.basicConfig(level=logging.INFO)


def _send_email_stub(to_email: str, subject: str, body: str) -> None:
    """
    Placeholder for real email delivery (e.g. SendGrid, as shown in the
    project architecture diagram). Currently just logs, so no SMTP setup
    is required to run/demo the project.
    """
    logger.info(f"[EMAIL STUB] To: {to_email} | Subject: {subject} | Body: {body}")


def notify(
    db: Session,
    user: User,
    type: str,
    title: str,
    message: str,
    also_email: bool = False,
) -> Notification:
    notification = Notification(user_id=user.id, type=type, title=title, message=message)
    db.add(notification)
    db.commit()
    db.refresh(notification)

    if also_email:
        _send_email_stub(user.email, title, message)

    return notification
