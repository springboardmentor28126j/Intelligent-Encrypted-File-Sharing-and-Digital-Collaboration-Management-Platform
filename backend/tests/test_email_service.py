"""
test_email_service.py – Tests for TrustShare Email Delivery Engine.
"""

from datetime import datetime, timedelta, timezone
from app.services.email_service import (
    send_email,
    send_password_reset_email,
    send_file_shared_email,
    send_security_alert_email,
)


def test_console_email_dispatch():
    """Verify console simulated email delivery succeeds and returns structured result."""
    res = send_email(
        to_email="test_recipient@example.com",
        subject="Test Subject",
        html_content="<p>Test HTML</p>",
        plain_content="Test Plain",
    )
    assert res.success is True
    assert res.provider in ["console", "smtp", "resend", "sendgrid"]
    assert res.message_id is not None


def test_password_reset_email_template():
    """Verify password reset email generation and dispatch."""
    res = send_password_reset_email(
        to_email="alice@example.com",
        reset_url="http://localhost:3000/reset-password?token=sample_token_123",
        expires_minutes=30,
    )
    assert res.success is True
    assert res.message_id is not None


def test_file_shared_email_template():
    """Verify file share email dispatch with permissions and expiration."""
    exp = datetime.now(timezone.utc) + timedelta(days=7)
    res = send_file_shared_email(
        to_email="bob@example.com",
        sender_email="alice@example.com",
        filename="confidential_report.pdf",
        share_url="http://localhost:3000/share/sample_token_xyz",
        permission="can_download",
        expires_at=exp,
        file_size=1048576,
    )
    assert res.success is True
    assert res.message_id is not None


def test_security_alert_email_template():
    """Verify security alert email dispatch."""
    res = send_security_alert_email(
        to_email="charlie@example.com",
        subject="Security Notice: New Login Detected",
        alert_message="A new login was detected from IP 192.168.1.100 using Chrome on Windows.",
        ip_address="192.168.1.100",
    )
    assert res.success is True
    assert res.message_id is not None
