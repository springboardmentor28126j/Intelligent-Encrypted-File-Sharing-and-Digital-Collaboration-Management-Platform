"""
test_suspicious_activity.py – Test suite for Suspicious Activity Detection Engine.
"""

import pytest
from app.models import AuditLog, Notification, User
from app.services.security_service import (
    check_and_record_download,
    detect_new_ip_access,
    record_failed_login,
    record_unauthorized_share_access,
)


def test_failed_login_brute_force_detection(db_session, test_user):
    """Verify that 5 failed logins triggers a security alert notification, account lockout, and audit event."""
    email = test_user.email
    ip = "203.0.113.42"

    # Attempt 1-4: logged as standard failed logins, not locked yet
    for i in range(4):
        is_locked, count, remaining = record_failed_login(db=db_session, email=email, ip_address=ip)
        assert is_locked is False
        assert count == i + 1

    # Attempt 5: triggers threshold and locks account
    is_locked, count, remaining = record_failed_login(db=db_session, email=email, ip_address=ip)
    assert is_locked is True
    assert count == 5
    assert remaining > 0

    # Check that user is locked in database
    db_session.refresh(test_user)
    assert test_user.is_locked() is True

    # Check that a security alert notification was dispatched
    notifs = (
        db_session.query(Notification)
        .filter(Notification.user_id == test_user.id, Notification.type == "security_alert")
        .all()
    )
    assert len(notifs) >= 1
    assert "locked" in notifs[0].message.lower()

    # Check that a security_incident audit log was written
    security_logs = (
        db_session.query(AuditLog)
        .filter(AuditLog.action.in_(["account_locked", "multiple_failed_logins"]))
        .all()
    )
    assert len(security_logs) >= 1


def test_excessive_downloads_detection(db_session, test_user):
    """Verify that > 10 downloads within a short period triggers excessive download alert."""
    user_id = test_user.id
    ip = "198.51.100.9"

    # Downloads 1-9
    for i in range(9):
        triggered = check_and_record_download(
            db=db_session, user_id=user_id, file_id=1, ip_address=ip
        )
        assert triggered is False

    # Download 10: triggers threshold
    triggered = check_and_record_download(
        db=db_session, user_id=user_id, file_id=1, ip_address=ip
    )
    assert triggered is True

    # Check security alert notification
    alerts = (
        db_session.query(Notification)
        .filter(Notification.user_id == user_id, Notification.type == "security_alert")
        .all()
    )
    assert any("download volume" in a.message.lower() for a in alerts)


def test_unauthorized_share_access_logging(db_session):
    """Verify unauthorized share link probe creates security incident audit log."""
    record_unauthorized_share_access(
        db=db_session,
        token="expired_token_12345",
        ip_address="192.0.2.1",
        reason="Link expired",
    )

    log = (
        db_session.query(AuditLog)
        .filter(AuditLog.action == "unauthorized_access")
        .first()
    )
    assert log is not None
    assert log.status == "security_incident"
    assert "Link expired" in log.details
