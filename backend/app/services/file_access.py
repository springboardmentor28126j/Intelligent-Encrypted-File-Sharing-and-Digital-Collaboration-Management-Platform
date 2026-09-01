from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from ..models import File, FileShare


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
    if not share:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have access to this file")

    permission = share.permission.upper()
    if required_permission and permission not in {"OWNER", required_permission.upper()}:
        if required_permission.upper() == "VIEWER" and permission in {"VIEWER", "EDITOR"}:
            pass
        elif required_permission.upper() == "EDITOR" and permission == "EDITOR":
            pass
        else:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"This action requires {required_permission.upper()} permission")

    return file, share
