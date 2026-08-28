from pathlib import Path
from fastapi import APIRouter, Depends, File as UploadFileParam, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse as DownloadResponse
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import ActivityLog, File, Folder, User
from ..schemas.file import FileRename, FileResponse
from ..services.activity_service import log_activity
from ..services.file_service import save_upload
from ..utils.dependencies import get_current_user

router = APIRouter(prefix="/api/files", tags=["Files"])
CATEGORIES = {"Documents", "Images", "Videos", "PDFs", "Spreadsheets", "Other"}


def to_response(item: File):
    return {
        "id": item.id,
        "original_filename": item.original_filename,
        "file_size": item.file_size,
        "file_type": item.file_type,
        "category": item.category,
        "version": item.version,
        "folder_id": item.folder_id,
        "folder_name": item.folder.name if item.folder else None,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
    }


def owned_file(file_id: int, user: User, db: Session):
    item = db.query(File).filter(File.id == file_id, File.owner_id == user.id).first()
    if not item:
        raise HTTPException(404, "File not found")
    return item


@router.get("", response_model=list[FileResponse])
def list_files(search: str = Query(""), category: str = Query(""), folder_id: int | None = None, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = db.query(File).filter(File.owner_id == current_user.id)
    if search:
        query = query.filter(File.original_filename.ilike(f"%{search}%"))
    if category:
        query = query.filter(File.category == category)
    if folder_id is not None:
        query = query.filter(File.folder_id == folder_id)
    return [to_response(item) for item in query.order_by(File.created_at.desc()).all()]


@router.post("/upload", response_model=FileResponse, status_code=201)
async def upload_file(file: UploadFile = UploadFileParam(...), category: str = Form("Other"), folder_id: int | None = Form(None), current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if category not in CATEGORIES:
        raise HTTPException(400, "Invalid category")
    if not file.filename or Path(file.filename).name != file.filename:
        raise HTTPException(400, "Invalid filename")
    folder = None
    if folder_id is not None:
        folder = db.query(Folder).filter(Folder.id == folder_id, Folder.owner_id == current_user.id).first()
        if not folder:
            raise HTTPException(404, "Folder not found")
    try:
        stored, path, size = await save_upload(file)
    except ValueError as error:
        raise HTTPException(413, str(error)) from error
    item = File(owner_id=current_user.id, folder_id=folder_id, original_filename=file.filename, stored_filename=stored, file_path=path, file_size=size, file_type=file.content_type or "application/octet-stream", category=category)
    db.add(item)
    db.commit()
    db.refresh(item)
    log_activity(db, current_user, "upload", f"Uploaded {item.original_filename}", item.id)
    return to_response(item)


@router.get("/{file_id}", response_model=FileResponse)
def file_details(file_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return to_response(owned_file(file_id, current_user, db))


@router.get("/{file_id}/download")
def download_file(file_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    item = owned_file(file_id, current_user, db)
    if not Path(item.file_path).is_file():
        raise HTTPException(404, "Stored file is missing")
    log_activity(db, current_user, "download", f"Downloaded {item.original_filename}", item.id)
    return DownloadResponse(item.file_path, filename=item.original_filename, media_type=item.file_type)


@router.put("/{file_id}", response_model=FileResponse)
def rename_file(file_id: int, data: FileRename, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    item = owned_file(file_id, current_user, db)
    new_name = Path(data.original_filename.strip()).name
    if not new_name or new_name != data.original_filename.strip():
        raise HTTPException(400, "Invalid filename")
    old_path = Path(item.file_path)
    if not old_path.is_file():
        raise HTTPException(404, "Stored file is missing")
    extension = Path(item.original_filename).suffix
    if extension and Path(new_name).suffix.lower() != extension.lower():
        raise HTTPException(400, "The original file extension must be preserved")
    new_stored_name = f"{Path(item.stored_filename).stem.split('_')[0]}_{new_name}"
    new_path = old_path.with_name(new_stored_name)
    if new_path != old_path:
        old_path.rename(new_path)
    item.original_filename = new_name
    item.stored_filename = new_stored_name
    item.file_path = str(new_path)
    db.commit()
    db.refresh(item)
    log_activity(db, current_user, "rename", f"Renamed file to {new_name}", item.id)
    return to_response(item)


@router.delete("/{file_id}")
def delete_file(file_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    item = owned_file(file_id, current_user, db)
    db.query(ActivityLog).filter(ActivityLog.file_id == item.id).update({ActivityLog.file_id: None}, synchronize_session=False)
    Path(item.file_path).unlink(missing_ok=True)
    db.delete(item)
    db.commit()
    log_activity(db, current_user, "delete", f"Deleted {item.original_filename}")
    return {"message": "File deleted"}
