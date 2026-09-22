"""
TrustShare notification service.

Supports:
1. Database-persisted in-app notifications
2. Email notifications through SMTP
"""

import logging
import os
import smtplib
from email.message import EmailMessage

from dotenv import load_dotenv
from sqlalchemy.orm import Session

from app.models.notification import Notification
from app.models.user import User

load_dotenv()

logger = logging.getLogger("trustshare.notifications")
logging.basicConfig(level=logging.INFO)


def _send_email_smtp(
    to_email: str,
    subject: str,
    body: str,
) -> bool:
    """Send an email through SMTP and return True if successful."""

    smtp_host = os.getenv("SMTP_HOST")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_username = os.getenv("SMTP_USERNAME")
    smtp_password = os.getenv("SMTP_PASSWORD")
    smtp_from_email = os.getenv(
        "SMTP_FROM_EMAIL",
        smtp_username,
    )

    if not smtp_host or not smtp_username or not smtp_password:
        logger.error("SMTP settings are incomplete.")
        return False

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = smtp_from_email
    message["To"] = to_email
    message.set_content(body)

    try:
        with smtplib.SMTP(
            smtp_host,
            smtp_port,
            timeout=15,
        ) as server:
            server.starttls()
            server.login(
                smtp_username,
                smtp_password,
            )
            server.send_message(message)

        logger.info(
            "Email sent successfully to %s",
            to_email,
        )
        return True

    except Exception:
        logger.exception(
            "Failed to send email to %s",
            to_email,
        )
        return False


def notify(
    db: Session,
    user: User,
    type: str,
    title: str,
    message: str,
    also_email: bool = False,
) -> Notification:
    """Create an in-app notification and optionally send an email."""

    notification = Notification(
        user_id=user.id,
        type=type,
        title=title,
        message=message,
    )

    db.add(notification)
    db.commit()
    db.refresh(notification)

    if also_email:
        _send_email_smtp(
            user.email,
            title,
            message,
        )

    return notification