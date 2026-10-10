from datetime import datetime, timezone

from sqlalchemy.orm import Session

from .models import (
    ActivityLog,
    AuditLog,
    SecurityAlert,
    Notification,
)


def log_activity(
    db: Session,
    user_id: int,
    action: str,
    description: str,
    file_id: int = None,
    ip_address: str = None,
    user_agent: str = None,
):
    activity = ActivityLog(
        user_id=user_id,
        action=action,
        file_id=file_id,
        description=description,
        created_at=datetime.now(timezone.utc),
        ip_address=ip_address,
        user_agent=user_agent,
    )

    db.add(activity)
    db.flush()

    return activity


def log_audit(
    db: Session,
    user_id: int = None,
    action: str = "",
    file_id: int = None,
    ip_address: str = None,
    details: str = None,
    status: str = "SUCCESS",
    user_agent: str = None,
):
    audit = AuditLog(
        user_id=user_id,
        action=action,
        file_id=file_id,
        ip_address=ip_address,
        timestamp=datetime.now(timezone.utc),
        details=details,
        status=status,
        user_agent=user_agent,
    )

    db.add(audit)
    db.flush()

    return audit


def create_security_alert(
    db: Session,
    user_id: int,
    alert_type: str,
    description: str,
    severity: str = "MEDIUM",
):
    alert = SecurityAlert(
        user_id=user_id,
        alert_type=alert_type,
        severity=severity,
        description=description,
        created_at=datetime.now(timezone.utc),
        resolved=False,
    )

    db.add(alert)
    db.flush()

    return alert


def create_notification(
    db: Session,
    user_id: int,
    title: str,
    message: str,
    notification_type: str = "SECURITY",
):
    notification = Notification(
        user_id=user_id,
        title=title,
        message=message,
        notification_type=notification_type,
        is_read=False,
        created_at=datetime.now(timezone.utc),
        type="general",
    )

    db.add(notification)
    db.flush()

    return notification