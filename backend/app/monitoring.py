from datetime import datetime, timezone

from sqlalchemy.orm import Session

from .models import (
    AuditLog,
    ActivityLog,
    SecurityAlert,
    Notification,
)


def log_activity(
    db: Session,
    user_id: int,
    action: str,
    description: str,
    file_id: int | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
    status: str = "SUCCESS",
    details: str | None = None,
):
    """
    Record a user action in both the detailed audit log
    and the user activity log.
    """

    now = datetime.now(timezone.utc)

    audit_log = AuditLog(
        user_id=user_id,
        action=action,
        file_id=file_id,
        ip_address=ip_address,
        timestamp=now,
        details=details,
        status=status,
        user_agent=user_agent,
    )

    activity_log = ActivityLog(
        user_id=user_id,
        action=action[:40],
        file_id=file_id,
        description=description,
        created_at=now,
        ip_address=ip_address,
        user_agent=user_agent,
    )

    db.add(audit_log)
    db.add(activity_log)

    return audit_log, activity_log


def create_security_alert(
    db: Session,
    user_id: int | None,
    alert_type: str,
    description: str,
    severity: str = "MEDIUM",
):
    """
    Create a security alert.
    """

    alert = SecurityAlert(
        user_id=user_id,
        alert_type=alert_type,
        severity=severity,
        description=description,
        created_at=datetime.now(timezone.utc),
        resolved=False,
    )

    db.add(alert)

    return alert


def create_notification(
    db: Session,
    user_id: int,
    title: str,
    message: str,
    notification_type: str = "SECURITY",
):
    """
    Create an in-app notification for a user.
    """

    notification = Notification(
        user_id=user_id,
        title=title,
        message=message,
        notification_type=notification_type,
        is_read=False,
        created_at=datetime.now(timezone.utc),
        type=notification_type,
    )

    db.add(notification)

    return notification