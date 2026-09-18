from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_admin
from app.core.mongo import get_all_activity, count_recent_failed_logins
from app.models.models import User

router = APIRouter(prefix="/admin", tags=["admin"])

# How many failed logins within the window below counts as suspicious.
# Tuned conservatively for now — can be moved to settings/env later.
FAILED_LOGIN_THRESHOLD = 5
FAILED_LOGIN_WINDOW_MINUTES = 15


@router.get("/audit-logs")
def list_audit_logs(
    limit: int = Query(50, le=200),
    skip: int = 0,
    category: str | None = None,
    _admin: User = Depends(get_current_admin),
):
    """Full activity feed across every user — not scoped to one account.

    category="security" filters to auth/access events (failed logins etc.)
    rather than routine usage (uploads, downloads, shares).
    """
    return get_all_activity(limit=limit, skip=skip, category=category)


@router.get("/security/suspicious-logins")
def suspicious_logins(db: Session = Depends(get_db), _admin: User = Depends(get_current_admin)):
    """Flag any user with an unusual number of failed logins recently.

    This is a deliberately simple first pass — a per-user threshold over a
    fixed time window — rather than anything ML-based. It's meant to catch
    obvious brute-force attempts, not subtle abuse.
    """
    since = (datetime.now(timezone.utc) -
             timedelta(minutes=FAILED_LOGIN_WINDOW_MINUTES)).isoformat()

    flagged = []
    for user in db.query(User).all():
        failed_count = count_recent_failed_logins(str(user.id), since)
        if failed_count >= FAILED_LOGIN_THRESHOLD:
            flagged.append(
                {
                    "user_id": str(user.id),
                    "email": user.email,
                    "failed_login_count": failed_count,
                    "window_minutes": FAILED_LOGIN_WINDOW_MINUTES,
                }
            )

    return {"flagged_users": flagged, "threshold": FAILED_LOGIN_THRESHOLD}
