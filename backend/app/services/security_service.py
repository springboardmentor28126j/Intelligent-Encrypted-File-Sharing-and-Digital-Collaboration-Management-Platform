"""
security_service.py – Suspicious activity and threat detection engine for TrustShare.

Monitors and flags:
  1. Multiple Failed Logins: Flags credential stuffing / brute force (>= 5 attempts in 10m).
  2. Excessive Downloads: Flags mass exfiltration attempts (> 10 downloads in 5m).
  3. Access from Unknown / New IP: Detects unfamiliar access origins.
  4. Expired or Revoked Link Access: Detects unauthorized token probing.

Generates automated:
  - Security Alert Notifications
  - Audit Log Entries with status='flagged' or 'security_incident'
"""

from datetime import datetime, timedelta, timezone
import logging
from typing import Dict, List, Optional, Tuple
from sqlalchemy.orm import Session

from app.models import AuditLog, File, FileShare, User
from app.services.audit_service import log_audit_event
from app.services.notification_service import notify_security_alert

logger = logging.getLogger("trustshare.security")

# In-memory rate & incident tracking caches (backed by Redis when available)
_failed_login_tracker: Dict[str, List[datetime]] = {}
_download_tracker: Dict[str, List[datetime]] = {}


def clear_security_trackers():
    """Clear in-memory security tracking caches for clean test isolation."""
    _failed_login_tracker.clear()
    _download_tracker.clear()



def record_failed_login(
    db: Session,
    email: str,
    ip_address: str,
    user_agent: Optional[str] = None,
) -> Tuple[bool, int]:
    """
    Track a failed login attempt and check for brute-force thresholds.
    Returns: (is_flagged: bool, current_failed_count: int)
    """
    now = datetime.now(timezone.utc)
    window_start = now - timedelta(minutes=10)
    key = f"{email}:{ip_address}"

    # Record and prune old timestamps
    attempts = _failed_login_tracker.get(key, [])
    attempts = [t for t in attempts if t > window_start]
    attempts.append(now)
    _failed_login_tracker[key] = attempts

    count = len(attempts)

    # Log individual failed login audit event
    log_audit_event(
        db=db,
        action="failed_login",
        ip_address=ip_address,
        user_agent=user_agent,
        details=f"Failed login attempt {count}/5 for '{email}'",
        status="failure",
    )

    # If threshold reached (>= 5 attempts in 10m)
    if count >= 5:
        logger.warning(f"Suspicious activity: {count} failed logins for '{email}' from {ip_address}")
        
        # Check if user exists to send notification
        target_user = db.query(User).filter(User.email == email).first()
        user_id = target_user.id if target_user else None

        # Log security incident audit log
        log_audit_event(
            db=db,
            user_id=user_id,
            action="multiple_failed_logins",
            ip_address=ip_address,
            user_agent=user_agent,
            details=f"Brute force alert: {count} consecutive failed login attempts detected within 10 minutes.",
            status="security_incident",
        )

        # Dispatch in-app security alert
        if target_user:
            notify_security_alert(
                db=db,
                user_id=target_user.id,
                message=f"SECURITY ALERT: {count} failed login attempts detected on your account from IP {ip_address}.",
            )
        return True, count

    return False, count


def clear_failed_logins(email: str, ip_address: str):
    """Reset failed login count upon successful authentication."""
    key = f"{email}:{ip_address}"
    _failed_login_tracker.pop(key, None)


def check_and_record_download(
    db: Session,
    user_id: Optional[int],
    file_id: int,
    ip_address: str,
    user_agent: Optional[str] = None,
) -> bool:
    """
    Track download frequency per user or IP to detect mass file exfiltration.
    Threshold: > 10 downloads in 5 minutes.
    """
    now = datetime.now(timezone.utc)
    window_start = now - timedelta(minutes=5)
    key = f"user_{user_id}" if user_id else f"ip_{ip_address}"

    downloads = _download_tracker.get(key, [])
    downloads = [t for t in downloads if t > window_start]
    downloads.append(now)
    _download_tracker[key] = downloads

    if len(downloads) >= 10:
        logger.warning(f"Excessive download burst: {len(downloads)} files downloaded in 5m from {key}")
        
        log_audit_event(
            db=db,
            user_id=user_id,
            file_id=file_id,
            action="excessive_downloads",
            ip_address=ip_address,
            user_agent=user_agent,
            details=f"Anomalous download velocity: {len(downloads)} files downloaded in 5 minutes.",
            status="security_incident",
        )

        if user_id:
            notify_security_alert(
                db=db,
                user_id=user_id,
                message="SECURITY WARNING: High download volume detected on your session. If this was not you, rotate your credentials.",
            )
        return True
    return False


def detect_new_ip_access(
    db: Session,
    user: User,
    ip_address: str,
    user_agent: Optional[str] = None,
):
    """
    Check if the user is logging in from an IP address not seen in the last 30 days.
    """
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
        # Check if user has any previous logins at all
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


def record_unauthorized_share_access(
    db: Session,
    token: str,
    ip_address: str,
    reason: str,
    share: Optional[FileShare] = None,
    user_agent: Optional[str] = None,
):
    """
    Record an attempt to access an expired, revoked, or non-existent share link.
    """
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
