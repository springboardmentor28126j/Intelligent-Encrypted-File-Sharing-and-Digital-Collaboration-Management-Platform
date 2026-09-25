import logging
import smtplib
from email.message import EmailMessage
from ..config import settings

logger = logging.getLogger(__name__)


def send_password_reset_otp(recipient: str, otp: str) -> None:
    if not all((settings.smtp_host, settings.smtp_username, settings.smtp_password, settings.smtp_from_email)):
        raise RuntimeError("SMTP email settings are not configured")
    message = EmailMessage()
    message["Subject"] = "TrustShare Password Reset"
    message["From"] = settings.smtp_from_email
    message["To"] = recipient
    message.set_content(f"Your TrustShare password reset OTP is: {otp}\n\nThis OTP is valid for {settings.otp_expire_minutes} minutes.")
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
        if settings.smtp_use_tls:
            server.starttls()
        server.login(settings.smtp_username, settings.smtp_password)
        server.send_message(message)


def send_notification_email(recipient: str, subject_or_message: str, message: str | None = None) -> None:
    """Send an email notification to recipient alerting them of file shares or security alerts."""
    if not all((settings.smtp_host, settings.smtp_username, settings.smtp_password, settings.smtp_from_email)):
        logger.warning("SMTP email settings are not configured. Notification email not sent.")
        return

    if message is None:
        subject = "TrustShare Notification"
        body = subject_or_message
    else:
        subject = subject_or_message
        body = message

    try:
        email_msg = EmailMessage()
        email_msg["Subject"] = subject
        email_msg["From"] = settings.smtp_from_email
        email_msg["To"] = recipient
        email_msg.set_content(body)
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as server:
            if settings.smtp_use_tls:
                server.starttls()
            server.login(settings.smtp_username, settings.smtp_password)
            server.send_message(email_msg)
    except Exception as error:
        logger.error("Failed to send notification email to %s: %s", recipient, error)