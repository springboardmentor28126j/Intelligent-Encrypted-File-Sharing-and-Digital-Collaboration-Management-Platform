from sqlalchemy.orm import Session

from app.core.email import send_notification_email
from app.models.models import Notification, User

_SUBJECTS = {
    "share": "A file was shared with you on TrustShare",
    "download": "Your file was downloaded",
    "security": "Security alert on your TrustShare account",
}


def notify(db: Session, user_id, notif_type: str, message: str, resource_id: str | None = None):
    """Create an in-app notification and, if SMTP is configured, email it
    too. Commits on its own so callers don't need to worry about it
    interacting with whatever else is in their transaction."""
    note = Notification(
        user_id=user_id,
        type=notif_type,
        message=message,
        resource_id=resource_id,
    )
    db.add(note)
    db.commit()

    user = db.query(User).filter(User.id == user_id).first()
    if user:
        subject = _SUBJECTS.get(notif_type, "TrustShare notification")
        # send_notification_email already swallows its own failures and
        # returns False rather than raising, so a broken SMTP config never
        # breaks the request that triggered the notification.
        send_notification_email(user.email, subject, message)
