"""
email_service.py – Production-Ready Multi-Provider Email Delivery Engine for TrustShare.

Supports:
  1. SMTP (Gmail App Password, AWS SES, Mailgun, SendGrid SMTP, standard TLS/SSL)
  2. Resend API (REST HTTP)
  3. SendGrid API (REST HTTP)
  4. Console / Logger (Graceful mock/fallback for test & offline development)

Features:
  - Responsive HTML + Plaintext multi-part MIME emails
  - Password Reset workflow emails with secure one-time action links
  - File Shared notifications with recipient links, permissions, and expiry info
  - Security Alert emails for suspicious activity
  - Real-time delivery logging, status reporting, and comprehensive error handling
"""

from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import json
import logging
import smtplib
import ssl
from typing import Any, Dict, Optional, Tuple
import urllib.error
import urllib.request

from app.config import settings

logger = logging.getLogger("trustshare.email")


def _format_size(size_bytes: int) -> str:
    if not size_bytes or size_bytes <= 0:
        return "Unknown size"
    for unit in ["B", "KB", "MB", "GB"]:
        if size_bytes < 1024:
            return f"{round(size_bytes, 1)} {unit}"
        size_bytes /= 1024
    return f"{round(size_bytes, 1)} TB"


class EmailDeliveryResult:
    """Represents the outcome of an email dispatch operation."""
    def __init__(
        self,
        success: bool,
        provider: str,
        message_id: Optional[str] = None,
        error: Optional[str] = None,
    ):
        self.success = success
        self.provider = provider
        self.message_id = message_id
        self.error = error
        self.timestamp = datetime.now(timezone.utc)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "success": self.success,
            "provider": self.provider,
            "message_id": self.message_id,
            "error": self.error,
            "timestamp": self.timestamp.isoformat(),
        }


def _send_smtp(
    to_email: str,
    subject: str,
    html_content: str,
    plain_content: str,
) -> EmailDeliveryResult:
    """Deliver email via SMTP using STARTTLS or SSL."""
    host = settings.SMTP_HOST
    port = settings.SMTP_PORT
    user = settings.SMTP_USER
    password = settings.SMTP_PASSWORD
    use_tls = settings.SMTP_USE_TLS
    use_ssl = settings.SMTP_USE_SSL
    from_addr = settings.EMAIL_FROM_ADDRESS
    from_name = settings.EMAIL_FROM_NAME

    if not user or not password or not host:
        logger.warning(
            f"[Email/SMTP] SMTP credentials not configured (Host: {host}, User: {user}). "
            f"Logging message to console instead for recipient: {to_email}"
        )
        return _send_console(to_email, subject, plain_content, reason="SMTP credentials not configured")

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{from_name} <{from_addr}>"
    msg["To"] = to_email
    msg["Date"] = datetime.now(timezone.utc).strftime("%a, %d %b %Y %H:%M:%S +0000")

    part_text = MIMEText(plain_content, "plain", "utf-8")
    part_html = MIMEText(html_content, "html", "utf-8")
    msg.attach(part_text)
    msg.attach(part_html)

    try:
        timeout = getattr(settings, "SMTP_TIMEOUT_SECONDS", 10)
        context = ssl.create_default_context()

        if use_ssl or port == 465:
            with smtplib.SMTP_SSL(host, port, context=context, timeout=timeout) as server:
                server.login(user, password)
                server.send_message(msg)
        else:
            with smtplib.SMTP(host, port, timeout=timeout) as server:
                server.ehlo()
                if use_tls:
                    server.starttls(context=context)
                    server.ehlo()
                server.login(user, password)
                server.send_message(msg)

        logger.info(f"[Email/SMTP] Email successfully dispatched to '{to_email}' with subject '{subject}'.")
        return EmailDeliveryResult(success=True, provider="smtp", message_id=f"smtp-{int(datetime.now().timestamp())}")
    except smtplib.SMTPAuthenticationError as exc:
        err = f"SMTP Authentication failed: {exc.smtp_error.decode('utf-8', errors='ignore') if isinstance(exc.smtp_error, bytes) else str(exc)}"
        logger.error(f"[Email/SMTP] {err}")
        return EmailDeliveryResult(success=False, provider="smtp", error=err)
    except Exception as exc:
        err = f"SMTP Delivery error: {str(exc)}"
        logger.error(f"[Email/SMTP] {err}")
        return EmailDeliveryResult(success=False, provider="smtp", error=err)


def _send_resend(
    to_email: str,
    subject: str,
    html_content: str,
    plain_content: str,
) -> EmailDeliveryResult:
    """Deliver email via Resend REST API."""
    api_key = settings.RESEND_API_KEY
    from_addr = f"{settings.EMAIL_FROM_NAME} <{settings.EMAIL_FROM_ADDRESS}>"

    if not api_key:
        logger.warning("[Email/Resend] RESEND_API_KEY not configured. Falling back to console.")
        return _send_console(to_email, subject, plain_content, reason="RESEND_API_KEY missing")

    url = "https://api.resend.com/emails"
    payload = {
        "from": from_addr,
        "to": [to_email],
        "subject": subject,
        "html": html_content,
        "text": plain_content,
    }

    try:
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "User-Agent": "TrustShare-Backend/2.0",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            msg_id = data.get("id", "resend-ok")
            logger.info(f"[Email/Resend] Dispatched to '{to_email}' (id: {msg_id})")
            return EmailDeliveryResult(success=True, provider="resend", message_id=msg_id)
    except urllib.error.HTTPError as exc:
        err_body = exc.read().decode("utf-8", errors="ignore")
        err = f"Resend API HTTP {exc.code}: {err_body}"
        logger.error(f"[Email/Resend] {err}")
        return EmailDeliveryResult(success=False, provider="resend", error=err)
    except Exception as exc:
        err = f"Resend delivery error: {str(exc)}"
        logger.error(f"[Email/Resend] {err}")
        return EmailDeliveryResult(success=False, provider="resend", error=err)


def _send_sendgrid(
    to_email: str,
    subject: str,
    html_content: str,
    plain_content: str,
) -> EmailDeliveryResult:
    """Deliver email via SendGrid v3 Mail Send API."""
    api_key = settings.SENDGRID_API_KEY
    from_addr = settings.EMAIL_FROM_ADDRESS
    from_name = settings.EMAIL_FROM_NAME

    if not api_key:
        logger.warning("[Email/SendGrid] SENDGRID_API_KEY not configured. Falling back to console.")
        return _send_console(to_email, subject, plain_content, reason="SENDGRID_API_KEY missing")

    url = "https://api.sendgrid.com/v3/mail/send"
    payload = {
        "personalizations": [{"to": [{"email": to_email}]}],
        "from": {"email": from_addr, "name": from_name},
        "subject": subject,
        "content": [
            {"type": "text/plain", "value": plain_content},
            {"type": "text/html", "value": html_content},
        ],
    }

    try:
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "User-Agent": "TrustShare-Backend/2.0",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            logger.info(f"[Email/SendGrid] Dispatched to '{to_email}' (status: {resp.status})")
            return EmailDeliveryResult(success=True, provider="sendgrid", message_id=f"sg-{int(datetime.now().timestamp())}")
    except urllib.error.HTTPError as exc:
        err_body = exc.read().decode("utf-8", errors="ignore")
        err = f"SendGrid API HTTP {exc.code}: {err_body}"
        logger.error(f"[Email/SendGrid] {err}")
        return EmailDeliveryResult(success=False, provider="sendgrid", error=err)
    except Exception as exc:
        err = f"SendGrid delivery error: {str(exc)}"
        logger.error(f"[Email/SendGrid] {err}")
        return EmailDeliveryResult(success=False, provider="sendgrid", error=err)


def _send_console(
    to_email: str,
    subject: str,
    plain_content: str,
    reason: str = "Configured for console delivery",
) -> EmailDeliveryResult:
    """Simulated delivery: logs clearly to standard logger/console."""
    border = "=" * 64
    log_msg = (
        f"\n{border}\n"
        f"📧 [TRUSTSHARE EMAIL DELIVERY SIMULATION ({reason})]\n"
        f"To:      {to_email}\n"
        f"Subject: {subject}\n"
        f"Time:    {datetime.now(timezone.utc).isoformat()}\n"
        f"{'-' * 64}\n"
        f"{plain_content}\n"
        f"{border}\n"
    )
    logger.info(log_msg)
    print(log_msg)
    return EmailDeliveryResult(
        success=True,
        provider="console",
        message_id=f"simulated-{int(datetime.now().timestamp())}",
    )


def send_email(
    to_email: str,
    subject: str,
    html_content: str,
    plain_content: str,
) -> EmailDeliveryResult:
    """
    Main dispatch function. Routes to configured provider (smtp, resend, sendgrid, or console).
    Automatically falls back to console simulation if keys or servers are unreachable.
    """
    provider = (settings.EMAIL_PROVIDER or "console").strip().lower()

    if provider == "smtp":
        res = _send_smtp(to_email, subject, html_content, plain_content)
        # If SMTP failed because of missing config, _send_smtp already fell back to console
        return res
    elif provider == "resend":
        return _send_resend(to_email, subject, html_content, plain_content)
    elif provider == "sendgrid":
        return _send_sendgrid(to_email, subject, html_content, plain_content)
    else:
        return _send_console(to_email, subject, plain_content)


# ─── Template Generators ───────────────────────────────────────────────────────

def _get_base_html(title: str, preheader: str, body_html: str) -> str:
    """Standard responsive glassmorphism dark-themed HTML template."""
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title}</title>
  <style>
    body {{
      margin: 0;
      padding: 0;
      background-color: #0b0f19;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #f3f4f6;
    }}
    .container {{
      max-width: 560px;
      margin: 30px auto;
      background: #111827;
      border: 1px solid #1f2937;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5);
    }}
    .header {{
      padding: 24px 32px;
      background: linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(168, 85, 247, 0.15));
      border-bottom: 1px solid #1f2937;
      text-align: center;
    }}
    .logo {{
      font-size: 20px;
      font-weight: 700;
      color: #ffffff;
      text-decoration: none;
      letter-spacing: -0.5px;
    }}
    .content {{
      padding: 32px;
    }}
    h1 {{
      font-size: 22px;
      margin: 0 0 16px 0;
      color: #ffffff;
      font-weight: 600;
    }}
    p {{
      margin: 0 0 16px 0;
      font-size: 15px;
      line-height: 1.6;
      color: #9ca3af;
    }}
    .btn {{
      display: inline-block;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      color: #ffffff !important;
      font-weight: 600;
      font-size: 15px;
      text-decoration: none;
      padding: 12px 28px;
      border-radius: 8px;
      margin: 20px 0;
      text-align: center;
    }}
    .card-info {{
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid #1f2937;
      border-radius: 8px;
      padding: 16px;
      margin: 20px 0;
    }}
    .footer {{
      padding: 20px 32px;
      background: #0b0f19;
      border-top: 1px solid #1f2937;
      text-align: center;
      font-size: 12px;
      color: #6b7280;
    }}
    .url-text {{
      word-break: break-all;
      color: #818cf8;
      font-size: 13px;
    }}
  </style>
</head>
<body>
  <div style="display:none;font-size:1px;color:#333;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">
    {preheader}
  </div>
  <div class="container">
    <div class="header">
      <span class="logo">🛡️ TrustShare</span>
    </div>
    <div class="content">
      {body_html}
    </div>
    <div class="footer">
      <p style="margin:0;font-size:12px;color:#6b7280;">
        TrustShare Zero-Knowledge Secure File Transfer & Storage<br>
        This is an automated system notification.
      </p>
    </div>
  </div>
</body>
</html>"""


def send_password_reset_email(
    to_email: str,
    reset_url: str,
    expires_minutes: int = 30,
) -> EmailDeliveryResult:
    """
    Sends an email with password reset instructions and one-time link.
    """
    subject = "Reset your TrustShare account password"
    preheader = f"Use this secure one-time link to reset your TrustShare password. Valid for {expires_minutes} minutes."

    body_html = f"""
      <h1>Password Reset Request</h1>
      <p>Hello,</p>
      <p>We received a request to reset the password for your TrustShare account associated with <strong>{to_email}</strong>.</p>
      <p>Click the button below to choose a new password. This link is single-use and will expire in <strong>{expires_minutes} minutes</strong>.</p>
      
      <div style="text-align: center;">
        <a href="{reset_url}" class="btn" target="_blank">Reset Password →</a>
      </div>

      <p style="font-size: 13px; color: #6b7280;">If the button doesn't work, copy and paste this link into your browser:</p>
      <p><a href="{reset_url}" class="url-text">{reset_url}</a></p>

      <div class="card-info" style="border-left: 3px solid #eab308;">
        <p style="margin: 0; font-size: 13px; color: #d1d5db;">
          <strong>Security Note:</strong> If you did not request this password reset, you can safely ignore this email. Your current password remains secure and will not change.
        </p>
      </div>
    """

    plain_content = f"""TrustShare - Password Reset Request

Hello,

We received a request to reset the password for your TrustShare account ({to_email}).

To set a new password, visit the following secure link (valid for {expires_minutes} minutes):
{reset_url}

Security Note: If you did not request this reset, please ignore this email. Your password will not change.

---
TrustShare Security Team
"""

    html = _get_base_html("Password Reset - TrustShare", preheader, body_html)
    return send_email(to_email, subject, html, plain_content)


def send_file_shared_email(
    to_email: str,
    sender_email: str,
    filename: str,
    share_url: str,
    permission: str = "can_download",
    expires_at: Optional[datetime] = None,
    file_size: int = 0,
) -> EmailDeliveryResult:
    """
    Sends an email notifying recipient of an encrypted file share link.
    """
    perm_label = "Download & View" if permission == "can_download" else "View Only"
    formatted_size = _format_size(file_size)
    exp_text = expires_at.strftime("%b %d, %Y at %H:%M UTC") if expires_at else "Never (No Expiration)"
    
    subject = f"{sender_email} shared an encrypted file with you on TrustShare"
    preheader = f"{sender_email} has shared '{filename}' ({formatted_size}) via TrustShare secure transfer."

    body_html = f"""
      <h1>Secure File Shared With You</h1>
      <p>Hello,</p>
      <p><strong>{sender_email}</strong> has sent you a secure encrypted file via TrustShare.</p>

      <div class="card-info">
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr>
            <td style="color: #9ca3af; padding: 6px 0;">File Name:</td>
            <td style="color: #f3f4f6; font-weight: 600; padding: 6px 0;">{filename}</td>
          </tr>
          <tr>
            <td style="color: #9ca3af; padding: 6px 0;">File Size:</td>
            <td style="color: #f3f4f6; padding: 6px 0;">{formatted_size}</td>
          </tr>
          <tr>
            <td style="color: #9ca3af; padding: 6px 0;">Access Level:</td>
            <td style="color: #10b981; font-weight: 600; padding: 6px 0;">{perm_label}</td>
          </tr>
          <tr>
            <td style="color: #9ca3af; padding: 6px 0;">Link Expiry:</td>
            <td style="color: #f3f4f6; padding: 6px 0;">{exp_text}</td>
          </tr>
          <tr>
            <td style="color: #9ca3af; padding: 6px 0;">Encryption:</td>
            <td style="color: #6366f1; font-weight: 600; padding: 6px 0;">AES-256-GCM End-to-End</td>
          </tr>
        </table>
      </div>

      <div style="text-align: center;">
        <a href="{share_url}" class="btn" target="_blank">Access & Decrypt File →</a>
      </div>

      <p style="font-size: 13px; color: #6b7280;">Direct Link:</p>
      <p><a href="{share_url}" class="url-text">{share_url}</a></p>
    """

    plain_content = f"""TrustShare - Secure File Shared

Hello,

{sender_email} has shared an encrypted file with you:

File: {filename}
Size: {formatted_size}
Permission: {perm_label}
Expires: {exp_text}
Encryption: AES-256-GCM

Access your file securely at:
{share_url}

---
TrustShare Security Team
"""

    html = _get_base_html("Secure File Shared - TrustShare", preheader, body_html)
    return send_email(to_email, subject, html, plain_content)


def send_security_alert_email(
    to_email: str,
    subject: str,
    alert_message: str,
    ip_address: Optional[str] = None,
) -> EmailDeliveryResult:
    """
    Sends an immediate security alert email to user.
    """
    preheader = f"Security alert on your TrustShare account: {alert_message}"
    
    ip_line = f"<p><strong>IP Address:</strong> {ip_address}</p>" if ip_address else ""

    body_html = f"""
      <h1 style="color: #ef4444;">⚠️ Security Alert</h1>
      <p>Hello,</p>
      <p>We detected an important security event on your TrustShare account:</p>

      <div class="card-info" style="border-left: 3px solid #ef4444;">
        <p style="margin: 0; font-size: 14px; color: #f87171;">
          {alert_message}
        </p>
        {ip_line}
      </div>

      <p>If you did not perform this action, please log in immediately and update your password.</p>
    """

    plain_content = f"""TrustShare - Security Alert

Hello,

We detected the following security event on your TrustShare account:
{alert_message}
IP Address: {ip_address or 'Unknown'}

If this was not you, please log in immediately and update your password.

---
TrustShare Security Team
"""

    html = _get_base_html("Security Alert - TrustShare", preheader, body_html)
    return send_email(to_email, subject, html, plain_content)
