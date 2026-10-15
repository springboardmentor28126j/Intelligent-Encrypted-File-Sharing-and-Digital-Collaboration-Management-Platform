import logging
import time
from datetime import datetime
from sqlalchemy.orm import Session

from ..models import ActivityLog, File, User
from ..services.activity_service import log_activity
from ..services.notification_service import create_notification, notify_admins

logger = logging.getLogger(__name__)

# In-memory trackers for failed attempts and lockouts
_failed_logins: dict[str, list[float]] = {}
_login_lockouts: dict[str, float] = {}
_failed_file_access: dict[tuple[int, str], list[float]] = {}


def check_login_lockout(email: str) -> tuple[bool, str, int]:
    """Check if an email account is currently locked out from logging in due to repeated failures.
    Returns (is_locked, error_message, remaining_seconds).
    """
    if not email:
        return False, "", 0
    key = email.strip().lower()
    now = time.time()
    lockout_until = _login_lockouts.get(key)
    if lockout_until:
        if now < lockout_until:
            remaining_seconds = int(lockout_until - now)
            remaining_mins = max(1, int((remaining_seconds + 59) / 60))
            return (
                True,
                f"Too many failed attempts. Try again in {remaining_mins} minute(s).",
                remaining_seconds,
            )
        else:
            _login_lockouts.pop(key, None)
    return False, "", 0


def record_failed_login(
    db: Session,
    email: str,
    ip_address: str = "Unknown",
    user_agent: str | None = None,
) -> bool:
    """Record a failed login attempt. Enforces 1-minute lockout & triggers security alerts if 5 attempts in 10m."""
    if not email:
        return False
    key = email.strip().lower()
    now = time.time()
    ten_mins_ago = now - 600

    attempts = [t for t in _failed_logins.get(key, []) if t >= ten_mins_ago]
    attempts.append(now)
    _failed_logins[key] = attempts

    user = db.query(User).filter(User.email == key).first()

    if len(attempts) >= 5:
        # Enforce 1-minute lockout (60 seconds)
        _login_lockouts[key] = now + 60

        msg = f"Suspicious Login Detected: Multiple failed password attempts detected from System {ip_address}"

        if user:
            log_activity(
                db=db,
                user=user,
                action="SUSPICIOUS_LOGIN_ATTEMPT",
                description=msg,
                ip_address=ip_address,
                user_agent=user_agent,
            )
            create_notification(
                db=db,
                user_id=user.id,
                type="security_alert",
                title="Suspicious Login Detected",
                message=f"Multiple failed password attempts detected from System {ip_address}.",
            )
        else:
            logger.warning(
                "Suspicious login threshold reached for email=%s from System=%s",
                email,
                ip_address,
            )
        notify_admins(
            db=db,
            type="security_alert",
            title="Suspicious login attempts",
            message=f"Multiple failed login attempts were detected for {email} from System {ip_address}.",
        )
        return True
    return False


def reset_failed_login(email: str):
    """Clear failed login attempts and lockout status on successful authentication."""
    if not email:
        return
    key = email.strip().lower()
    _failed_logins.pop(key, None)
    _login_lockouts.pop(key, None)


def record_failed_file_access(
    db: Session,
    file_item: File,
    ip_address: str = "Unknown",
    user_agent: str | None = None,
) -> bool:
    """Record an unauthorized access attempt for a file. Alerts file owner if 3+ attempts occur in 10m."""
    if not file_item or not file_item.id:
        return False

    now = time.time()
    ten_mins_ago = now - 600
    key = (file_item.id, ip_address or "Unknown")

    attempts = [t for t in _failed_file_access.get(key, []) if t >= ten_mins_ago]
    attempts.append(now)
    _failed_file_access[key] = attempts

    if len(attempts) >= 3:
        owner = db.get(User, file_item.owner_id) if file_item.owner_id else None
        if owner:
            file_name = getattr(file_item, "original_filename", None) or getattr(file_item, "filename", None) or f"File #{file_item.id}"
            log_activity(
                db=db,
                user=owner,
                action="UNAUTHORIZED_ACCESS_ATTEMPT",
                description=f"Repeated unauthorized download attempts detected on '{file_name}' from System {ip_address}",
                file_id=file_item.id,
                ip_address=ip_address,
                user_agent=user_agent,
            )
            create_notification(
                db=db,
                user_id=owner.id,
                type="security_alert",
                title="Unauthorized Access Attempt",
                message=f"Repeated unauthorized download attempts detected on '{file_name}' from System {ip_address}.",
            )
            notify_admins(
                db=db,
                type="security_alert",
                title="Repeated unauthorized file access",
                message=f"Repeated unauthorized access attempts were detected on '{file_name}' from System {ip_address}.",
            )
        return True
    return False