import os
import uuid

from fastapi import APIRouter, Depends, UploadFile, File as FastFile, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.mongo import log_activity, get_recent_activity
from app.models.models import File, User

router = APIRouter(prefix="/files", tags=["files"])


@router.get("/stats")
def file_stats(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    files = db.query(File).filter(File.owner_id == current_user.id).all()
    total_bytes = sum(f.size_bytes for f in files)
    return {
        "total_files": len(files),
        "total_bytes": total_bytes,
    }


@router.post("/upload")
def upload_file(
    upload: UploadFile = FastFile(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

    file_id = uuid.uuid4()
    storage_path = os.path.join(settings.UPLOAD_DIR, f"{file_id}_{upload.filename}")

    contents = upload.file.read()
    with open(storage_path, "wb") as f:
        f.write(contents)

    file_record = File(
        id=file_id,
        owner_id=current_user.id,
        filename=upload.filename,
        storage_path=storage_path,
        size_bytes=len(contents),
    )
    db.add(file_record)
    db.commit()

    log_activity(str(current_user.id), "upload", str(file_id))

    return {"id": str(file_id), "filename": upload.filename, "size_bytes": len(contents)}


@router.get("")
def list_files(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    files = db.query(File).filter(File.owner_id == current_user.id).all()
    return [
        {
            "id": str(f.id),
            "filename": f.filename,
            "size_bytes": f.size_bytes,
            "uploaded_at": f.uploaded_at.isoformat(),
        }
        for f in files
    ]


@router.get("/{file_id}/download")
def download_file(file_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    file_record = db.query(File).filter(File.id == file_id, File.owner_id == current_user.id).first()
    if not file_record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

    log_activity(str(current_user.id), "download", file_id)

    return FileResponse(file_record.storage_path, filename=file_record.filename)
