import base64
import os
import uuid
from datetime import datetime
from pathlib import Path
from uuid import UUID

from cryptography.fernet import Fernet, InvalidToken
from dotenv import load_dotenv

from fastapi import (
    APIRouter,
    Depends,
    File as FastAPIFile,
    HTTPException,
    UploadFile,
)
from fastapi.responses import Response
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import File, FileShare, User
from schemas import (
    FileResponse,
    FileShareCreate,
    FileShareResponse,
    SharedFileResponse,
)


load_dotenv()


router = APIRouter(
    prefix="/files",
    tags=["Files"],
)


UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(
    parents=True,
    exist_ok=True,
)


MAX_FILE_SIZE = 10 * 1024 * 1024


ENCRYPTION_KEY = os.getenv(
    "TRUSTSHARE_ENCRYPTION_KEY"
)

if not ENCRYPTION_KEY:
    raise RuntimeError(
        "TRUSTSHARE_ENCRYPTION_KEY is not configured"
    )

try:
    cipher = Fernet(
        ENCRYPTION_KEY.encode()
    )
except Exception as error:
    raise RuntimeError(
        "Invalid TRUSTSHARE_ENCRYPTION_KEY"
    ) from error


def encrypt_file_content(
    content: bytes,
):
    """
    Encrypt file content using the configured
    Fernet key.

    Returns:
        encrypted_content,
        encrypted_key,
        key_nonce,
        file_nonce
    """

    file_nonce = os.urandom(16)

    key_nonce = os.urandom(16)

    encrypted_content = cipher.encrypt(
        file_nonce + content
    )

    encrypted_key = cipher.encrypt(
        ENCRYPTION_KEY.encode()
    )

    return (
        encrypted_content,
        base64.urlsafe_b64encode(
            encrypted_key
        ).decode(),
        base64.urlsafe_b64encode(
            key_nonce
        ).decode(),
        base64.urlsafe_b64encode(
            file_nonce
        ).decode(),
    )


def decrypt_file_content(
    encrypted_content: bytes,
):
    """
    Decrypt encrypted file content.
    """

    try:
        decrypted_data = cipher.decrypt(
            encrypted_content
        )

        if len(decrypted_data) < 16:
            raise InvalidToken

        return decrypted_data[16:]

    except InvalidToken:
        raise HTTPException(
            status_code=500,
            detail="Unable to decrypt file",
        )


@router.post(
    "/upload",
)
async def upload_file(
    uploaded_file: UploadFile = FastAPIFile(...),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not uploaded_file.filename:
        raise HTTPException(
            status_code=400,
            detail="Filename is required",
        )

    content = await uploaded_file.read()

    if not content:
        raise HTTPException(
            status_code=400,
            detail="Cannot upload an empty file",
        )

    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail="File size cannot exceed 10 MB",
        )

    (
        encrypted_content,
        encrypted_key,
        key_nonce,
        file_nonce,
    ) = encrypt_file_content(
        content
    )

    stored_filename = (
        f"{uuid.uuid4()}.encrypted"
    )

    file_path = (
        UPLOAD_DIR /
        stored_filename
    )

    try:
        with open(
            file_path,
            "wb",
        ) as buffer:
            buffer.write(
                encrypted_content
            )

    except OSError:
        raise HTTPException(
            status_code=500,
            detail="Unable to store encrypted file",
        )

    new_file = File(
        id=uuid.uuid4(),
        owner_id=current_user.id,
        filename=uploaded_file.filename,
        storage_path=str(file_path),
        size_bytes=len(content),
        uploaded_at=datetime.utcnow(),
        encrypted_key=encrypted_key,
        key_nonce=key_nonce,
        file_nonce=file_nonce,
    )

    try:
        db.add(new_file)
        db.commit()
        db.refresh(new_file)

    except Exception:
        db.rollback()

        if file_path.exists():
            file_path.unlink()

        raise HTTPException(
            status_code=500,
            detail="Unable to save file metadata",
        )

    return {
        "message": "File uploaded and encrypted successfully",
        "file": {
            "id": str(new_file.id),
            "filename": new_file.filename,
            "size_bytes": new_file.size_bytes,
            "uploaded_at": new_file.uploaded_at,
        },
    }


@router.get(
    "/",
    response_model=list[FileResponse],
)
def list_my_files(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    files = (
        db.query(File)
        .filter(
            File.owner_id == current_user.id
        )
        .order_by(
            File.uploaded_at.desc()
        )
        .all()
    )

    return files


@router.get(
    "/{file_id}/download",
)
def download_file(
    file_id: UUID,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    file = (
        db.query(File)
        .filter(
            File.id == file_id
        )
        .first()
    )

    if file is None:
        raise HTTPException(
            status_code=404,
            detail="File not found",
        )

    allowed = False

    if file.owner_id == current_user.id:
        allowed = True

    else:
        share = (
            db.query(FileShare)
            .filter(
                FileShare.file_id == file.id,
                FileShare.shared_with_email
                == current_user.email,
            )
            .first()
        )

        if share is None:
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to download this file",
            )

        if share.permission != "view":
            raise HTTPException(
                status_code=403,
                detail="Invalid file permission",
            )

        allowed = True

    if not allowed:
        raise HTTPException(
            status_code=403,
            detail="You do not have permission to download this file",
        )

    file_path = Path(
        file.storage_path
    )

    if not file_path.exists():
        raise HTTPException(
            status_code=404,
            detail="Physical file not found",
        )

    try:
        with open(
            file_path,
            "rb",
        ) as encrypted_file:
            encrypted_content = (
                encrypted_file.read()
            )

        decrypted_content = (
            decrypt_file_content(
                encrypted_content
            )
        )

    except OSError:
        raise HTTPException(
            status_code=500,
            detail="Unable to read stored file",
        )

    return Response(
        content=decrypted_content,
        media_type="application/octet-stream",
        headers={
            "Content-Disposition": (
                f'attachment; filename="{file.filename}"'
            )
        },
    )


@router.delete(
    "/{file_id}",
)
def delete_file(
    file_id: UUID,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    file = (
        db.query(File)
        .filter(
            File.id == file_id
        )
        .first()
    )

    if file is None:
        raise HTTPException(
            status_code=404,
            detail="File not found",
        )

    if file.owner_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="You do not have permission to delete this file",
        )

    file_path = Path(
        file.storage_path
    )

    if file_path.exists():
        try:
            file_path.unlink()
        except OSError:
            raise HTTPException(
                status_code=500,
                detail="Unable to delete physical file",
            )

    db.query(FileShare).filter(
        FileShare.file_id == file.id
    ).delete(
        synchronize_session=False
    )

    db.delete(file)
    db.commit()

    return {
        "message": "File deleted successfully",
        "file_id": str(file_id),
    }


@router.post(
    "/share",
    response_model=FileShareResponse,
    status_code=201,
)
def share_file(
    share_data: FileShareCreate,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    file = (
        db.query(File)
        .filter(
            File.id == share_data.file_id
        )
        .first()
    )

    if file is None:
        raise HTTPException(
            status_code=404,
            detail="File not found",
        )

    if file.owner_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="Only the file owner can share this file",
        )

    target_email = (
        str(
            share_data.shared_with_email
        )
        .strip()
        .lower()
    )

    target_user = (
        db.query(User)
        .filter(
            User.email == target_email
        )
        .first()
    )

    if target_user is None:
        raise HTTPException(
            status_code=404,
            detail="User with this email was not found",
        )

    if target_user.id == current_user.id:
        raise HTTPException(
            status_code=400,
            detail="You cannot share a file with yourself",
        )

    if share_data.permission not in [
        "view"
    ]:
        raise HTTPException(
            status_code=400,
            detail="Invalid permission. Only 'view' is supported.",
        )

    existing_share = (
        db.query(FileShare)
        .filter(
            FileShare.file_id == file.id,
            FileShare.shared_with_email
            == target_email,
        )
        .first()
    )

    if existing_share:
        raise HTTPException(
            status_code=400,
            detail="File is already shared with this user",
        )

    new_share = FileShare(
        id=uuid.uuid4(),
        file_id=file.id,
        shared_with_email=target_email,
        permission=share_data.permission,
        created_at=datetime.utcnow(),
    )

    db.add(new_share)
    db.commit()
    db.refresh(new_share)

    return new_share


@router.get(
    "/shared-with-me",
)
def list_shared_files(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    shares = (
        db.query(
            FileShare,
            File,
            User,
        )
        .join(
            File,
            File.id == FileShare.file_id,
        )
        .join(
            User,
            User.id == File.owner_id,
        )
        .filter(
            FileShare.shared_with_email
            == current_user.email,
        )
        .order_by(
            FileShare.created_at.desc()
        )
        .all()
    )

    return [
        {
            "id": str(share.id),
            "file_id": str(file.id),
            "filename": file.filename,
            "owner_id": str(owner.id),
            "owner_name": owner.name,
            "owner_email": owner.email,
            "shared_with_email":
                share.shared_with_email,
            "permission": share.permission,
            "created_at": share.created_at,
        }
        for share, file, owner in shares
    ]


@router.get(
    "/shared-by-me",
)
def list_my_shares(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    shares = (
        db.query(FileShare)
        .join(
            File,
            File.id == FileShare.file_id,
        )
        .filter(
            File.owner_id == current_user.id
        )
        .order_by(
            FileShare.created_at.desc()
        )
        .all()
    )

    return [
        {
            "id": str(share.id),
            "file_id": str(share.file_id),
            "shared_with_email":
                share.shared_with_email,
            "permission":
                share.permission,
            "created_at":
                share.created_at,
        }
        for share in shares
    ]


@router.delete(
    "/share/{share_id}",
)
def revoke_file_share(
    share_id: UUID,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    share = (
        db.query(FileShare)
        .filter(
            FileShare.id == share_id
        )
        .first()
    )

    if share is None:
        raise HTTPException(
            status_code=404,
            detail="File share not found",
        )

    file = (
        db.query(File)
        .filter(
            File.id == share.file_id
        )
        .first()
    )

    if file is None:
        raise HTTPException(
            status_code=404,
            detail="Associated file not found",
        )

    if file.owner_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="Only the file owner can revoke this share",
        )

    db.delete(share)
    db.commit()

    return {
        "message": "File sharing revoked successfully",
        "share_id": str(share_id),
    }