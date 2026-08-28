from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import ActivityLog, File, Folder, User
from ..schemas.activity import ActivityResponse
from ..schemas.file import FileResponse
from ..utils.dependencies import get_current_user

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


@router.get("")
def dashboard(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    files = db.query(File).filter(File.owner_id == current_user.id).order_by(File.created_at.desc()).all()
    activity = db.query(ActivityLog).filter(ActivityLog.user_id == current_user.id).order_by(ActivityLog.created_at.desc()).limit(5).all()
    return {"stats": {"total_files": len(files), "storage_used": sum(item.file_size for item in files), "total_folders": db.query(func.count(Folder.id)).filter(Folder.owner_id == current_user.id).scalar() or 0}, "recent_files": files[:5], "recent_activity": activity}
