from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, get_current_admin
from app.core.mongo import get_action_counts_since
from app.models.models import File, User

router = APIRouter(tags=["analytics"])


def _storage_summary(db: Session, owner_id):
    total_files = db.query(func.count(File.id)).filter(
        File.owner_id == owner_id).scalar() or 0
    total_bytes = db.query(func.coalesce(func.sum(File.size_bytes), 0)).filter(
        File.owner_id == owner_id).scalar()
    return {"file_count": total_files, "total_bytes": int(total_bytes)}


@router.get("/analytics/storage")
def my_storage(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """The signed-in user's own storage usage — file count and total bytes."""
    return _storage_summary(db, current_user.id)


@router.get("/admin/analytics/storage")
def all_storage(db: Session = Depends(get_db), _admin: User = Depends(get_current_admin)):
    """Storage usage broken down per user, plus a platform-wide total."""
    per_user = []
    platform_files = 0
    platform_bytes = 0

    for user in db.query(User).all():
        summary = _storage_summary(db, user.id)
        if summary["file_count"] > 0:
            per_user.append(
                {"user_id": str(user.id), "email": user.email, **summary})
        platform_files += summary["file_count"]
        platform_bytes += summary["total_bytes"]

    # Largest storage users first — the most useful default sort for an
    # admin scanning for who's using the most space.
    per_user.sort(key=lambda u: u["total_bytes"], reverse=True)

    return {
        "platform_total": {"file_count": platform_files, "total_bytes": platform_bytes},
        "by_user": per_user,
    }


@router.get("/admin/reports/security-summary")
def security_summary(
    days: int = Query(7, le=90),
    _admin: User = Depends(get_current_admin),
):
    """Platform activity counts over the last N days — uploads, downloads,
    logins, failed logins, shares — for a quick security/activity report."""
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    counts = get_action_counts_since(since)
    return {"period_days": days, "action_counts": counts}
