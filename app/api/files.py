from datetime import datetime, timezone
from pathlib import Path
from typing import Annotated
from uuid import uuid4

from app.api.dependencies import CurrentUserDep, DatabaseDep
from app.models.file import File as FileModel
from app.models.file import FileCategory, Folder
from app.services.encryption import decrypt_file, encrypt_file
from app.services.file_utils import get_file_category
from cryptography.exceptions import InvalidTag
from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import Response
from sqlalchemy.exc import SQLAlchemyError

router = APIRouter(
    prefix="/files",
    tags=["Files"],
)

STORAGE_DIR = Path("storage")
STORAGE_DIR.mkdir(exist_ok=True)

MAX_FILE_SIZE = 10 * 1024 * 1024

UploadedFileDep = Annotated[
    UploadFile,
    File(),
]


@router.get("/search")
def search_files(
    current_user: CurrentUserDep,
    db: DatabaseDep,
    name: Annotated[
        str | None,
        Query(description="Case-insensitive filename filter"),
    ] = None,
    category: Annotated[
        FileCategory | None,
        Query(description="File category enum filter"),
    ] = None,
    folder_id: Annotated[
        int | None,
        Query(description="Filter by specific parent folder"),
    ] = None,
    content_type: Annotated[
        str | None,
        Query(description="Filter by MIME content type"),
    ] = None,
    start_date: Annotated[
        datetime | None,
        Query(description="Files created on or after (ISO 8601 format)"),
    ] = None,
    end_date: Annotated[
        datetime | None,
        Query(description="Files created on or before (ISO 8601 format)"),
    ] = None,
):
    """Searches active (non-deleted) files belonging to the current user."""
    query = db.query(FileModel).filter(
        FileModel.owner_id == current_user.id,
        FileModel.is_deleted.is_(False),
    )

    if name:
        query = query.filter(FileModel.filename.ilike(f"%{name.strip()}%"))

    if category:
        query = query.filter(FileModel.category == category)

    if folder_id is not None:
        query = query.filter(FileModel.folder_id == folder_id)

    if content_type:
        query = query.filter(FileModel.content_type.ilike(f"%{content_type.strip()}%"))

    if start_date:
        query = query.filter(FileModel.created_at >= start_date)

    if end_date:
        query = query.filter(FileModel.created_at <= end_date)

    files = query.order_by(FileModel.created_at.desc()).all()

    return [
        {
            "id": file.id,
            "filename": file.filename,
            "folder_id": file.folder_id,
            "category": file.category,
            "content_type": file.content_type,
            "size": file.size,
            "created_at": file.created_at,
        }
        for file in files
    ]

@router.get("/quota")
def get_storage_quota(current_user: CurrentUserDep):
    """Returns the current user's used storage and total quota in bytes."""
    return {
        "used_storage": current_user.used_storage,
        "storage_quota": current_user.storage_quota,
        "usage_percentage": round(
            (current_user.used_storage / current_user.storage_quota) * 100, 2
        )
        if current_user.storage_quota > 0
        else 0,
    }


@router.post("/upload")
def upload_file(
    uploaded_file: UploadedFileDep,
    current_user: CurrentUserDep,
    db: DatabaseDep,
    folder_id: int | None = Form(None),
):
    if not uploaded_file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Filename is required",
        )

    # Validate parent folder ownership if folder_id is supplied
    if folder_id is not None:
        folder = (
            db.query(Folder)
            .filter(
                Folder.id == folder_id,
                Folder.owner_id == current_user.id,
                Folder.is_deleted.is_(False),
            )
            .first()
        )
        if not folder:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Folder not found",
            )

    content = uploaded_file.file.read()

    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot upload an empty file",
        )

    file_size = len(content)

    if file_size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File size exceeds the 10 MB limit",
        )

    # Check quota before proceeding
    if current_user.used_storage + file_size > current_user.storage_quota:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Storage quota exceeded",
        )

    original_name = Path(uploaded_file.filename).name
    category = get_file_category(original_name)

    file_id = uuid4().hex
    storage_filename = file_id
    storage_path = STORAGE_DIR / storage_filename

    # Encrypt before storing
    encrypted_content = encrypt_file(content)
    storage_path.write_bytes(encrypted_content)

    file_record = FileModel(
        owner_id=current_user.id,
        folder_id=folder_id,
        filename=original_name,
        storage_path=str(storage_path),
        content_type=uploaded_file.content_type,
        category=category,
        size=file_size,
        is_deleted=False,
        created_at=datetime.now(timezone.utc),
    )

    current_user.used_storage += file_size

    db.add(file_record)
    db.add(current_user)
    db.commit()
    db.refresh(file_record)

    return {
        "message": "File uploaded successfully",
        "file_id": file_record.id,
        "filename": file_record.filename,
        "folder_id": file_record.folder_id,
        "size": file_record.size,
        "category": file_record.category,
        "used_storage": current_user.used_storage,
    }


@router.get("/")
def list_files(
    current_user: CurrentUserDep,
    db: DatabaseDep,
    folder_id: int | None = None,
):
    """Lists active (non-deleted) files for the current user."""
    query = db.query(FileModel).filter(
        FileModel.owner_id == current_user.id,
        FileModel.is_deleted.is_(False),
    )

    if folder_id is None:
        query = query.filter(FileModel.folder_id.is_(None))
    else:
        query = query.filter(FileModel.folder_id == folder_id)

    files = query.order_by(FileModel.created_at.desc()).all()

    return [
        {
            "id": file.id,
            "filename": file.filename,
            "folder_id": file.folder_id,
            "category": file.category,
            "content_type": file.content_type,
            "size": file.size,
            "created_at": file.created_at,
        }
        for file in files
    ]


@router.get("/trash")
def list_trash(
    current_user: CurrentUserDep,
    db: DatabaseDep,
):
    """Lists all soft-deleted files for the current user."""
    files = (
        db.query(FileModel)
        .filter(
            FileModel.owner_id == current_user.id,
            FileModel.is_deleted.is_(True),
        )
        .order_by(FileModel.created_at.desc())
        .all()
    )

    return [
        {
            "id": file.id,
            "filename": file.filename,
            "folder_id": file.folder_id,
            "category": file.category,
            "content_type": file.content_type,
            "size": file.size,
            "created_at": file.created_at,
        }
        for file in files
    ]


@router.get("/{file_id}/download")
def download_file(
    file_id: int,
    current_user: CurrentUserDep,
    db: DatabaseDep,
):
    file_record = (
        db.query(FileModel)
        .filter(
            FileModel.id == file_id,
            FileModel.owner_id == current_user.id,
            FileModel.is_deleted.is_(False),
        )
        .first()
    )

    if not file_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found",
        )

    file_path = Path(file_record.storage_path)

    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Stored file not found",
        )

    try:
        encrypted_content = file_path.read_bytes()
        decrypted_content = decrypt_file(encrypted_content)

    except OSError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to read stored file",
        )

    except InvalidTag:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="File integrity verification failed",
        )

    return Response(
        content=decrypted_content,
        media_type=(
            file_record.content_type or "application/octet-stream"
        ),
        headers={
            "Content-Disposition": (
                f'attachment; filename="{file_record.filename}"'
            )
        },
    )


@router.delete("/{file_id}")
def soft_delete_file(
    file_id: int,
    current_user: CurrentUserDep,
    db: DatabaseDep,
):
    """Soft deletes a file by moving it to the trash."""
    file_record = (
        db.query(FileModel)
        .filter(
            FileModel.id == file_id,
            FileModel.owner_id == current_user.id,
            FileModel.is_deleted.is_(False),
        )
        .first()
    )

    if not file_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found",
        )

    file_record.is_deleted = True
    db.add(file_record)
    db.commit()

    return {
        "message": "File moved to trash successfully",
        "file_id": file_record.id,
    }


@router.post("/{file_id}/restore")
def restore_file(
    file_id: int,
    current_user: CurrentUserDep,
    db: DatabaseDep,
):
    """Restores a soft-deleted file back from the trash."""
    file_record = (
        db.query(FileModel)
        .filter(
            FileModel.id == file_id,
            FileModel.owner_id == current_user.id,
            FileModel.is_deleted.is_(True),
        )
        .first()
    )

    if not file_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found in trash",
        )

    file_record.is_deleted = False
    db.add(file_record)
    db.commit()

    return {
        "message": "File restored successfully",
        "file_id": file_record.id,
    }


@router.delete("/{file_id}/permanent")
def permanently_delete_file(
    file_id: int,
    current_user: CurrentUserDep,
    db: DatabaseDep,
):
    """Permanently deletes a file from disk and DB, reclaiming quota."""
    file_record = (
        db.query(FileModel)
        .filter(
            FileModel.id == file_id,
            FileModel.owner_id == current_user.id,
        )
        .first()
    )

    if not file_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found",
        )

    file_path = Path(file_record.storage_path)
    file_size = file_record.size

    try:
        if file_path.exists():
            file_path.unlink()

        # Reclaim user storage quota upon physical deletion
        current_user.used_storage = max(
            0,
            current_user.used_storage - file_size,
        )

        db.delete(file_record)
        db.add(current_user)
        db.commit()

    except (OSError, SQLAlchemyError):
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Permanent file deletion failed",
        )

    return {
        "message": "File permanently deleted",
        "used_storage": current_user.used_storage,
    }