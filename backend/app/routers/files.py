import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.file_record import FileRecord
from app.schemas.file import FileOut
from app.services.encryption_service import encrypt_bytes, decrypt_bytes
from app.services.storage_service import get_storage_backend
from app.services.audit_service import log_action

router = APIRouter(prefix="/api/files", tags=["files"])


@router.post("/upload", response_model=FileOut, status_code=201)
async def upload_file(
    request: Request,
    upload: UploadFile = File(...),
    folder: str = "/",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    contents = await upload.read()

    size_mb = len(contents) / (1024 * 1024)
    if size_mb > settings.MAX_UPLOAD_SIZE_MB:
        raise HTTPException(status_code=413, detail="File exceeds maximum allowed size")

    # --- Encrypt before it ever touches storage ---
    ciphertext, wrapped_key, nonce = encrypt_bytes(contents)

    storage = get_storage_backend()
    object_key = f"{current_user.id}/{uuid.uuid4().hex}_{upload.filename}.enc"
    storage.save(object_key, ciphertext)

    record = FileRecord(
        owner_id=current_user.id,
        filename=upload.filename,
        content_type=upload.content_type,
        size_bytes=len(contents),
        storage_object_key=object_key,
        wrapped_key=wrapped_key,
        nonce=nonce,
        folder=folder,
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    log_action(
        db, user_id=current_user.id, action="file.upload",
        resource_type="file", resource_id=str(record.id),
        ip_address=request.client.host if request.client else None,
    )
    return record


@router.get("", response_model=List[FileOut])
def list_files(
    folder: str | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(FileRecord).filter(FileRecord.owner_id == current_user.id)
    if folder:
        query = query.filter(FileRecord.folder == folder)
    return query.order_by(FileRecord.created_at.desc()).all()


@router.get("/{file_id}/download")
def download_file(
    file_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    record = db.query(FileRecord).filter(
        FileRecord.id == file_id, FileRecord.owner_id == current_user.id
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="File not found")

    storage = get_storage_backend()
    ciphertext = storage.load(record.storage_object_key)
    plaintext = decrypt_bytes(ciphertext, record.wrapped_key, record.nonce)

    log_action(
        db, user_id=current_user.id, action="file.download",
        resource_type="file", resource_id=str(record.id),
        ip_address=request.client.host if request.client else None,
    )

    def stream():
        yield plaintext

    return StreamingResponse(
        stream(),
        media_type=record.content_type or "application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{record.filename}"'},
    )


@router.delete("/{file_id}", status_code=204)
def delete_file(
    file_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    record = db.query(FileRecord).filter(
        FileRecord.id == file_id, FileRecord.owner_id == current_user.id
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="File not found")

    storage = get_storage_backend()
    storage.delete(record.storage_object_key)

    log_action(
        db, user_id=current_user.id, action="file.delete",
        resource_type="file", resource_id=str(record.id),
        ip_address=request.client.host if request.client else None,
    )

    db.delete(record)
    db.commit()
