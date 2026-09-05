"""
Sends transactional email over SMTP. This works with Gmail, SendGrid's
SMTP relay, Mailgun, Outlook, or any other SMTP provider — just point the
SMTP_* environment variables at whichever one you're using.

If SMTP isn't configured, send_email() returns False instead of raising,
so calling code (like the password reset flow) can fall back to a
dev-mode path instead of crashing the whole request.
"""

import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.core.config import settings


def email_is_configured() -> bool:
    return bool(settings.SMTP_HOST and settings.SMTP_USERNAME and settings.SMTP_PASSWORD)


def send_email(to_email: str, subject: str, html_body: str, text_body: str | None = None) -> bool:
    if not email_is_configured():
        return False

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
    msg["To"] = to_email

    if text_body:
        msg.attach(MIMEText(text_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
            server.starttls()
            server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_FROM_EMAIL, [to_email], msg.as_string())
        return True
    except Exception as exc:
        # Never let an email failure break the request — log it and let
        # the caller decide how to degrade (e.g. a dev-mode token fallback).
        print(f"[email] Failed to send to {to_email}: {exc}")
        return False


def send_password_reset_email(to_email: str, reset_link: str) -> bool:
    subject = "Reset your TrustShare password"
    html = f"""
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color:#10243e;">Reset your password</h2>
      <p>We received a request to reset the password for your TrustShare account.</p>
      <p>
        <a href="{reset_link}" style="display:inline-block; background:#10243e; color:#fff;
           padding:12px 24px; border-radius:8px; text-decoration:none; font-weight:600;">
          Reset password
        </a>
      </p>
      <p style="color:#64748b; font-size:13px;">
        This link expires in 15 minutes. If you didn't request this, you can safely ignore this email.
      </p>
    </div>
    """
    text = f"Reset your TrustShare password: {reset_link}\nThis link expires in 15 minutes."
    return send_email(to_email, subject, html, text)
