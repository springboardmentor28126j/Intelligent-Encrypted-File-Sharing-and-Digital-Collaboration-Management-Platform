import csv
import io
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import ActivityLog, File, User
from ..models.file import file_display_size
from ..services.activity_service import log_activity
from ..services.notification_service import notify_admins
from ..utils.dependencies import require_admin

router = APIRouter(prefix="/api/admin", tags=["Administration"])


def _activity_query(
    db: Session,
    user_id: int | None = None,
    action: str = "",
    start_date: str = "",
    end_date: str = "",
):
    query = (
        db.query(ActivityLog, User, File)
        .join(User, User.id == ActivityLog.user_id)
        .outerjoin(File, File.id == ActivityLog.file_id)
        .order_by(ActivityLog.created_at.desc())
    )
    if user_id is not None:
        query = query.filter(ActivityLog.user_id == user_id)
    if action:
        query = query.filter(ActivityLog.action == action)
    if start_date:
        try:
            query = query.filter(ActivityLog.created_at >= datetime.strptime(start_date, "%Y-%m-%d"))
        except ValueError:
            raise HTTPException(400, "start_date must use YYYY-MM-DD format")
    if end_date:
        try:
            end = datetime.strptime(end_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59, microsecond=999999)
            query = query.filter(ActivityLog.created_at <= end)
        except ValueError:
            raise HTTPException(400, "end_date must use YYYY-MM-DD format")
    return query


def _activity_rows(db: Session, limit: int, offset: int = 0, user_id: int | None = None, action: str = "", start_date: str = "", end_date: str = ""):
    return [
        {
            "id": log.id,
            "user_name": user.name,
            "user_email": user.email,
            "action": log.action,
            "description": log.description,
            "created_at": log.created_at,
        }
        for log, user, _file in _activity_query(db, user_id, action, start_date, end_date).offset(offset).limit(limit).all()
    ]


@router.get("/overview")
def admin_overview(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    files = db.query(File).filter(File.is_deleted.is_(False)).all()
    return {
        "stats": {
            "total_users": db.query(func.count(User.id)).scalar() or 0,
            "active_users": db.query(func.count(User.id)).filter(User.is_active.is_(True)).scalar() or 0,
            "total_files": len(files),
            "storage_used": sum(file_display_size(item) for item in files),
            "total_activity": db.query(func.count(ActivityLog.id)).scalar() or 0,
        },
        "admin": {"id": admin.id, "email": admin.email},
        "role_counts": {
            "admin": db.query(func.count(User.id)).filter(func.lower(User.role) == "admin").scalar() or 0,
            "user": db.query(func.count(User.id)).filter(func.lower(User.role) == "user").scalar() or 0,
        },
        "recent_activity": _activity_rows(db, limit=10),
    }


@router.get("/activity")
def list_admin_activity(
    limit: int = 10,
    offset: int = 0,
    action: str = "",
    start_date: str = "",
    end_date: str = "",
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return _activity_rows(db, limit=max(1, min(limit, 100)), offset=max(0, offset), action=action, start_date=start_date, end_date=end_date)


@router.get("/users/{user_id}/activity")
def list_user_activity(
    user_id: int,
    limit: int = 100,
    offset: int = 0,
    action: str = "",
    start_date: str = "",
    end_date: str = "",
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if not db.get(User, user_id):
        raise HTTPException(404, "User not found")
    return _activity_rows(db, limit=max(1, min(limit, 200)), offset=max(0, offset), user_id=user_id, action=action, start_date=start_date, end_date=end_date)


@router.get("/activity/export")
def export_admin_activity(
    user_id: int | None = None,
    action: str = "",
    start_date: str = "",
    end_date: str = "",
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Timestamp", "User", "Email", "Action", "File", "Description"])
    for log, user, file_item in _activity_query(db, user_id, action, start_date, end_date).all():
        writer.writerow([
            log.created_at.isoformat() if log.created_at else "",
            user.name,
            user.email,
            log.action,
            getattr(file_item, "original_filename", None) or "",
            log.description,
        ])
    return Response(
        content=output.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="trustshare_activity_export.csv"'},
    )


@router.get("/users")
def list_users(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    users = db.query(User).order_by(User.created_at.desc()).all()
    return [
        {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role,
            "is_active": user.is_active,
            "storage_quota": user.storage_quota,
            "used_storage": user.used_storage,
            "created_at": user.created_at,
        }
        for user in users
    ]


@router.patch("/users/{user_id}/status")
def update_user_status(
    user_id: int,
    data: dict,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found")
    if user.id == admin.id:
        raise HTTPException(400, "You cannot deactivate your own admin account")
    if not isinstance(data.get("is_active"), bool):
        raise HTTPException(400, "is_active must be true or false")

    user.is_active = data["is_active"]
    db.commit()
    status_label = "activated" if user.is_active else "deactivated"
    log_activity(db, admin, "admin_user_status", f"{status_label.title()} user account {user.email}")
    notify_admins(
        db=db,
        type="admin_alert",
        title=f"User account {status_label}",
        message=f"{admin.email} {status_label} {user.email}.",
        exclude_user_id=admin.id,
    )
    return {"message": "User status updated", "is_active": user.is_active}


@router.patch("/users/{user_id}/role")
def update_user_role(
    user_id: int,
    data: dict,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found")
    if user.id == admin.id:
        raise HTTPException(400, "You cannot change your own admin role")
    role = str(data.get("role", "")).strip().lower()
    if role not in {"user", "admin"}:
        raise HTTPException(400, "Role must be user or admin")

    user.role = role
    db.commit()
    log_activity(db, admin, "admin_user_role", f"Changed {user.email} role to {role}")
    notify_admins(
        db=db,
        type="admin_alert",
        title="User role changed",
        message=f"{admin.email} changed {user.email} role to {role}.",
        exclude_user_id=admin.id,
    )
    return {"message": "User role updated", "role": user.role}


@router.patch("/users/{user_id}/quota")
def update_user_quota(
    user_id: int,
    data: dict,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found")
    try:
        quota = int(data.get("storage_quota"))
    except (TypeError, ValueError):
        raise HTTPException(400, "storage_quota must be an integer in bytes")
    if quota < user.used_storage or quota <= 0:
        raise HTTPException(400, "Quota must be greater than current usage")

    user.storage_quota = quota
    db.commit()
    return {"message": "Storage quota updated", "storage_quota": user.storage_quota}
