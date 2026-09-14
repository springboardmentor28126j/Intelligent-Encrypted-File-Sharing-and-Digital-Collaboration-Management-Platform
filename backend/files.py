import os
import uuid
from datetime import datetime

from cryptography.fernet import Fernet, InvalidToken
from dotenv import load_dotenv

from fastapi import (
    APIRouter,
    Depends,
    File as FastAPIFile,
    HTTPException,
    UploadFile
)

from fastapi.responses import Response

from sqlalchemy.orm import Session

from database import get_db
from models import File, FileShare, User
from auth import get_current_user
from schemas import (
    FileShareCreate,
    FileShareResponse,
    SharedFileResponse
)


# ============================================================
# LOAD ENVIRONMENT VARIABLES
# ============================================================

load_dotenv()


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


# ============================================================
# ROUTER CONFIGURATION
# ============================================================

router = APIRouter(
    prefix="/files",
    tags=["Files"]
)


UPLOAD_DIR = "uploads"


os.makedirs(
    UPLOAD_DIR,
    exist_ok=True
)


# ============================================================
# UPLOAD FILE
# ============================================================

@router.post("/upload")
async def upload_file(
    uploaded_file: UploadFile = FastAPIFile(...),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not uploaded_file.filename:
        raise HTTPException(
            status_code=400,
            detail="Filename is required"
        )

    content = await uploaded_file.read()

    if not content:
        raise HTTPException(
            status_code=400,
            detail="Cannot upload an empty file"
        )

    encrypted_content = cipher.encrypt(
        content
    )

    file_extension = ""

    if "." in uploaded_file.filename:
        file_extension = os.path.splitext(
            uploaded_file.filename
        )[1]

    stored_filename = (
        f"{uuid.uuid4()}{file_extension}.encrypted"
    )

    file_path = os.path.join(
        UPLOAD_DIR,
        stored_filename
    )

    with open(
        file_path,
        "wb"
    ) as buffer:
        buffer.write(encrypted_content)

    new_file = File(
        filename=uploaded_file.filename,
        stored_filename=stored_filename,
        file_path=file_path,
        file_size=len(content),
        content_type=uploaded_file.content_type,
        owner_id=current_user.id
    )

    db.add(new_file)
    db.commit()
    db.refresh(new_file)

    return {
        "message": "File uploaded and encrypted successfully",
        "file": {
            "id": new_file.id,
            "filename": new_file.filename,
            "file_size": new_file.file_size,
            "content_type": new_file.content_type,
            "uploaded_at": new_file.uploaded_at
        }
    }


# ============================================================
# LIST MY FILES
# ============================================================

@router.get("/")
def list_my_files(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
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

    return {
        "count": len(files),
        "files": [
            {
                "id": file.id,
                "filename": file.filename,
                "file_size": file.file_size,
                "content_type": file.content_type,
                "uploaded_at": file.uploaded_at
            }
            for file in files
        ]
    }


# ============================================================
# DOWNLOAD FILE
# ============================================================

@router.get("/{file_id}/download")
def download_file(
    file_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
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
            detail="File not found"
        )

    # --------------------------------------------------------
    # CHECK OWNERSHIP / SHARING PERMISSION
    # --------------------------------------------------------

    if file.owner_id == current_user.id:
        allowed = True

    else:
        share = (
            db.query(FileShare)
            .filter(
                FileShare.file_id == file.id,
                FileShare.shared_with_user_id ==
                current_user.id
            )
            .first()
        )

        if share is None:
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to download this file"
            )

        # ----------------------------------------------------
        # CHECK SHARE EXPIRATION
        # ----------------------------------------------------

        if share.expires_at is not None:
            current_time = datetime.utcnow()

            expires_at = share.expires_at

            if expires_at <= current_time:
                raise HTTPException(
                    status_code=403,
                    detail="This file sharing permission has expired"
                )

        allowed = True

    if not allowed:
        raise HTTPException(
            status_code=403,
            detail="You do not have permission to download this file"
        )

    # --------------------------------------------------------
    # CHECK PHYSICAL FILE
    # --------------------------------------------------------

    if not os.path.exists(file.file_path):
        raise HTTPException(
            status_code=404,
            detail="Physical file not found"
        )

    # --------------------------------------------------------
    # READ ENCRYPTED FILE
    # --------------------------------------------------------

    try:
        with open(
            file.file_path,
            "rb"
        ) as encrypted_file:
            encrypted_content = encrypted_file.read()

        decrypted_content = cipher.decrypt(
            encrypted_content
        )

    except InvalidToken:
        raise HTTPException(
            status_code=500,
            detail="Unable to decrypt file"
        )

    except OSError:
        raise HTTPException(
            status_code=500,
            detail="Unable to read stored file"
        )

    # --------------------------------------------------------
    # RETURN ORIGINAL DECRYPTED FILE
    # --------------------------------------------------------

    return Response(
        content=decrypted_content,
        media_type=file.content_type or
        "application/octet-stream",
        headers={
            "Content-Disposition": (
                f'attachment; filename="{file.filename}"'
            )
        }
    )


# ============================================================
# DELETE FILE
# ============================================================

@router.delete("/{file_id}")
def delete_file(
    file_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
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
            detail="File not found"
        )

    if file.owner_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="You do not have permission to delete this file"
        )

    if os.path.exists(file.file_path):
        os.remove(file.file_path)

    db.query(FileShare).filter(
        FileShare.file_id == file.id
    ).delete(
        synchronize_session=False
    )

    db.delete(file)
    db.commit()

    return {
        "message": "File deleted successfully",
        "file_id": file_id
    }


# ============================================================
# SHARE FILE
# ============================================================

@router.post(
    "/share",
    response_model=FileShareResponse,
    status_code=201
)
def share_file(
    share_data: FileShareCreate,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
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
            detail="File not found"
        )

    if file.owner_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="Only the file owner can share this file"
        )

    target_user = (
        db.query(User)
        .filter(
            User.id == share_data.shared_with_user_id
        )
        .first()
    )

    if target_user is None:
        raise HTTPException(
            status_code=404,
            detail="User to share with was not found"
        )

    if target_user.id == current_user.id:
        raise HTTPException(
            status_code=400,
            detail="You cannot share a file with yourself"
        )

    if share_data.permission not in ["view"]:
        raise HTTPException(
            status_code=400,
            detail="Invalid permission. Only 'view' is supported."
        )

    # --------------------------------------------------------
    # VALIDATE EXPIRATION
    # --------------------------------------------------------

    if share_data.expires_at is not None:
        expires_at = share_data.expires_at

        if expires_at.tzinfo is not None:
            expires_at = expires_at.replace(
                tzinfo=None
            )

        if expires_at <= datetime.utcnow():
            raise HTTPException(
                status_code=400,
                detail="Expiration time must be in the future"
            )

        share_data.expires_at = expires_at

    # --------------------------------------------------------
    # PREVENT DUPLICATE SHARING
    # --------------------------------------------------------

    existing_share = (
        db.query(FileShare)
        .filter(
            FileShare.file_id == share_data.file_id,
            FileShare.shared_with_user_id ==
            share_data.shared_with_user_id
        )
        .first()
    )

    if existing_share:
        raise HTTPException(
            status_code=400,
            detail="File is already shared with this user"
        )

    # --------------------------------------------------------
    # CREATE SHARE
    # --------------------------------------------------------

    new_share = FileShare(
        file_id=share_data.file_id,
        shared_with_user_id=share_data.shared_with_user_id,
        permission=share_data.permission,
        expires_at=share_data.expires_at
    )

    db.add(new_share)
    db.commit()
    db.refresh(new_share)

    return new_share


# ============================================================
# LIST FILES SHARED WITH ME
# ============================================================

@router.get(
    "/shared-with-me",
    response_model=list[SharedFileResponse]
)
def list_shared_files(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    shares = (
        db.query(
            FileShare,
            File,
            User
        )
        .join(
            File,
            File.id == FileShare.file_id
        )
        .join(
            User,
            User.id == File.owner_id
        )
        .filter(
            FileShare.shared_with_user_id ==
            current_user.id
        )
        .order_by(
            FileShare.created_at.desc()
        )
        .all()
    )

    return [
        {
            "id": share.id,
            "file_id": file.id,
            "filename": file.filename,
            "owner_id": owner.id,
            "owner_name": owner.name,
            "owner_email": owner.email,
            "shared_with_user_id": share.shared_with_user_id,
            "permission": share.permission,
            "created_at": share.created_at,
            "expires_at": share.expires_at
        }
        for share, file, owner in shares
    ]


# ============================================================
# LIST SHARES CREATED BY ME
# ============================================================

@router.get(
    "/shared-by-me",
    response_model=list[FileShareResponse]
)
def list_my_shares(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    shares = (
        db.query(FileShare)
        .join(
            File,
            File.id == FileShare.file_id
        )
        .filter(
            File.owner_id == current_user.id
        )
        .order_by(
            FileShare.created_at.desc()
        )
        .all()
    )

    return shares


# ============================================================
# REVOKE FILE SHARE
# ============================================================

@router.delete(
    "/share/{share_id}"
)
def revoke_file_share(
    share_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
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
            detail="File share not found"
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
            detail="Associated file not found"
        )

    if file.owner_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="Only the file owner can revoke this share"
        )

    db.delete(share)
    db.commit()

    return {
        "message": "File sharing revoked successfully",
        "share_id": share_id
    }