from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Folder, User
from ..schemas.folder import FolderCreate, FolderResponse
from ..services.activity_service import log_activity
from ..utils.dependencies import get_current_user

router = APIRouter(prefix="/api/folders", tags=["Folders"])


@router.get("", response_model=list[FolderResponse])
def list_folders(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Folder).filter(Folder.owner_id == current_user.id).order_by(Folder.name).all()


@router.post("", response_model=FolderResponse, status_code=201)
def create_folder(data: FolderCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    folder = Folder(name=data.name.strip(), owner_id=current_user.id)
    db.add(folder)
    db.commit()
    db.refresh(folder)
    log_activity(db, current_user, "folder_create", f"Created folder {folder.name}")
    return folder


@router.delete("/{folder_id}")
def delete_folder(folder_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    folder = db.query(Folder).filter(Folder.id == folder_id, Folder.owner_id == current_user.id).first()
    if not folder:
        raise HTTPException(404, "Folder not found")
    if folder.files:
        raise HTTPException(400, "Folder must be empty before deletion")
    db.delete(folder)
    db.commit()
    return {"message": "Folder deleted"}
