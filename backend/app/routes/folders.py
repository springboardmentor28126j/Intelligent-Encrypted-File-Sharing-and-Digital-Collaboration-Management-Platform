from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.mongo import log_activity
from app.models.models import File, Folder, User

router = APIRouter(prefix="/folders", tags=["folders"])


class FolderCreate(BaseModel):
    name: str


class MoveFileRequest(BaseModel):
    folder_id: str | None  # null moves the file back to "no folder"


def _get_owned_folder_or_404(folder_id: str, db: Session, current_user: User) -> Folder:
    folder = db.query(Folder).filter(Folder.id == folder_id).first()
    if not folder or folder.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Folder not found")
    return folder


@router.post("")
def create_folder(payload: FolderCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    folder = Folder(owner_id=current_user.id, name=payload.name)
    db.add(folder)
    db.commit()
    db.refresh(folder)

    log_activity(str(current_user.id), "folder_created", str(folder.id))

    return {"id": str(folder.id), "name": folder.name, "created_at": folder.created_at.isoformat()}


@router.get("")
def list_folders(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Every folder the user owns, with a file count for each — enough for
    a folder list screen without a separate call per folder."""
    folders = db.query(Folder).filter(Folder.owner_id == current_user.id).order_by(
        Folder.created_at.desc()).all()

    counts = dict(
        db.query(File.folder_id, func.count(File.id))
        .filter(File.owner_id == current_user.id, File.folder_id.isnot(None))
        .group_by(File.folder_id)
        .all()
    )

    return [
        {
            "id": str(f.id),
            "name": f.name,
            "created_at": f.created_at.isoformat(),
            "file_count": counts.get(f.id, 0),
        }
        for f in folders
    ]


@router.get("/{folder_id}/files")
def list_files_in_folder(folder_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _get_owned_folder_or_404(folder_id, db, current_user)

    files = db.query(File).filter(File.folder_id == folder_id,
                                  File.owner_id == current_user.id).all()
    return [
        {"id": str(f.id), "filename": f.filename, "size_bytes": f.size_bytes,
         "uploaded_at": f.uploaded_at.isoformat()}
        for f in files
    ]


@router.delete("/{folder_id}")
def delete_folder(folder_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    folder = _get_owned_folder_or_404(folder_id, db, current_user)

    file_count = db.query(File).filter(File.folder_id == folder_id).count()
    if file_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Folder still has {file_count} file(s). Move them out before deleting.",
        )

    db.delete(folder)
    db.commit()
    log_activity(str(current_user.id), "folder_deleted", folder_id)
    return {"id": folder_id, "deleted": True}
