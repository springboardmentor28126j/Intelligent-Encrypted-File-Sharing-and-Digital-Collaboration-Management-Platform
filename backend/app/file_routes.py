from datetime import datetime, timezone
from fastapi import APIRouter, UploadFile, File as UploadFileType, Depends, HTTPException
from fastapi.responses import Response
from pathlib import Path
import uuid
import hashlib

from sqlalchemy.orm import Session

from .auth import get_current_user
from .database import SessionLocal
from .models import File as DBFile
from .encryption import encrypt_file, decrypt_file
from .cloud_storage import (
    upload_encrypted_file,
    download_encrypted_file,
    delete_encrypted_file,
    SUPABASE_BUCKET
)

router = APIRouter(prefix="/files", tags=["Files"])

MAX_FILE_SIZE = 50 * 1024 * 1024


@router.post("/upload")
def upload_file(
    file: UploadFile = UploadFileType(...),
    current_user=Depends(get_current_user)
):
    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="No file selected"
        )

    safe_filename = Path(file.filename).name
    file_data = file.file.read()

    if not file_data:
        raise HTTPException(
            status_code=400,
            detail="Uploaded file is empty"
        )

    if len(file_data) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail="File size exceeds the 50 MB limit"
        )

    # Generate unique storage filename
    file_uuid = str(uuid.uuid4())

    # Encrypt file using AES-256-GCM
    nonce, encrypted_data = encrypt_file(file_data)
    encrypted_file_data = nonce + encrypted_data

    # Store encrypted file in Supabase Storage
    storage_path = (
        f"user_{current_user.id}/"
        f"{file_uuid}_{safe_filename}"
    )

    try:
        upload_encrypted_file(
            storage_path,
            encrypted_file_data
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Cloud upload failed: {str(e)}"
        )

    # Calculate SHA-256 hash of original file
    sha256_hash = hashlib.sha256(file_data).hexdigest()

    # File metadata for shared database
    db = SessionLocal()

    try:
        new_file = DBFile(
            owner_id=current_user.id,
            filename=safe_filename,
            storage_path=storage_path,
            content_type=file.content_type,
            size=len(file_data),
            category="other",
            is_deleted=False,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
            is_encrypted=True,
            encryption_nonce=nonce.hex(),
            storage_backend="supabase",
            extension=Path(safe_filename).suffix,
            sha256_hash=sha256_hash,
            encryption_algorithm="AES-256-GCM",
            download_count=0,
            is_public=False,
            original_filename=safe_filename,
            stored_filename=f"{file_uuid}_{safe_filename}",
            file_size=len(file_data),
            file_type=file.content_type or "application/octet-stream",
            version=1
        )

        db.add(new_file)
        db.commit()
        db.refresh(new_file)

        return {
            "message": "File encrypted and uploaded to cloud successfully",
            "file_id": new_file.id,
            "filename": safe_filename,
            "storage_path": storage_path,
            "bucket": SUPABASE_BUCKET,
            "encryption": "AES-256-GCM",
            "storage": "Supabase Storage",
            "uploaded_by": current_user.name
        }

    except Exception as e:
        db.rollback()

        # If database insertion fails, remove the cloud file
        try:
            delete_encrypted_file(storage_path)
        except Exception:
            pass

        raise HTTPException(
            status_code=500,
            detail=f"File metadata database save failed: {str(e)}"
        )

    finally:
        db.close()


@router.get("/")
def list_files(
    current_user=Depends(get_current_user)
):
    db: Session = SessionLocal()

    try:
        db_files = (
            db.query(DBFile)
            .filter(
                DBFile.owner_id == current_user.id,
                DBFile.is_deleted == False
            )
            .order_by(DBFile.created_at.desc())
            .all()
        )

        files = []

        for db_file in db_files:
            files.append({
                "file_id": db_file.id,
                "filename": db_file.filename,
                "storage_path": db_file.storage_path,
                "size": db_file.size,
                "encrypted": db_file.is_encrypted,
                "storage": db_file.storage_backend
            })

        return {
            "files": files
        }

    finally:
        db.close()


@router.get("/download/{filename:path}")
def download_file(
    filename: str,
    current_user=Depends(get_current_user)
):
    safe_path = Path(filename)

    if safe_path.is_absolute() or ".." in safe_path.parts:
        raise HTTPException(
            status_code=400,
            detail="Invalid file path"
        )

    if not filename.startswith(f"user_{current_user.id}/"):
        filename = f"user_{current_user.id}/{filename}"

    db = SessionLocal()

    try:
        db_file = (
            db.query(DBFile)
            .filter(
                DBFile.owner_id == current_user.id,
                DBFile.storage_path == filename,
                DBFile.is_deleted == False
            )
            .first()
        )

        if not db_file:
            raise HTTPException(
                status_code=404,
                detail="File record not found"
            )

        try:
            encrypted_file_data = download_encrypted_file(filename)
        except Exception:
            raise HTTPException(
                status_code=404,
                detail="Encrypted file not found"
            )

        if len(encrypted_file_data) < 13:
            raise HTTPException(
                status_code=500,
                detail="Invalid encrypted file"
            )

        nonce = encrypted_file_data[:12]
        encrypted_data = encrypted_file_data[12:]

        try:
            decrypted_data = decrypt_file(
                nonce,
                encrypted_data
            )
        except Exception:
            raise HTTPException(
                status_code=500,
                detail="File decryption failed"
            )

        # Update download count
        db_file.download_count = (
            db_file.download_count or 0
        ) + 1

        db.commit()

        original_filename = (
            db_file.original_filename
            or db_file.filename
            or Path(filename).name
        )

        return Response(
            content=decrypted_data,
            media_type=db_file.content_type
            or "application/octet-stream",
            headers={
                "Content-Disposition":
                    f'attachment; filename="{original_filename}"'
            }
        )

    finally:
        db.close()


@router.delete("/{filename:path}")
def delete_file(
    filename: str,
    current_user=Depends(get_current_user)
):
    safe_path = Path(filename)

    if safe_path.is_absolute() or ".." in safe_path.parts:
        raise HTTPException(
            status_code=400,
            detail="Invalid file path"
        )

    expected_prefix = f"user_{current_user.id}/"

    if not filename.startswith(expected_prefix):
        raise HTTPException(
            status_code=403,
            detail="You do not have permission to delete this file"
        )

    db = SessionLocal()

    try:
        db_file = (
            db.query(DBFile)
            .filter(
                DBFile.owner_id == current_user.id,
                DBFile.storage_path == filename,
                DBFile.is_deleted == False
            )
            .first()
        )

        if not db_file:
            raise HTTPException(
                status_code=404,
                detail="File record not found"
            )

        try:
            delete_encrypted_file(filename)
        except Exception:
            raise HTTPException(
                status_code=404,
                detail="Cloud file not found"
            )

        # Soft delete in shared database
        db_file.is_deleted = True
        db_file.updated_at = datetime.now(timezone.utc)

        db.commit()

        return {
            "message": "Encrypted cloud file deleted successfully",
            "file_id": db_file.id,
            "storage_path": filename
        }

    finally:
        db.close()