from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import ActivityLog, File, Folder, User
from ..models.file import file_display_size
from ..routers.files import to_response
from ..utils.dependencies import get_current_user

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])

DEFAULT_LIMIT = 100 * 1024 * 1024  # 100 MB default


@router.get("")
def dashboard(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    files = (
        db.query(File)
        .filter(File.owner_id == current_user.id, File.is_deleted.is_(False))
        .order_by(File.created_at.desc())
        .all()
    )
    activity = (
        db.query(ActivityLog)
        .filter(ActivityLog.user_id == current_user.id)
        .order_by(ActivityLog.created_at.desc())
        .limit(5)
        .all()
    )

    total_storage_used = sum(file_display_size(item) for item in files)
    storage_limit = getattr(current_user, "storage_quota", None) or DEFAULT_LIMIT
    storage_percentage = round((total_storage_used / storage_limit) * 100, 2) if storage_limit else 0.0

    # Calculate real categories dynamically
    category_map = {}
    
    # Use timezone-aware UTC datetime
    now_utc = datetime.now(timezone.utc)
    seven_days_ago = now_utc - timedelta(days=7)
    recent_uploads = 0

    for item in files:
        cat = getattr(item, "category", None) or "Other"
        size = file_display_size(item)
        if cat not in category_map:
            # Fix: Start count at 1, not 0
            category_map[cat] = {"category": cat, "count": 1, "size_bytes": size}
        else:
            category_map[cat]["count"] += 1
            category_map[cat]["size_bytes"] += size

        if item.created_at:
            item_created = item.created_at
            if item_created.tzinfo is None:
                item_created = item_created.replace(tzinfo=timezone.utc)
            if item_created >= seven_days_ago:
                recent_uploads += 1

    return {
        "stats": {
            "total_files": len(files),
            "storage_used": int(total_storage_used),
            "storage_limit": int(storage_limit),
            "storage_percentage": min(storage_percentage, 100.0),
            "total_folders": db.query(func.count(Folder.id)).filter(Folder.owner_id == current_user.id).scalar() or 0,
            "recent_uploads_count": recent_uploads,
        },
        "category_breakdown": list(category_map.values()),
        "recent_files": [to_response(item) for item in files[:5]],
        "recent_activity": activity,
    }