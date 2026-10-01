from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_active_user, require_admin
from app.core.database import get_db
from app.models.file import File
from app.models.collaboration import FileShare, ShareLink
from app.models.user import User
from app.services.audit import activity_report, recent_activity, suspicious_activity
from app.services.notifications import get_notifications, mark_notification_read

router = APIRouter(prefix="/monitoring", tags=["Monitoring & Analytics"])


@router.get("/activity")
def activity(
    limit: int = Query(50, ge=1, le=200),
    action: str | None = None,
    current_user=Depends(get_current_active_user),
):
    events = recent_activity(current_user.id, limit)
    if action:
        events = [e for e in events if e.get("action") == action]
    return events


@router.get("/notifications")
def notifications(
    limit: int = Query(50, ge=1, le=100),
    unread_only: bool = False,
    current_user=Depends(get_current_active_user),
):
    return get_notifications(current_user.id, limit, unread_only)


@router.patch("/notifications/{notification_id}/read")
def notification_read(notification_id: str, current_user=Depends(get_current_active_user)):
    if not mark_notification_read(current_user.id, notification_id):
        raise HTTPException(404, "Notification not found")
    return {"success": True}


@router.get("/analytics")
def analytics(current_user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    rows = db.execute(
        select(File.category, func.count(File.id))
        .where(File.owner_id == current_user.id, File.is_deleted.is_(False))
        .group_by(File.category)
    ).all()
    total_files = sum(int(c) for _, c in rows)
    quota = int(current_user.storage_quota or 0)
    used = int(current_user.used_storage or 0)
    return {
        "files": total_files,
        "categories": {str(k): int(v) for k, v in rows},
        "shared_out": int(db.scalar(select(func.count(FileShare.id)).where(FileShare.owner_id == current_user.id, FileShare.is_revoked.is_(False))) or 0),
        "active_links": int(db.scalar(select(func.count(ShareLink.id)).where(ShareLink.owner_id == current_user.id, ShareLink.is_revoked.is_(False))) or 0),
        "used_storage": used,
        "storage_quota": quota,
        "storage_remaining": max(quota - used, 0),
        "storage_percentage": round((used / quota) * 100, 2) if quota else 0,
    }


@router.get("/report")
def report(
    days: int = Query(30, ge=1, le=365),
    current_user=Depends(get_current_active_user),
):
    return {"period_days": days, "events": activity_report(current_user.id, days)}


@router.get("/security")
def security(
    current_user=Depends(get_current_active_user),
):
    return {
        "alerts": suspicious_activity(current_user.id),
        "monitoring_window_minutes": 10,
        "thresholds": {
            "failed_logins": 5,
            "downloads": 20,
            "denied_actions": 5,
        },
    }


@router.get("/admin/overview")
def admin_overview(current_user=Depends(require_admin), db: Session = Depends(get_db)):
    return {
        "users": int(db.scalar(select(func.count(User.id))) or 0),
        "files": int(db.scalar(select(func.count(File.id)).where(File.is_deleted.is_(False))) or 0),
        "shared_files": int(db.scalar(select(func.count(FileShare.id)).where(FileShare.is_revoked.is_(False))) or 0),
        "share_links": int(db.scalar(select(func.count(ShareLink.id)).where(ShareLink.is_revoked.is_(False))) or 0),
        "recent_activity": recent_activity(limit=100),
    }


@router.get("/admin/suspicious")
def admin_suspicious(limit: int = Query(200, ge=1, le=500), current_user=Depends(require_admin)):
    events = recent_activity(limit=limit)
    failed = [e for e in events if e.get("action") == "LOGIN" and e.get("status") == "failed"]
    grouped = {}
    for event in failed:
        key = (event.get("ip") or "unknown", event.get("details", {}).get("email") or "unknown")
        grouped[key] = grouped.get(key, 0) + 1
    return [
        {"ip": key[0], "email": key[1], "failed_attempts": count, "severity": "high"}
        for key, count in grouped.items()
        if count >= 5
    ]
