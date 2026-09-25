from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from ..models import File, FileShare
from .activity_service import _request_ip, _request_ua
from .security_service import record_failed_file_access


def get_file_access(file_id: int, user_id: int, db: Session, required_permission: str | None = None):
    file = db.get(File, file_id)
    if not file:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

    if file.owner_id == user_id:
        return file, None

    share = db.query(FileShare).filter(
        FileShare.file_id == file_id,
        FileShare.shared_with_user_id == user_id,
    ).first()

    ip_address = _request_ip.get() if _request_ip else "Unknown"
    user_agent = _request_ua.get() if _request_ua else None

    if not share:
        record_failed_file_access(db, file, ip_address=ip_address, user_agent=user_agent)
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have access to this file")

    permission = share.permission.upper()
    if required_permission and permission not in {"OWNER", required_permission.upper()}:
        if required_permission.upper() == "VIEWER" and permission in {"VIEWER", "EDITOR"}:
            pass
        elif required_permission.upper() == "EDITOR" and permission == "EDITOR":
            pass
        else:
            record_failed_file_access(db, file, ip_address=ip_address, user_agent=user_agent)
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"This action requires {required_permission.upper()} permission")

    return file, share
