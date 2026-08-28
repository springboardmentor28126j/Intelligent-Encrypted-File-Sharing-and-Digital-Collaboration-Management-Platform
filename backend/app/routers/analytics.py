from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.user import User
from app.models.file_record import FileRecord
from app.models.share_link import ShareLink
from app.models.audit_log import AuditLog
from app.schemas.analytics import StorageAnalytics, DailyCount, SecuritySummary

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


def _daily_counts(db: Session, action: str, user_id: int, days: int = 7) -> list[DailyCount]:
    since = datetime.now(timezone.utc) - timedelta(days=days - 1)
    rows = (
        db.query(func.date(AuditLog.created_at).label("day"), func.count(AuditLog.id))
        .filter(AuditLog.action == action, AuditLog.user_id == user_id, AuditLog.created_at >= since)
        .group_by("day")
        .all()
    )
    counts_by_day = {str(day): count for day, count in rows}

    result = []
    for i in range(days):
        d = (since + timedelta(days=i)).date()
        result.append(DailyCount(date=str(d), count=counts_by_day.get(str(d), 0)))
    return result


@router.get("/storage", response_model=StorageAnalytics)
def storage_analytics(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Per-user File Analytics: storage usage, upload reports, download
    analytics, sharing activity reports (spec section 4.7).
    """
    total_files = db.query(func.count(FileRecord.id)).filter(FileRecord.owner_id == current_user.id).scalar() or 0
    total_storage_bytes = (
        db.query(func.coalesce(func.sum(FileRecord.size_bytes), 0))
        .filter(FileRecord.owner_id == current_user.id)
        .scalar()
        or 0
    )
    total_downloads = (
        db.query(func.count(AuditLog.id))
        .filter(AuditLog.user_id == current_user.id, AuditLog.action == "file.download")
        .scalar()
        or 0
    )
    total_active_shares = (
        db.query(func.count(ShareLink.id))
        .filter(ShareLink.created_by_id == current_user.id, ShareLink.revoked.is_(False))
        .scalar()
        or 0
    )

    return StorageAnalytics(
        total_files=total_files,
        total_storage_bytes=total_storage_bytes,
        total_downloads=total_downloads,
        total_active_shares=total_active_shares,
        uploads_last_7_days=_daily_counts(db, "file.upload", current_user.id),
        downloads_last_7_days=_daily_counts(db, "file.download", current_user.id),
    )


@router.get("/security-summary", response_model=SecuritySummary)
def security_summary(
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """Admin-only Security Dashboard summary (spec section 4.7)."""
    since = datetime.now(timezone.utc) - timedelta(days=7)
    failed_logins = (
        db.query(func.count(AuditLog.id))
        .filter(AuditLog.action == "user.login_failed", AuditLog.created_at >= since)
        .scalar()
        or 0
    )
    locked = (
        db.query(func.count(AuditLog.id))
        .filter(AuditLog.action == "security.account_locked", AuditLog.created_at >= since)
        .scalar()
        or 0
    )
    total_users = db.query(func.count(User.id)).scalar() or 0

    return SecuritySummary(
        failed_logins_last_7_days=failed_logins,
        accounts_locked_last_7_days=locked,
        total_users=total_users,
    )
