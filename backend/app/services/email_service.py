import smtplib
from email.message import EmailMessage
from ..config import settings


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