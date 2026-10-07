"""
security_service.py – Comprehensive threat detection, account lockout, and security monitoring engine.

Monitors, flags, and manages:
  1. Multiple Failed Logins & Temporary Account Lockout (configurable threshold & window).
  2. Excessive Download Velocity & Mass Exfiltration Detection.
  3. New/Unrecognized IP Address Detection.
  4. Expired/Revoked/Unauthorized Share & File Probes.
  5. Security Alerts and Suspicious Activity entity tracking with lifecycle states (OPEN, INVESTIGATING, RESOLVED).
  6. Admin-driven manual account unlocks with audit tracking.
"""

from datetime import datetime, timedelta, timezone
import logging
from typing import Any, Dict, List, Optional, Tuple
from fastapi import Request
from sqlalchemy import desc, func, or_
from sqlalchemy.orm import Session

from app.config import settings
from app.models import AuditLog, File, FileShare, SecurityAlert, SuspiciousActivity, User, UserRole
from app.services.audit_service import get_client_ip, get_user_agent, log_audit_event
from app.services.notification_service import notify_security_alert

logger = logging.getLogger("trustshare.security")

# In-memory velocity tracking caches (backed by Redis when available)
_failed_login_tracker: Dict[str, List[datetime]] = {}
_download_tracker: Dict[str, List[datetime]] = {}
_unauthorized_tracker: Dict[str, List[datetime]] = {}


def clear_security_trackers():
    """Clear in-memory security tracking caches for clean test isolation."""
    _failed_login_tracker.clear()
    _download_tracker.clear()
    _unauthorized_tracker.clear()


# ─── 1. Failed Logins & Account Lockout ────────────────────────────────────────

def record_failed_login(
    db: Session,
    email: str,
    ip_address: str,
    user_agent: Optional[str] = None,
) -> Tuple[bool, int, Optional[int]]:
    """
    Track a failed login attempt and enforce temporary account lockout.
    Returns: (is_locked: bool, current_failed_count: int, remaining_lockout_min_or_attempts: Optional[int])
    """
    now = datetime.now(timezone.utc)
    window_start = now - timedelta(minutes=settings.FAILED_LOGIN_WINDOW_MINUTES)
    clean_email = email.lower().strip()
    key = f"{clean_email}:{ip_address}"

    # Record and prune old timestamps in in-memory tracker
    attempts = _failed_login_tracker.get(key, [])
    attempts = [t for t in attempts if t > window_start]
    attempts.append(now)
    _failed_login_tracker[key] = attempts
    in_memory_count = len(attempts)

    # Check if target account exists
    target_user = db.query(User).filter(func.lower(User.email) == clean_email).first()
    user_id = target_user.id if target_user else None

    # Determine persistent count
    if target_user:
        target_user.failed_login_attempts = (target_user.failed_login_attempts or 0) + 1
        count = target_user.failed_login_attempts
    else:
        count = in_memory_count

    threshold = settings.FAILED_LOGIN_THRESHOLD
    lockout_minutes = settings.LOCKOUT_DURATION_MINUTES

    # Check if threshold reached
    if count >= threshold:
        logger.warning(
            f"Suspicious activity & account lockout: {count} failed logins for '{email}' from {ip_address}"
        )

        if target_user:
            target_user.locked_until = now + timedelta(minutes=lockout_minutes)

        # Log individual failed login + lockout audit events
        log_audit_event(
            db=db,
            user_id=user_id,
            action="failed_login",
            ip_address=ip_address,
            user_agent=user_agent,
            details=f"Failed login attempt {count}/{threshold} for '{email}' – Lockout threshold reached",
            status="failure",
        )

        log_audit_event(
            db=db,
            user_id=user_id,
            action="account_locked",
            ip_address=ip_address,
            user_agent=user_agent,
            details=f"Account temporarily locked for {lockout_minutes} minutes due to {count} consecutive failed login attempts.",
            status="security_incident",
        )

        # Create or update SecurityAlert
        alert = SecurityAlert(
            user_id=user_id,
            title="Account Temporarily Locked",
            description=f"Multiple failed login attempts ({count}) triggered an automatic {lockout_minutes}-minute temporary account lockout.",
            event_type="ACCOUNT_LOCKED",
            severity="HIGH",
            status="OPEN",
            ip_address=ip_address,
            details=f"Email: {email}, Attempts: {count}, Locked Until: {(now + timedelta(minutes=lockout_minutes)).isoformat()}",
            created_at=now,
        )
        db.add(alert)

        # Create or update SuspiciousActivity record
        suspicious = SuspiciousActivity(
            user_id=user_id,
            activity_type="SUSPICIOUS_LOGIN_ACTIVITY",
            description=f"{count} consecutive failed login attempts detected within {settings.FAILED_LOGIN_WINDOW_MINUTES} minutes.",
            attempt_count=count,
            severity="HIGH",
            status="OPEN",
            ip_address=ip_address,
            first_detected=attempts[0] if attempts else now,
            last_detected=now,
            details=f"Target: {email}, Lockout: {lockout_minutes}m",
        )
        db.add(suspicious)

        # Dispatch in-app notification
        if target_user:
            notify_security_alert(
                db=db,
                user_id=target_user.id,
                message=f"SECURITY ALERT: Your account has been temporarily locked for {lockout_minutes} minutes due to {count} consecutive failed login attempts.",
            )

        try:
            db.commit()
        except Exception as exc:
            db.rollback()
            logger.error(f"Failed to commit account lockout state: {exc}")

        return True, count, lockout_minutes

    # Threshold not reached yet
    log_audit_event(
        db=db,
        user_id=user_id,
        action="failed_login",
        ip_address=ip_address,
        user_agent=user_agent,
        details=f"Failed login attempt {count}/{threshold} for '{email}'",
        status="failure",
    )

    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        logger.error(f"Failed to commit failed login state: {exc}")

    remaining_attempts = max(0, threshold - count)
    return False, count, remaining_attempts


def clear_failed_logins(db: Session, user: Optional[User], email: str, ip_address: str):
    """Reset failed login count and clear lockout state upon successful authentication."""
    key = f"{email.lower().strip()}:{ip_address}"
    _failed_login_tracker.pop(key, None)

    if user:
        user.failed_login_attempts = 0
        user.locked_until = None
        try:
            db.commit()
        except Exception as exc:
            db.rollback()
            logger.error(f"Failed to reset user failed login attempts: {exc}")


def unlock_user_account(
    db: Session,
    user_id: int,
    admin_user: User,
    request: Optional[Request] = None,
) -> bool:
    """Admin action: Manually unlock a temporarily locked user account."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return False

    user.failed_login_attempts = 0
    user.locked_until = None

    # Clear in-memory trackers
    for key in list(_failed_login_tracker.keys()):
        if key.startswith(f"{user.email.lower().strip()}:"):
            _failed_login_tracker.pop(key, None)

    ip_addr = get_client_ip(request)
    ua = get_user_agent(request)

    # Log audit event
    log_audit_event(
        db=db,
        user_id=user.id,
        action="account_unlocked",
        ip_address=ip_addr,
        user_agent=ua,
        details=f"Account manually unlocked by Administrator ({admin_user.email})",
        status="success",
    )

    # Resolve open account locked alerts for this user
    open_alerts = (
        db.query(SecurityAlert)
        .filter(
            SecurityAlert.user_id == user.id,
            SecurityAlert.event_type.in_(["ACCOUNT_LOCKED", "SUSPICIOUS_LOGIN_ACTIVITY"]),
            SecurityAlert.status != "RESOLVED",
        )
        .all()
    )
    now = datetime.now(timezone.utc)
    for al in open_alerts:
        al.status = "RESOLVED"
        al.resolved_at = now
        al.resolved_by = admin_user.id

    # Notify user
    notify_security_alert(
        db=db,
        user_id=user.id,
        message="Your account has been unlocked by an administrator. You may now log in.",
    )

    try:
        db.commit()
        return True
    except Exception as exc:
        db.rollback()
        logger.error(f"Failed to commit account unlock: {exc}")
        return False


# ─── 2. Download Velocity & Mass Exfiltration ─────────────────────────────────

def check_and_record_download(
    db: Session,
    user_id: Optional[int],
    file_id: int,
    ip_address: str,
    user_agent: Optional[str] = None,
) -> bool:
    """
    Track download frequency per user or IP to detect mass file exfiltration.
    Threshold: > settings.EXCESSIVE_DOWNLOAD_THRESHOLD in settings.EXCESSIVE_DOWNLOAD_WINDOW_MINUTES.
    """
    now = datetime.now(timezone.utc)
    window_start = now - timedelta(minutes=settings.EXCESSIVE_DOWNLOAD_WINDOW_MINUTES)
    key = f"user_{user_id}" if user_id else f"ip_{ip_address}"

    downloads = _download_tracker.get(key, [])
    downloads = [t for t in downloads if t > window_start]
    downloads.append(now)
    _download_tracker[key] = downloads

    threshold = settings.EXCESSIVE_DOWNLOAD_THRESHOLD

    if len(downloads) >= threshold:
        logger.warning(
            f"Excessive download burst: {len(downloads)} files downloaded in {settings.EXCESSIVE_DOWNLOAD_WINDOW_MINUTES}m from {key}"
        )

        log_audit_event(
            db=db,
            user_id=user_id,
            file_id=file_id,
            action="excessive_downloads",
            ip_address=ip_address,
            user_agent=user_agent,
            details=f"Anomalous download velocity: {len(downloads)} files downloaded within {settings.EXCESSIVE_DOWNLOAD_WINDOW_MINUTES} minutes.",
            status="security_incident",
        )

        # Create SecurityAlert
        alert = SecurityAlert(
            user_id=user_id,
            title="Mass Download Activity Detected",
            description=f"Rapid download burst detected: {len(downloads)} files retrieved within {settings.EXCESSIVE_DOWNLOAD_WINDOW_MINUTES} minutes.",
            event_type="EXCESSIVE_DOWNLOADS",
            severity="HIGH",
            status="OPEN",
            ip_address=ip_address,
            details=f"File ID: {file_id}, Downloads: {len(downloads)}",
            created_at=now,
        )
        db.add(alert)

        # Create SuspiciousActivity
        suspicious = SuspiciousActivity(
            user_id=user_id,
            activity_type="EXCESSIVE_DOWNLOAD_BURST",
            description=f"{len(downloads)} downloads in {settings.EXCESSIVE_DOWNLOAD_WINDOW_MINUTES} minutes.",
            attempt_count=len(downloads),
            severity="HIGH",
            status="OPEN",
            ip_address=ip_address,
            first_detected=downloads[0],
            last_detected=now,
        )
        db.add(suspicious)

        if user_id:
            notify_security_alert(
                db=db,
                user_id=user_id,
                message="SECURITY WARNING: High download volume detected on your session. If this was not you, rotate your credentials immediately.",
            )

        try:
            db.commit()
        except Exception as exc:
            db.rollback()
            logger.error(f"Failed to commit download burst security alert: {exc}")

        return True
    return False


# ─── 3. Unrecognized IP Detection ─────────────────────────────────────────────

def detect_new_ip_access(
    db: Session,
    user: User,
    ip_address: str,
    user_agent: Optional[str] = None,
):
    """Check if the user is logging in from an IP address not seen in the last 30 days."""
    if not ip_address or ip_address in ("127.0.0.1", "localhost", "testclient"):
        return

    past_30d = datetime.now(timezone.utc) - timedelta(days=30)
    seen_ip = (
        db.query(AuditLog)
        .filter(
            AuditLog.user_id == user.id,
            AuditLog.ip_address == ip_address,
            AuditLog.action == "login",
            AuditLog.timestamp >= past_30d,
        )
        .first()
    )

    if not seen_ip:
        has_prior_login = (
            db.query(AuditLog)
            .filter(AuditLog.user_id == user.id, AuditLog.action == "login")
            .first()
        )
        if has_prior_login:
            logger.info(f"User {user.email} logged in from new IP: {ip_address}")
            notify_security_alert(
                db=db,
                user_id=user.id,
                message=f"New login detected from unrecognized IP address: {ip_address}.",
            )


# ─── 4. Unauthorized Access Tracking ──────────────────────────────────────────

def record_unauthorized_access(
    db: Session,
    user_id: Optional[int],
    file_id: Optional[int],
    ip_address: str,
    reason: str,
    user_agent: Optional[str] = None,
):
    """Record unauthorized file access attempt and detect repeated probing."""
    now = datetime.now(timezone.utc)
    key = f"unauth_{user_id or ip_address}"
    window_start = now - timedelta(minutes=settings.UNAUTHORIZED_ACCESS_WINDOW_MINUTES)

    attempts = _unauthorized_tracker.get(key, [])
    attempts = [t for t in attempts if t > window_start]
    attempts.append(now)
    _unauthorized_tracker[key] = attempts

    log_audit_event(
        db=db,
        user_id=user_id,
        file_id=file_id,
        action="unauthorized_access",
        ip_address=ip_address,
        user_agent=user_agent,
        details=f"Unauthorized file access rejected: {reason}",
        status="security_incident",
    )

    # Check repeated probe threshold
    if len(attempts) >= settings.UNAUTHORIZED_ACCESS_THRESHOLD:
        alert = SecurityAlert(
            user_id=user_id,
            title="Repeated Unauthorized File Access Detected",
            description=f"Multiple unauthorized access attempts ({len(attempts)}) detected within {settings.UNAUTHORIZED_ACCESS_WINDOW_MINUTES} minutes.",
            event_type="UNAUTHORIZED_ACCESS",
            severity="HIGH",
            status="OPEN",
            ip_address=ip_address,
            details=f"File ID: {file_id}, Reason: {reason}",
            created_at=now,
        )
        db.add(alert)

        suspicious = SuspiciousActivity(
            user_id=user_id,
            activity_type="REPEATED_UNAUTHORIZED_ACCESS",
            description=f"{len(attempts)} unauthorized file access attempts within {settings.UNAUTHORIZED_ACCESS_WINDOW_MINUTES} minutes.",
            attempt_count=len(attempts),
            severity="HIGH",
            status="OPEN",
            ip_address=ip_address,
            first_detected=attempts[0],
            last_detected=now,
        )
        db.add(suspicious)

        try:
            db.commit()
        except Exception as exc:
            db.rollback()
            logger.error(f"Failed to record repeated unauthorized access alert: {exc}")


def record_unauthorized_share_access(
    db: Session,
    token: str,
    ip_address: str,
    reason: str,
    share: Optional[FileShare] = None,
    user_agent: Optional[str] = None,
):
    """Record attempt to access an expired, revoked, or non-existent share link."""
    file_id = share.file_id if share else None
    owner_id = share.owner_id if share else None

    log_audit_event(
        db=db,
        user_id=owner_id,
        file_id=file_id,
        action="unauthorized_access",
        ip_address=ip_address,
        user_agent=user_agent,
        details=f"Unauthorized share link probe: token='{token[:10]}...', reason='{reason}'",
        status="security_incident",
    )

    if share and owner_id:
        file = db.query(File).filter(File.id == file_id).first()
        fname = file.filename if file else "Shared file"
        notify_security_alert(
            db=db,
            user_id=owner_id,
            message=f"Access attempt on expired/revoked share link for '{fname}' from IP {ip_address}.",
        )


def record_invalid_token_attempt(
    db: Session,
    ip_address: str,
    path: str,
    user_agent: Optional[str] = None,
):
    """Record suspicious JWT forging or expired token attempt on protected routes."""
    log_audit_event(
        db=db,
        action="invalid_token",
        ip_address=ip_address,
        user_agent=user_agent,
        details=f"Malformed or revoked JWT token presented at '{path}'",
        status="security_incident",
    )


# ─── 5. Security Summary & Query Endpoints ────────────────────────────────────

def get_security_summary(db: Session, current_user: User) -> Dict[str, Any]:
    """Calculate aggregated security overview metrics from real database rows."""
    is_admin = current_user.role == UserRole.admin.value
    user_id = current_user.id

    audit_query = db.query(AuditLog)
    alert_query = db.query(SecurityAlert)
    suspicious_query = db.query(SuspiciousActivity)
    user_query = db.query(User)

    if not is_admin:
        audit_query = audit_query.filter(AuditLog.user_id == user_id)
        alert_query = alert_query.filter(SecurityAlert.user_id == user_id)
        suspicious_query = suspicious_query.filter(SuspiciousActivity.user_id == user_id)
        user_query = user_query.filter(User.id == user_id)

    total_security_events = audit_query.filter(
        or_(
            AuditLog.status.in_(["security_incident", "failure"]),
            AuditLog.action.in_([
                "failed_login", "account_locked", "unauthorized_access",
                "multiple_failed_logins", "excessive_downloads", "invalid_token"
            ])
        )
    ).count()

    suspicious_count = suspicious_query.filter(SuspiciousActivity.status != "RESOLVED").count()
    failed_logins = audit_query.filter(AuditLog.action == "failed_login").count()

    now = datetime.now(timezone.utc)
    locked_accounts = user_query.filter(User.locked_until > now).count()
    unauthorized_attempts = audit_query.filter(AuditLog.action == "unauthorized_access").count()
    open_alerts = alert_query.filter(
        SecurityAlert.status.in_(["OPEN", "INVESTIGATING"]),
        SecurityAlert.severity.in_(["HIGH", "CRITICAL"]),
    ).count()

    # Severity distribution
    severity_breakdown = {
        "INFO": alert_query.filter(SecurityAlert.severity == "INFO").count(),
        "WARNING": alert_query.filter(SecurityAlert.severity == "WARNING").count(),
        "HIGH": alert_query.filter(SecurityAlert.severity == "HIGH").count(),
        "CRITICAL": alert_query.filter(SecurityAlert.severity == "CRITICAL").count(),
    }

    return {
        "total_security_events": total_security_events,
        "total_events": total_security_events,
        "suspicious_activities_count": suspicious_count,
        "failed_login_attempts": failed_logins,
        "locked_accounts_count": locked_accounts,
        "unauthorized_access_attempts": unauthorized_attempts,
        "unauthorized_access_count": unauthorized_attempts,
        "open_alerts_count": open_alerts,
        "severity_breakdown": severity_breakdown,
    }


def list_security_alerts(
    db: Session,
    current_user: User,
    status: Optional[str] = None,
    severity: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> List[Dict[str, Any]]:
    """Retrieve security alerts with user details."""
    query = (
        db.query(
            SecurityAlert,
            User.email.label("user_email"),
        )
        .outerjoin(User, SecurityAlert.user_id == User.id)
    )

    if current_user.role != UserRole.admin.value:
        query = query.filter(SecurityAlert.user_id == current_user.id)

    if status and status != "all":
        query = query.filter(SecurityAlert.status == status.upper())
    if severity and severity != "all":
        query = query.filter(SecurityAlert.severity == severity.upper())

    rows = query.order_by(desc(SecurityAlert.created_at)).offset(offset).limit(limit).all()

    return [
        {
            "id": al.id,
            "user_id": al.user_id,
            "user_email": user_email,
            "title": al.title,
            "description": al.description,
            "event_type": al.event_type,
            "severity": al.severity,
            "status": al.status,
            "ip_address": al.ip_address,
            "details": al.details,
            "created_at": al.created_at,
            "resolved_at": al.resolved_at,
        }
        for al, user_email in rows
    ]


def update_security_alert_status(
    db: Session,
    alert_id: int,
    new_status: str,
    admin_user: User,
) -> bool:
    """Update state of a security alert (OPEN -> INVESTIGATING -> RESOLVED)."""
    alert = db.query(SecurityAlert).filter(SecurityAlert.id == alert_id).first()
    if not alert:
        return False

    alert.status = new_status.upper()
    if alert.status == "RESOLVED":
        alert.resolved_at = datetime.now(timezone.utc)
        alert.resolved_by = admin_user.id

    db.commit()
    return True


def list_suspicious_activities(
    db: Session,
    current_user: User,
    status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> List[Dict[str, Any]]:
    """Retrieve suspicious activity logs."""
    query = (
        db.query(
            SuspiciousActivity,
            User.email.label("user_email"),
        )
        .outerjoin(User, SuspiciousActivity.user_id == User.id)
    )

    if current_user.role != UserRole.admin.value:
        query = query.filter(SuspiciousActivity.user_id == current_user.id)

    if status and status != "all":
        query = query.filter(SuspiciousActivity.status == status.upper())

    rows = query.order_by(desc(SuspiciousActivity.last_detected)).offset(offset).limit(limit).all()

    return [
        {
            "id": act.id,
            "user_id": act.user_id,
            "user_email": user_email,
            "activity_type": act.activity_type,
            "description": act.description,
            "attempt_count": act.attempt_count,
            "severity": act.severity,
            "status": act.status,
            "ip_address": act.ip_address,
            "first_detected": act.first_detected,
            "last_detected": act.last_detected,
            "details": act.details,
        }
        for act, user_email in rows
    ]


def update_suspicious_activity_status(
    db: Session,
    activity_id: int,
    new_status: str,
    admin_user: User,
) -> bool:
    """Update state of a suspicious activity record."""
    act = db.query(SuspiciousActivity).filter(SuspiciousActivity.id == activity_id).first()
    if not act:
        return False
    act.status = new_status.upper()
    db.commit()
    return True


def list_locked_accounts(db: Session) -> List[Dict[str, Any]]:
    """List currently locked user accounts with remaining durations."""
    now = datetime.now(timezone.utc)
    locked_users = (
        db.query(User)
        .filter(User.locked_until > now)
        .order_by(desc(User.locked_until))
        .all()
    )

    result = []
    for u in locked_users:
        result.append({
            "id": u.id,
            "user_id": u.id,
            "email": u.email,
            "full_name": u.name,
            "role": u.role,
            "failed_login_attempts": u.failed_login_attempts,
            "locked_until": u.locked_until,
            "locked_at": u.locked_until - timedelta(minutes=settings.LOCKOUT_DURATION_MINUTES),
            "remaining_minutes": u.remaining_lockout_minutes(),
            "lock_reason": f"Exceeded maximum failed login attempts ({u.failed_login_attempts}/{settings.FAILED_LOGIN_THRESHOLD})",
            "status": "Temporarily Locked",
        })
    return result


def get_security_analytics(db: Session, days: int = 7) -> Dict[str, Any]:
    """Compute real database-driven security trends and breakdowns."""
    now = datetime.now(timezone.utc)
    start_date = (now - timedelta(days=days - 1)).replace(
        hour=0, minute=0, second=0, microsecond=0
    )

    # 1. Daily trends
    date_map = {}
    for i in range(days):
        d_str = (start_date + timedelta(days=i)).strftime("%Y-%m-%d")
        date_map[d_str] = {
            "failed_logins": 0,
            "account_lockouts": 0,
            "unauthorized_access": 0,
            "other_events": 0,
        }

    audit_rows = (
        db.query(
            func.date(AuditLog.timestamp).label("d"),
            AuditLog.action,
            func.count(AuditLog.id).label("cnt"),
        )
        .filter(AuditLog.timestamp >= start_date)
        .group_by(func.date(AuditLog.timestamp), AuditLog.action)
        .all()
    )

    events_by_type: Dict[str, int] = {}
    for row in audit_rows:
        ds = str(row.d)
        action = row.action
        cnt = row.cnt
        events_by_type[action] = events_by_type.get(action, 0) + cnt

        if ds in date_map:
            if action == "failed_login":
                date_map[ds]["failed_logins"] += cnt
            elif action == "account_locked":
                date_map[ds]["account_lockouts"] += cnt
            elif action == "unauthorized_access":
                date_map[ds]["unauthorized_access"] += cnt
            elif action in ("excessive_downloads", "invalid_token", "multiple_failed_logins"):
                date_map[ds]["other_events"] += cnt

    daily_trends = [
        {
            "date": ds,
            "failed_logins": data["failed_logins"],
            "account_lockouts": data["account_lockouts"],
            "unauthorized_access": data["unauthorized_access"],
            "other_events": data["other_events"],
        }
        for ds, data in date_map.items()
    ]

    # 2. Severity distribution
    severity_distribution = {
        "INFO": db.query(SecurityAlert).filter(SecurityAlert.severity == "INFO").count(),
        "WARNING": db.query(SecurityAlert).filter(SecurityAlert.severity == "WARNING").count(),
        "HIGH": db.query(SecurityAlert).filter(SecurityAlert.severity == "HIGH").count(),
        "CRITICAL": db.query(SecurityAlert).filter(SecurityAlert.severity == "CRITICAL").count(),
    }

    return {
        "daily_trends": daily_trends,
        "events_by_type": events_by_type,
        "severity_distribution": severity_distribution,
    }
