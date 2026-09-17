from datetime import datetime, timedelta
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .database import SessionLocal
from .models import User, FileShare
from .auth import get_current_user
from .encryption import decrypt_file
from .cloud_storage import download_encrypted_file


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
        # ----------------------------------------------------
        # 1. Validate permission
        # ----------------------------------------------------
        if data.permission not in ["view", "download"]:
            raise HTTPException(
                status_code=400,
                detail="Permission must be 'view' or 'download'"
            )

        # ----------------------------------------------------
        # 2. Make sure the file belongs to the current user
        # ----------------------------------------------------
        expected_prefix = f"user_{current_user.id}/"

        if not data.storage_path.startswith(expected_prefix):
            raise HTTPException(
                status_code=403,
                detail="You can only share files that belong to you"
            )

        # ----------------------------------------------------
        # 3. Calculate expiration time
        # ----------------------------------------------------
        expires_at = None

        if data.expires_in_hours is not None:

            if data.expires_in_hours <= 0:
                raise HTTPException(
                    status_code=400,
                    detail="Expiration time must be greater than 0 hours"
                )

            expires_at = datetime.utcnow() + timedelta(
                hours=data.expires_in_hours
            )

        # ----------------------------------------------------
        # 4. Find recipient
        # ----------------------------------------------------
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

        # ----------------------------------------------------
        # 5. Prevent self-sharing
        # ----------------------------------------------------
        if recipient.id == current_user.id:
            raise HTTPException(
                status_code=400,
                detail="You cannot share a file with yourself"
            )

        # ----------------------------------------------------
        # 6. Check for existing active share
        # ----------------------------------------------------
        existing_share = (
            db.query(FileShare)
            .filter(
                FileShare.owner_id == current_user.id,
                FileShare.shared_with_id == recipient.id,
                FileShare.storage_path == data.storage_path,
                FileShare.is_revoked == 0
            )
            .first()
        )

        if existing_share:

            # Permanent share
            if existing_share.expires_at is None:
                raise HTTPException(
                    status_code=400,
                    detail="File is already shared with this user"
                )

            # Temporary share that has not expired
            if existing_share.expires_at > datetime.utcnow():
                raise HTTPException(
                    status_code=400,
                    detail="File is already shared with this user"
                )

            # Temporary share has expired.
            # Deactivate the old share so a new share can be created.
            existing_share.is_revoked = 1
            db.commit()

        # ----------------------------------------------------
        # 7. Create new sharing record
        # ----------------------------------------------------
        new_share = FileShare(
            owner_id=current_user.id,
            shared_with_id=recipient.id,
            storage_path=data.storage_path,
            permission=data.permission,
            expires_at=expires_at,
            is_revoked=0,
            created_at=datetime.utcnow()
        )

        db.add(new_share)
        db.commit()
        db.refresh(new_share)

        # ----------------------------------------------------
        # 8. Return share information
        # ----------------------------------------------------
        return {
            "message": "File shared successfully",
            "share_id": new_share.id,
            "shared_with": recipient.username,
            "email": recipient.email,
            "permission": new_share.permission,
            "storage_path": new_share.storage_path,
            "expires_at": new_share.expires_at,
            "created_at": new_share.created_at
        }

    finally:
        db.close()


# ============================================================
# RECEIVED SHARED FILES
# ============================================================
# ============================================================
# RECEIVED SHARED FILES
# ============================================================

@router.get("/received")
def get_received_files(
    current_user: User = Depends(get_current_user)
):
    db: Session = SessionLocal()

    try:
        # Get all active shares received by the current user
        shares = (
            db.query(FileShare)
            .filter(
                FileShare.shared_with_id == current_user.id,
                FileShare.is_revoked == 0
            )
            .all()
        )

        active_files = []
        current_time = datetime.utcnow()

        for share in shares:

            # ------------------------------------------------
            # Check whether temporary share has expired
            # ------------------------------------------------
            if (
                share.expires_at is not None
                and current_time > share.expires_at
            ):
                # Automatically revoke expired share
                share.is_revoked = 1
                continue

            # ------------------------------------------------
            # Add active share
            # ------------------------------------------------
            active_files.append(
                {
                    "share_id": share.id,
                    "owner_id": share.owner_id,
                    "storage_path": share.storage_path,
                    "permission": share.permission,
                    "expires_at": share.expires_at,
                    "created_at": share.created_at
                }
            )

        # Save automatic revocations
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
        # ----------------------------------------------------
        # 1. Find the share
        # ----------------------------------------------------
        share = (
            db.query(FileShare)
            .filter(
                FileShare.id == share_id,
                FileShare.shared_with_id == current_user.id,
                FileShare.is_revoked == 0
            )
            .first()
        )

        if not share:
            raise HTTPException(
                status_code=404,
                detail="Shared file not found or access has been revoked"
            )

        # ----------------------------------------------------
        # 2. Check expiration
        # ----------------------------------------------------
        if share.expires_at is not None:

            if datetime.utcnow() > share.expires_at:

                # Mark expired share as revoked
                share.is_revoked = 1
                db.commit()

                raise HTTPException(
                    status_code=403,
                    detail="Shared file access has expired"
                )

        # ----------------------------------------------------
        # 3. Check download permission
        # ----------------------------------------------------
        if share.permission != "download":
            raise HTTPException(
                status_code=403,
                detail="Download permission not granted"
            )

        # ----------------------------------------------------
        # 4. Validate owner's storage path
        # ----------------------------------------------------
        expected_prefix = f"user_{share.owner_id}/"

        if not share.storage_path.startswith(expected_prefix):
            raise HTTPException(
                status_code=403,
                detail="Invalid shared file path"
            )

        # ----------------------------------------------------
        # 5. Download encrypted file from Supabase
        # ----------------------------------------------------
        try:
            encrypted_file_data = download_encrypted_file(
                share.storage_path
            )

        except Exception:
            raise HTTPException(
                status_code=404,
                detail="Encrypted shared file not found"
            )

        # ----------------------------------------------------
        # 6. Validate encrypted data
        # ----------------------------------------------------
        if len(encrypted_file_data) < 13:
            raise HTTPException(
                status_code=500,
                detail="Invalid encrypted file"
            )

        # ----------------------------------------------------
        # 7. Extract AES-GCM nonce
        # ----------------------------------------------------
        nonce = encrypted_file_data[:12]

        # Remaining bytes contain encrypted data + auth tag
        encrypted_data = encrypted_file_data[12:]

        # ----------------------------------------------------
        # 8. Decrypt file
        # ----------------------------------------------------
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

        # ----------------------------------------------------
        # 9. Recover original filename
        # ----------------------------------------------------
        stored_name = Path(share.storage_path).name

        parts = stored_name.split("_", 1)

        original_filename = (
            parts[1]
            if len(parts) == 2
            else stored_name
        )

        # ----------------------------------------------------
        # 10. Return decrypted file
        # ----------------------------------------------------
        return Response(
            content=decrypted_data,
            media_type="application/octet-stream",
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
        # Find the share owned by the current user
        share = (
            db.query(FileShare)
            .filter(
                FileShare.id == share_id,
                FileShare.owner_id == current_user.id,
                FileShare.is_revoked == 0
            )
            .first()
        )

        if not share:
            raise HTTPException(
                status_code=404,
                detail="Share not found or access already revoked"
            )

        # Revoke access
        share.is_revoked = 1

        db.commit()

        return {
            "message": "File sharing access revoked successfully",
            "share_id": share.id,
            "storage_path": share.storage_path,
            "revoked": True
        }

    finally:
        db.close()        