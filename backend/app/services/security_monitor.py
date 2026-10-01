from datetime import datetime, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.audit import AuditLog
from app.models.security_alert import SecurityAlert
from app.services.notifications import notify_security_alert

FAILED_LOGIN_THRESHOLD = 5
DOWNLOAD_THRESHOLD = 20
DENIED_THRESHOLD = 5


def detect_failed_logins(
    db: Session,
    user_id: int,
    ip_address: str | None = None,
) -> SecurityAlert | None:

    since = datetime.utcnow() - timedelta(minutes=10)

    query = db.query(func.count(AuditLog.id)).filter(
        AuditLog.user_id == user_id,
        AuditLog.action == "login",
        AuditLog.status == "failed",
        AuditLog.created_at >= since,
    )

    if ip_address:
        query = query.filter(
            AuditLog.ip_address == ip_address
        )

    count = query.scalar() or 0

    if count < FAILED_LOGIN_THRESHOLD:
        return None

    existing = (
        db.query(SecurityAlert)
        .filter(
            SecurityAlert.user_id == user_id,
            SecurityAlert.alert_type == "repeated_failed_login",
            SecurityAlert.status == "open",
            SecurityAlert.created_at >= since,
        )
        .first()
    )

    if existing:
        return existing

    alert = SecurityAlert(
        user_id=user_id,
        alert_type="repeated_failed_login",
        severity="high",
        title="Repeated failed login attempts",
        description=(
            f"{count} failed login attempts were detected "
            "within the last 10 minutes."
        ),
        ip_address=ip_address,
        metadata_json={
            "attempt_count": count,
            "window_minutes": 10,
        },
    )

    db.add(alert)
    db.commit()
    db.refresh(alert)

    notify_security_alert(
        db,
        user_id,
        "Security alert",
        "Repeated failed login attempts were detected.",
    )

    return alert


def detect_download_spike(
    db: Session,
    user_id: int,
) -> SecurityAlert | None:

    since = datetime.utcnow() - timedelta(minutes=10)

    count = (
        db.query(func.count(AuditLog.id))
        .filter(
            AuditLog.user_id == user_id,
            AuditLog.action == "file_download",
            AuditLog.status == "success",
            AuditLog.created_at >= since,
        )
        .scalar()
        or 0
    )

    if count < DOWNLOAD_THRESHOLD:
        return None

    existing = (
        db.query(SecurityAlert)
        .filter(
            SecurityAlert.user_id == user_id,
            SecurityAlert.alert_type == "download_spike",
            SecurityAlert.status == "open",
            SecurityAlert.created_at >= since,
        )
        .first()
    )

    if existing:
        return existing

    alert = SecurityAlert(
        user_id=user_id,
        alert_type="download_spike",
        severity="medium",
        title="Unusual download activity",
        description=(
            f"{count} file downloads were detected "
            "within the last 10 minutes."
        ),
        metadata_json={
            "download_count": count,
            "window_minutes": 10,
        },
    )

    db.add(alert)
    db.commit()
    db.refresh(alert)

    notify_security_alert(
        db,
        user_id,
        "Unusual download activity",
        f"{count} downloads were detected in 10 minutes.",
    )

    return alert


def detect_denied_access(
    db: Session,
    user_id: int,
) -> SecurityAlert | None:

    since = datetime.utcnow() - timedelta(minutes=10)

    count = (
        db.query(func.count(AuditLog.id))
        .filter(
            AuditLog.user_id == user_id,
            AuditLog.status == "denied",
            AuditLog.created_at >= since,
        )
        .scalar()
        or 0
    )

    if count < DENIED_THRESHOLD:
        return None

    existing = (
        db.query(SecurityAlert)
        .filter(
            SecurityAlert.user_id == user_id,
            SecurityAlert.alert_type == "repeated_denied_access",
            SecurityAlert.status == "open",
            SecurityAlert.created_at >= since,
        )
        .first()
    )

    if existing:
        return existing

    alert = SecurityAlert(
        user_id=user_id,
        alert_type="repeated_denied_access",
        severity="high",
        title="Repeated unauthorized access attempts",
        description=(
            f"{count} denied access attempts were detected "
            "within the last 10 minutes."
        ),
        metadata_json={
            "denied_attempts": count,
            "window_minutes": 10,
        },
    )

    db.add(alert)
    db.commit()
    db.refresh(alert)

    notify_security_alert(
        db,
        user_id,
        "Unauthorized access detected",
        "Multiple denied access attempts were detected.",
    )

    return alert