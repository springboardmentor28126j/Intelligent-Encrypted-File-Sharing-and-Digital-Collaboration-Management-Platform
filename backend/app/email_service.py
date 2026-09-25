import os
import smtplib

from email.message import EmailMessage
from pathlib import Path

from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


def send_password_reset_email(
    recipient_email: str,
    reset_token: str
):
    smtp_host = os.getenv("SMTP_HOST")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_username = os.getenv("SMTP_USERNAME")
    smtp_password = os.getenv("SMTP_PASSWORD")
    smtp_from = os.getenv("SMTP_FROM")
    frontend_url = os.getenv(
        "FRONTEND_URL",
        "http://localhost:5173"
    )

    if not all([
        smtp_host,
        smtp_username,
        smtp_password,
        smtp_from
    ]):
        raise RuntimeError(
            "SMTP configuration is incomplete in .env"
        )

    reset_link = (
        f"{frontend_url}/reset-password"
        f"?token={reset_token}"
    )

    message = EmailMessage()

    message["Subject"] = "TrustShare - Password Reset"
    message["From"] = smtp_from
    message["To"] = recipient_email

    message.set_content(
        f"""Hello,

We received a request to reset your TrustShare password.

Click the link below to reset your password:

{reset_link}

This link will expire in 30 minutes.

If you did not request a password reset, you can safely ignore this email.

Regards,
TrustShare Team
"""
    )

    with smtplib.SMTP(
        smtp_host,
        smtp_port,
        timeout=30
    ) as server:

        server.starttls()

        server.login(
            smtp_username,
            smtp_password
        )

        server.send_message(message)