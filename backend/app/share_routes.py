from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .database import SessionLocal
from .models import User, File as DBFile, FileShare
from .auth import get_current_user
from .encryption import decrypt_file
from .cloud_storage import download_encrypted_file
from .monitoring import log_activity


router = APIRouter(
    prefix="/share",
    tags=["Secure Sharing"]
)


# ============================================================
# REQUEST MODEL
# ============================================================

class ShareFileRequest(BaseModel):
    shared_with_email: str
    storage_path: str
    permission: str = "download"
    expires_in_hours: int | None = None


# ============================================================
# SHARE FILE
# ============================================================

@router.post("/")
def share_file(
    data: ShareFileRequest,
    current_user: User = Depends(get_current_user)
):
    db: Session = SessionLocal()

    try:
        # Validate permission
        if data.permission not in ["view", "download"]:
            raise HTTPException(
                status_code=400,
                detail="Permission must be 'view' or 'download'"
            )

        # Find the file in the shared database
        db_file = (
            db.query(DBFile)
            .filter(
                DBFile.owner_id == current_user.id,
                DBFile.storage_path == data.storage_path,
                DBFile.is_deleted == False
            )
            .first()
        )

        if not db_file:
            raise HTTPException(
                status_code=404,
                detail="File not found"
            )

        # Find recipient
        recipient = (
            db.query(User)
            .filter(User.email == data.shared_with_email)
            .first()
        )

        if not recipient:
            raise HTTPException(
                status_code=404,
                detail="Recipient user not found"
            )

        # Prevent self-sharing
        if recipient.id == current_user.id:
            raise HTTPException(
                status_code=400,
                detail="You cannot share a file with yourself"
            )

        # Calculate expiration
        expires_at = None

        if data.expires_in_hours is not None:
            if data.expires_in_hours <= 0:
                raise HTTPException(
                    status_code=400,
                    detail="Expiration time must be greater than 0 hours"
                )

            expires_at = (
                datetime.now(timezone.utc)
                + timedelta(hours=data.expires_in_hours)
            )

        # Check existing active share
        existing_share = (
            db.query(FileShare)
            .filter(
                FileShare.file_id == db_file.id,
                FileShare.owner_id == current_user.id,
                FileShare.shared_with_id == recipient.id,
                FileShare.is_revoked == False
            )
            .first()
        )

        if existing_share:

            if (
                existing_share.expires_at is None
                or existing_share.expires_at > datetime.now(timezone.utc)
            ):
                raise HTTPException(
                    status_code=400,
                    detail="File is already shared with this user"
                )

            # Existing share has expired
            existing_share.is_revoked = True
            existing_share.updated_at = datetime.now(timezone.utc)
            db.commit()

        # Create new share
        now = datetime.now(timezone.utc)

        new_share = FileShare(
            file_id=db_file.id,
            owner_id=current_user.id,
            shared_with_id=recipient.id,
            permission=data.permission,
            can_download=(data.permission == "download"),
            is_revoked=False,
            expires_at=expires_at,
            created_at=now,
            updated_at=now
        )

        db.add(new_share)
        db.commit()
        db.refresh(new_share)

        # Record successful share activity
        log_activity(
            db=db,
            user_id=current_user.id,
            action="FILE_SHARE",
            description=(
                f"Shared file: {db_file.filename} "
                f"with {recipient.email}"
            ),
            file_id=db_file.id,
            status="SUCCESS",
            details=(
                f"Permission: {data.permission}; "
                f"Expires: {expires_at}"
            ),
        )

        db.commit()

        return {
            "message": "File shared successfully",
            "share_id": new_share.id,
            "file_id": db_file.id,
            "filename": db_file.filename,
            "shared_with": recipient.name,
            "email": recipient.email,
            "permission": new_share.permission,
            "expires_at": new_share.expires_at,
            "created_at": new_share.created_at
        }

    finally:
        db.close()


# ============================================================
# RECEIVED SHARED FILES
# ============================================================

@router.get("/received")
def get_received_files(
    current_user: User = Depends(get_current_user)
):
    db: Session = SessionLocal()

    try:
        shares = (
            db.query(FileShare, DBFile)
            .join(
                DBFile,
                FileShare.file_id == DBFile.id
            )
            .filter(
                FileShare.shared_with_id == current_user.id,
                FileShare.is_revoked == False,
                DBFile.is_deleted == False
            )
            .all()
        )

        active_files = []
        now = datetime.now(timezone.utc)

        for share, db_file in shares:

            # Check expiration
            if (
                share.expires_at is not None
                and now > share.expires_at
            ):
                share.is_revoked = True
                share.updated_at = now
                continue

            active_files.append({
                "share_id": share.id,
                "file_id": db_file.id,
                "filename": (
                    db_file.original_filename
                    or db_file.filename
                ),
                "storage_path": db_file.storage_path,
                "owner_id": share.owner_id,
                "permission": share.permission,
                "expires_at": share.expires_at,
                "created_at": share.created_at
            })

        db.commit()

        return {
            "files": active_files
        }

    finally:
        db.close()


# ============================================================
# DOWNLOAD SHARED FILE
# ============================================================

@router.get("/download/{share_id}")
def download_shared_file(
    share_id: int,
    current_user: User = Depends(get_current_user)
):
    db: Session = SessionLocal()

    try:
        # Find share + corresponding file
        result = (
            db.query(FileShare, DBFile)
            .join(
                DBFile,
                FileShare.file_id == DBFile.id
            )
            .filter(
                FileShare.id == share_id,
                FileShare.shared_with_id == current_user.id,
                FileShare.is_revoked == False,
                DBFile.is_deleted == False
            )
            .first()
        )

        if not result:
            raise HTTPException(
                status_code=404,
                detail="Shared file not found or access has been revoked"
            )

        share, db_file = result

        # Check expiration
        if (
            share.expires_at is not None
            and datetime.now(timezone.utc) > share.expires_at
        ):
            share.is_revoked = True
            share.updated_at = datetime.now(timezone.utc)
            db.commit()

            raise HTTPException(
                status_code=403,
                detail="Shared file access has expired"
            )

        # Check permission
        if share.permission != "download":
            raise HTTPException(
                status_code=403,
                detail="Download permission not granted"
            )

        storage_path = db_file.storage_path

        # Validate storage path
        expected_prefix = f"user_{share.owner_id}/"

        if not storage_path.startswith(expected_prefix):
            raise HTTPException(
                status_code=403,
                detail="Invalid shared file path"
            )

        # Download encrypted file
        try:
            encrypted_file_data = download_encrypted_file(
                storage_path
            )
        except Exception:
            raise HTTPException(
                status_code=404,
                detail="Encrypted shared file not found"
            )

        if len(encrypted_file_data) < 13:
            raise HTTPException(
                status_code=500,
                detail="Invalid encrypted file"
            )

        # Extract nonce
        nonce = encrypted_file_data[:12]
        encrypted_data = encrypted_file_data[12:]

        # Decrypt
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
            or Path(storage_path).name
        )

        return Response(
            content=decrypted_data,
            media_type=(
                db_file.content_type
                or "application/octet-stream"
            ),
            headers={
                "Content-Disposition":
                    f'attachment; filename="{original_filename}"'
            }
        )

    finally:
        db.close()


# ============================================================
# REVOKE SHARED FILE ACCESS
# ============================================================

@router.delete("/{share_id}")
def revoke_shared_file(
    share_id: int,
    current_user: User = Depends(get_current_user)
):
    db: Session = SessionLocal()

    try:
        share = (
            db.query(FileShare)
            .filter(
                FileShare.id == share_id,
                FileShare.owner_id == current_user.id,
                FileShare.is_revoked == False
            )
            .first()
        )

        if not share:
            raise HTTPException(
                status_code=404,
                detail="Share not found or access already revoked"
            )

        share.is_revoked = True
        share.updated_at = datetime.now(timezone.utc)

        db.commit()

        # Record successful revoke activity
        log_activity(
            db=db,
            user_id=current_user.id,
            action="SHARE_REVOKE",
            description=(
                f"Revoked sharing access for file ID {share.file_id}"
            ),
            file_id=share.file_id,
            status="SUCCESS",
            details=(
                f"Share ID {share.id} revoked successfully"
            ),
        )

        db.commit()

        return {
            "message": "File sharing access revoked successfully",
            "share_id": share.id,
            "file_id": share.file_id,
            "revoked": True
        }

    finally:
        db.close()