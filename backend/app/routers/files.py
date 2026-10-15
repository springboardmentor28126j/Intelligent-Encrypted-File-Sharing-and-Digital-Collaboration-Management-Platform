import hashlib
import logging
from pathlib import Path
from urllib.parse import quote

from fastapi import APIRouter, Depends, File as UploadFileParam, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse as DownloadResponse
from fastapi.responses import Response
from sqlalchemy import or_
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import ActivityLog, File, FileEncryption, FileShare, Folder, User
from ..models.file import file_display_name, file_display_size, file_display_type, file_is_deleted
from ..schemas.file import FileRename, FileResponse
from ..services.activity_service import log_activity, log_download_notification
from ..services.encryption_service import EncryptionConfigurationError, decrypt_file_data, metadata_for_storage
from ..services.file_service import prepare_encrypted_upload
from ..services.notification_service import create_notification, notify_admins
from ..services.storage_service import StorageConfigurationError, StorageError, StorageObjectNotFoundError, get_storage_service
from ..utils.dependencies import get_current_user

router = APIRouter(prefix="/api/files", tags=["Files"])
logger = logging.getLogger(__name__)
CATEGORIES = {"Documents", "Images", "Videos", "PDFs", "Spreadsheets", "Other"}


def to_response(item: File):
    folder = getattr(item, "folder", None)
    return {
        "id": item.id,
        "owner_id": item.owner_id,
        "original_filename": file_display_name(item),
        "file_size": file_display_size(item),
        "file_type": file_display_type(item),
        "category": getattr(item, "category", None) or "Other",
        "version": getattr(item, "version", None) or 1,
        "folder_id": item.folder_id,
        "folder_name": folder.name if folder else None,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
    }


def require_file_access(file_id: int, user: User, db: Session, required_permission: str | None = None):
    item = db.get(File, file_id)
    if not item or file_is_deleted(item):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "File not found")

    if item.owner_id == user.id:
        return item, None

    share = (
        db.query(FileShare)
        .filter(
            FileShare.file_id == file_id,
            FileShare.is_revoked.is_(False),
            or_(FileShare.shared_with_user_id == user.id, FileShare.shared_with_id == user.id),
        )
        .first()
    )
    if not share:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not have access to this file")

    permission = share.permission.upper()
    if required_permission:
        desired = required_permission.upper()
        if desired == "VIEWER" and permission not in {"VIEWER", "EDITOR"}:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Viewer access is required")
        if desired == "EDITOR" and permission != "EDITOR":
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Editor access is required")

    return item, share


def owned_file(file_id: int, user: User, db: Session):
    item = db.query(File).filter(File.id == file_id, File.owner_id == user.id, File.is_deleted.is_(False)).first()
    if not item:
        raise HTTPException(404, "File not found")
    return item


@router.get("", response_model=list[FileResponse])
def list_files(search: str = Query(""), category: str = Query(""), folder_id: int | None = None, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = db.query(File).filter(File.owner_id == current_user.id, File.is_deleted.is_(False))
    if search:
        term = f"%{search}%"
        query = query.filter(or_(File.original_filename.ilike(term), File.filename.ilike(term)))
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
    storage = None
    stored = None
    try:
        encrypted, size = await prepare_encrypted_upload(file)
        storage = get_storage_service()
        stored = storage.put_encrypted(encrypted.ciphertext, file.filename)
    except ValueError as error:
        raise HTTPException(413, str(error)) from error
    except EncryptionConfigurationError as error:
        log_activity(db, current_user, "storage_upload_failed", "File encryption is not configured")
        notify_admins(
            db=db,
            type="storage_alert",
            title="File upload failed",
            message=f"Encryption configuration failed while {current_user.email} uploaded '{file.filename}'.",
        )
        raise HTTPException(503, "File encryption is not configured on the server") from error
    except StorageConfigurationError as error:
        log_activity(db, current_user, "storage_upload_failed", "Storage configuration is unavailable")
        notify_admins(
            db=db,
            type="storage_alert",
            title="File storage unavailable",
            message=f"Storage configuration failed while {current_user.email} uploaded '{file.filename}'.",
        )
        raise HTTPException(503, "File storage is not configured on the server") from error
    except StorageError as error:
        log_activity(db, current_user, "storage_upload_failed", "Encrypted file could not be stored")
        notify_admins(
            db=db,
            type="storage_alert",
            title="Encrypted upload failed",
            message=f"Encrypted storage failed while {current_user.email} uploaded '{file.filename}'.",
        )
        raise HTTPException(503, "The file could not be securely stored") from error

    content_type = file.content_type or "application/octet-stream"
    storage_path = stored.key or stored.local_path or ""
    item = File(
        owner_id=current_user.id,
        folder_id=folder_id,
        original_filename=file.filename,
        filename=file.filename,
        stored_filename=stored.key,
        file_path=stored.local_path or storage_path,
        storage_path=storage_path,
        storage_backend=stored.backend,
        storage_key=stored.key,
        file_size=size,
        size=size,
        file_type=content_type,
        content_type=content_type[:100],
        category=category,
        version=1,
        extension=Path(file.filename).suffix[:20],
        sha256_hash=hashlib.sha256(encrypted.ciphertext).hexdigest(),
        download_count=0,
        is_deleted=False,
        is_encrypted=True,
        is_public=False,
        encryption_algorithm="AES-256-GCM",
    )
    try:
        db.add(item)
        db.flush()
        db.add(FileEncryption(file_id=item.id, **metadata_for_storage(encrypted)))
        db.commit()
        db.refresh(item)
    except Exception:
        db.rollback()
        try:
            storage.delete(stored.key)
        except StorageError:
            logger.error("Uploaded object cleanup failed after database failure")
        raise
    log_activity(db, current_user, "upload", f"Uploaded {file_display_name(item)}", item.id)
    return to_response(item)


@router.get("/shared-with-me")
def shared_with_me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    shares = (
        db.query(FileShare, File, User)
        .join(File, File.id == FileShare.file_id)
        .join(User, User.id == File.owner_id)
        .filter(
            FileShare.is_revoked.is_(False),
            File.is_deleted.is_(False),
            or_(FileShare.shared_with_user_id == current_user.id, FileShare.shared_with_id == current_user.id),
        )
        .order_by(File.created_at.desc())
        .all()
    )
    response = []
    for share, file, owner in shares:
        response.append({
            "id": file.id,
            "file_id": file.id,
            "original_filename": file_display_name(file),
            "file_size": file_display_size(file),
            "file_type": file_display_type(file),
            "category": file.category or "Other",
            "version": file.version or 1,
            "owner_id": file.owner_id,
            "owner_name": owner.name,
            "shared_by": owner.name,
            "permission": share.permission,
            "created_at": file.created_at,
        })
    return response


@router.get("/{file_id}", response_model=FileResponse)
def file_details(file_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    item, _ = require_file_access(file_id, current_user, db, required_permission="VIEWER")
    return to_response(item)


@router.get("/{file_id}/download")
def download_file(file_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    item, _ = require_file_access(file_id, current_user, db, required_permission="VIEWER")
    encrypted_content = None
    item_storage_backend = getattr(item, "storage_backend", None)
    item_storage_key = getattr(item, "storage_key", None)
    if item_storage_backend and item_storage_key:
        try:
            encrypted_content = get_storage_service(item_storage_backend).get_encrypted(item_storage_key)
        except StorageObjectNotFoundError as error:
            log_activity(db, current_user, "storage_object_missing", f"Stored object is missing for file {item.id}", item.id)
            raise HTTPException(404, "The requested file is unavailable") from error
        except (StorageConfigurationError, StorageError) as error:
            log_activity(db, current_user, "storage_download_failed", f"Stored object could not be retrieved for file {item.id}", item.id)
            raise HTTPException(503, "The file is temporarily unavailable") from error
    else:
        stored_path = Path(item.file_path)
        if not stored_path.is_file():
            raise HTTPException(404, "Stored file is missing")
        try:
            encrypted_content = stored_path.read_bytes()
        except OSError as error:
            raise HTTPException(500, "The file could not be securely retrieved") from error

    if item.encryption:
        try:
            content = decrypt_file_data(encrypted_content, item.encryption)
        except ValueError as error:
            logger.error("Encrypted file integrity or retrieval failure for file_id=%s", item.id)
            raise HTTPException(422, "File integrity check failed. The file may have been modified or corrupted.") from error
        except (EncryptionConfigurationError, OSError) as error:
            logger.error("Encrypted file could not be retrieved for file_id=%s", item.id)
            raise HTTPException(500, "The file could not be securely retrieved.") from error

        if item.owner_id != current_user.id:
            owner = db.get(User, item.owner_id)
            if owner:
                log_download_notification(db, owner, current_user, file_display_name(item), item.id)
                create_notification(
                    db=db,
                    user_id=item.owner_id,
                    type="download",
                    title="File downloaded",
                    message=f"'{file_display_name(item)}' was downloaded.",
                )
        log_activity(db, current_user, "download", f"Downloaded {file_display_name(item)}", item.id)
        filename = quote(Path(file_display_name(item)).name)
        return Response(content=content, media_type=file_display_type(item), headers={"Content-Disposition": f"attachment; filename*=UTF-8''{filename}"})

    if item.owner_id != current_user.id:
        owner = db.get(User, item.owner_id)
        if owner:
            log_download_notification(db, owner, current_user, file_display_name(item), item.id)
            create_notification(
                db=db,
                user_id=item.owner_id,
                type="download",
                title="File downloaded",
                message=f"'{file_display_name(item)}' was downloaded.",
            )

    log_activity(db, current_user, "download", f"Downloaded {file_display_name(item)}", item.id)
    if item_storage_backend:
        filename = quote(Path(file_display_name(item)).name)
        return Response(content=encrypted_content, media_type=file_display_type(item), headers={"Content-Disposition": f"attachment; filename*=UTF-8''{filename}"})

    return DownloadResponse(item.file_path, filename=file_display_name(item), media_type=file_display_type(item))


@router.put("/{file_id}", response_model=FileResponse)
def rename_file(file_id: int, data: FileRename, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    item, share = require_file_access(file_id, current_user, db, required_permission="EDITOR")
    if item.owner_id != current_user.id and (not share or share.permission.upper() != "EDITOR"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the file owner or an editor can rename this file")

    new_name = Path(data.original_filename.strip()).name
    if not new_name or new_name != data.original_filename.strip():
        raise HTTPException(400, "Invalid filename")

    extension = Path(file_display_name(item)).suffix
    if extension and Path(new_name).suffix.lower() != extension.lower():
        raise HTTPException(400, "The original file extension must be preserved")

    # If file uses storage_backend (encrypted local or S3), just update original_filename in DB
    if getattr(item, "storage_backend", None) and getattr(item, "storage_key", None):
        item.original_filename = new_name
        item.filename = new_name
        item.extension = Path(new_name).suffix[:20]
        db.commit()
        db.refresh(item)
        log_activity(db, current_user, "rename", f"Renamed file to {new_name}", item.id)
        return to_response(item)

    # If it uses plain local file path:
    old_path = Path(item.file_path)
    if old_path.is_file():
        new_stored_name = f"{Path(item.stored_filename).stem.split('_')[0]}_{new_name}"
        new_path = old_path.with_name(new_stored_name)
        if new_path != old_path:
            old_path.rename(new_path)
        item.stored_filename = new_stored_name
        item.file_path = str(new_path)

    item.original_filename = new_name
    item.filename = new_name
    item.extension = Path(new_name).suffix[:20]
    db.commit()
    db.refresh(item)
    log_activity(db, current_user, "rename", f"Renamed file to {new_name}", item.id)
    return to_response(item)


@router.delete("/{file_id}")
def delete_file(file_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    item = owned_file(file_id, current_user, db)
    if item.storage_backend and item.storage_key:
        try:
            get_storage_service(item.storage_backend).delete(item.storage_key)
        except StorageObjectNotFoundError:
            pass
        except (StorageConfigurationError, StorageError) as error:
            log_activity(db, current_user, "storage_delete_failed", f"Stored object could not be removed for file {item.id}", item.id)
            raise HTTPException(503, "The file could not be removed from storage") from error
    else:
        Path(item.file_path).unlink(missing_ok=True)
    db.query(ActivityLog).filter(ActivityLog.file_id == item.id).update({ActivityLog.file_id: None}, synchronize_session=False)
    db.delete(item)
    db.commit()
    log_activity(db, current_user, "delete", f"Deleted {file_display_name(item)}")
    return {"message": "File deleted"}
