import base64
import hashlib
import os
import secrets
import uuid
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID

from cryptography.exceptions import InvalidTag
from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from dotenv import load_dotenv

from fastapi import (
    APIRouter,
    Depends,
    File as FastAPIFile,
    HTTPException,
    UploadFile,
)
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import (
    File,
    FileShare,
    TemporaryLink,
    User,
)
from schemas import (
    FileResponse,
    FileShareCreate,
    FileShareResponse,
)


load_dotenv()


# ============================================================
# ROUTER
# ============================================================

router = APIRouter(
    prefix="/files",
    tags=["Files"],
)


# ============================================================
# STORAGE CONFIGURATION
# ============================================================

UPLOAD_DIR = Path("uploads")

UPLOAD_DIR.mkdir(
    parents=True,
    exist_ok=True,
)

MAX_FILE_SIZE = 10 * 1024 * 1024


# ============================================================
# ENCRYPTION CONFIGURATION
# ============================================================

ENCRYPTION_KEY = os.getenv(
    "TRUSTSHARE_ENCRYPTION_KEY"
)

if not ENCRYPTION_KEY:
    raise RuntimeError(
        "TRUSTSHARE_ENCRYPTION_KEY is not configured"
    )


try:
    MASTER_KEY = base64.urlsafe_b64decode(
        ENCRYPTION_KEY.encode()
    )

except Exception as error:
    raise RuntimeError(
        "Invalid TRUSTSHARE_ENCRYPTION_KEY"
    ) from error


if len(MASTER_KEY) != 32:
    raise RuntimeError(
        "TRUSTSHARE_ENCRYPTION_KEY must decode to exactly 32 bytes"
    )


try:
    legacy_cipher = Fernet(
        ENCRYPTION_KEY.encode()
    )

except Exception as error:
    raise RuntimeError(
        "Invalid TRUSTSHARE_ENCRYPTION_KEY"
    ) from error


master_cipher = AESGCM(
    MASTER_KEY
)


# ============================================================
# TIME HELPERS
# ============================================================

def utc_now() -> datetime:
    """
    Return the current UTC time as a timezone-naive datetime.

    The database currently uses timezone-naive timestamps.
    """
    return datetime.now(timezone.utc).replace(
        tzinfo=None
    )


def is_expired(
    expires_at: datetime | None,
) -> bool:
    """
    Return True when an optional expiry timestamp has passed.
    """
    if expires_at is None:
        return False

    return expires_at <= utc_now()


# ============================================================
# REQUEST SCHEMAS
# ============================================================

class TemporaryLinkCreate(BaseModel):
    """
    Request body used by the file owner to create
    a temporary download link.
    """

    file_id: UUID

    expires_at: datetime = Field(
        ...,
        description=(
            "UTC expiration time for the temporary link"
        ),
    )


# ============================================================
# ENCRYPTION HELPERS
# ============================================================

def _b64encode(
    value: bytes,
) -> str:
    return base64.urlsafe_b64encode(
        value
    ).decode("utf-8")


def _b64decode(
    value: str,
) -> bytes:
    try:
        return base64.urlsafe_b64decode(
            value.encode("utf-8")
        )

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail="Invalid encryption metadata",
        ) from error


def encrypt_file_content(
    content: bytes,
    file_id: UUID,
):
    """
    Encrypt a file using AES-256-GCM.

    A random AES-256 key is generated for every file.
    That key is wrapped using the server-side master key.
    """

    file_key = AESGCM.generate_key(
        bit_length=256
    )

    file_nonce = os.urandom(
        12
    )

    key_nonce = os.urandom(
        12
    )

    file_aad = (
        f"trustshare-file:{file_id}"
    ).encode("utf-8")

    key_aad = (
        f"trustshare-key:{file_id}"
    ).encode("utf-8")

    file_cipher = AESGCM(
        file_key
    )

    encrypted_content = file_cipher.encrypt(
        file_nonce,
        content,
        file_aad,
    )

    encrypted_key = master_cipher.encrypt(
        key_nonce,
        file_key,
        key_aad,
    )

    return (
        encrypted_content,
        _b64encode(encrypted_key),
        _b64encode(key_nonce),
        _b64encode(file_nonce),
    )


def decrypt_aes256_file_content(
    encrypted_content: bytes,
    encrypted_key: str,
    key_nonce: str,
    file_nonce: str,
    file_id: UUID,
) -> bytes:
    """
    Decrypt an AES-256-GCM encrypted file.
    """

    try:
        encrypted_file_key = _b64decode(
            encrypted_key
        )

        decoded_key_nonce = _b64decode(
            key_nonce
        )

        decoded_file_nonce = _b64decode(
            file_nonce
        )

        file_aad = (
            f"trustshare-file:{file_id}"
        ).encode("utf-8")

        key_aad = (
            f"trustshare-key:{file_id}"
        ).encode("utf-8")

        file_key = master_cipher.decrypt(
            decoded_key_nonce,
            encrypted_file_key,
            key_aad,
        )

        if len(file_key) != 32:
            raise InvalidTag

        file_cipher = AESGCM(
            file_key
        )

        return file_cipher.decrypt(
            decoded_file_nonce,
            encrypted_content,
            file_aad,
        )

    except (
        InvalidTag,
        ValueError,
        TypeError,
    ) as error:

        raise HTTPException(
            status_code=500,
            detail="Unable to decrypt AES-256 encrypted file",
        ) from error


def decrypt_legacy_fernet_file_content(
    encrypted_content: bytes,
) -> bytes:
    """
    Decrypt old Fernet-encrypted files.
    """

    try:
        decrypted_data = legacy_cipher.decrypt(
            encrypted_content
        )

        if len(decrypted_data) < 16:
            raise InvalidToken

        return decrypted_data[16:]

    except InvalidToken as error:

        raise HTTPException(
            status_code=500,
            detail="Unable to decrypt legacy encrypted file",
        ) from error


def decrypt_file_content(
    file: File,
    encrypted_content: bytes,
) -> bytes:
    """
    Select the correct decryption method.
    """

    storage_path = str(
        file.storage_path
    ).lower()

    if storage_path.endswith(
        ".aes256"
    ):
        return decrypt_aes256_file_content(
            encrypted_content=encrypted_content,
            encrypted_key=file.encrypted_key,
            key_nonce=file.key_nonce,
            file_nonce=file.file_nonce,
            file_id=file.id,
        )

    return decrypt_legacy_fernet_file_content(
        encrypted_content
    )


# ============================================================
# SHARED FILE DECRYPTION
# ============================================================

def read_and_decrypt_file(
    file: File,
) -> bytes:
    """
    Read an encrypted file from storage and decrypt it.
    """

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

            encrypted_content = encrypted_file.read()

    except OSError as error:

        raise HTTPException(
            status_code=500,
            detail="Unable to read stored file",
        ) from error

    return decrypt_file_content(
        file=file,
        encrypted_content=encrypted_content,
    )


# ============================================================
# UPLOAD
# ============================================================

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

    file_id = uuid.uuid4()

    (
        encrypted_content,
        encrypted_key,
        key_nonce,
        file_nonce,
    ) = encrypt_file_content(
        content=content,
        file_id=file_id,
    )

    stored_filename = (
        f"{file_id}.aes256"
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

    except OSError as error:

        raise HTTPException(
            status_code=500,
            detail="Unable to store encrypted file",
        ) from error

    new_file = File(
        id=file_id,
        owner_id=current_user.id,
        filename=uploaded_file.filename,
        storage_path=str(file_path),
        size_bytes=len(content),
        uploaded_at=utc_now(),
        encrypted_key=encrypted_key,
        key_nonce=key_nonce,
        file_nonce=file_nonce,
        encryption_version="aes-256-gcm-v1",
        key_version="v1",
    )

    try:
        db.add(
            new_file
        )

        db.commit()

        db.refresh(
            new_file
        )

    except Exception as error:

        db.rollback()

        if file_path.exists():
            file_path.unlink()

        raise HTTPException(
            status_code=500,
            detail="Unable to save file metadata",
        ) from error

    return {
        "message": (
            "File uploaded and encrypted successfully "
            "using AES-256-GCM"
        ),
        "encryption": "AES-256-GCM",
        "key_version": new_file.key_version,
        "file": {
            "id": str(new_file.id),
            "filename": new_file.filename,
            "size_bytes": new_file.size_bytes,
            "uploaded_at": new_file.uploaded_at,
        },
    }


# ============================================================
# LIST MY FILES
# ============================================================

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


# ============================================================
# DOWNLOAD FILE
# ============================================================

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

    if file.owner_id != current_user.id:

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
                detail=(
                    "You do not have permission "
                    "to download this file"
                ),
            )

        if share.permission != "view":
            raise HTTPException(
                status_code=403,
                detail="Invalid file permission",
            )

        if is_expired(share.expires_at):
            raise HTTPException(
                status_code=410,
                detail="This file share has expired",
            )

    decrypted_content = read_and_decrypt_file(
        file
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


# ============================================================
# KEY ROTATION
# ============================================================

@router.post(
    "/{file_id}/rotate-key",
)
def rotate_file_encryption_key(
    file_id: UUID,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Rotate the per-file AES-256 encryption key.

    The file owner is the only user allowed to rotate the key.

    Workflow:

    1. Read the existing encrypted file.
    2. Decrypt it using the current file key.
    3. Generate a brand-new AES-256 file key.
    4. Generate fresh AES-GCM nonces.
    5. Encrypt the plaintext with the new key.
    6. Wrap the new key using the server master key.
    7. Replace the encrypted storage file.
    8. Update encryption metadata.
    9. Increment the file key version.

    This is per-file data-key rotation.
    The server master key itself is not changed by this endpoint.
    """

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
            detail=(
                "Only the file owner can rotate "
                "the encryption key"
            ),
        )

    # --------------------------------------------------------
    # Only AES-256 files can use this rotation workflow.
    # --------------------------------------------------------

    if not str(
        file.storage_path
    ).lower().endswith(".aes256"):

        raise HTTPException(
            status_code=400,
            detail=(
                "Key rotation is only supported "
                "for AES-256 encrypted files"
            ),
        )

    file_path = Path(
        file.storage_path
    )

    if not file_path.exists():
        raise HTTPException(
            status_code=404,
            detail="Physical file not found",
        )

    # --------------------------------------------------------
    # Read existing encrypted content.
    # --------------------------------------------------------

    try:
        with open(
            file_path,
            "rb",
        ) as encrypted_file:

            old_encrypted_content = encrypted_file.read()

    except OSError as error:

        raise HTTPException(
            status_code=500,
            detail="Unable to read stored file",
        ) from error

    # --------------------------------------------------------
    # Decrypt using the existing file key.
    # --------------------------------------------------------

    plaintext_content = decrypt_aes256_file_content(
        encrypted_content=old_encrypted_content,
        encrypted_key=file.encrypted_key,
        key_nonce=file.key_nonce,
        file_nonce=file.file_nonce,
        file_id=file.id,
    )

    # --------------------------------------------------------
    # Generate a completely new AES-256 key.
    # --------------------------------------------------------

    new_file_key = AESGCM.generate_key(
        bit_length=256
    )

    new_file_nonce = os.urandom(
        12
    )

    new_key_nonce = os.urandom(
        12
    )

    file_aad = (
        f"trustshare-file:{file.id}"
    ).encode("utf-8")

    key_aad = (
        f"trustshare-key:{file.id}"
    ).encode("utf-8")

    # --------------------------------------------------------
    # Encrypt plaintext using the new file key.
    # --------------------------------------------------------

    new_file_cipher = AESGCM(
        new_file_key
    )

    new_encrypted_content = new_file_cipher.encrypt(
        new_file_nonce,
        plaintext_content,
        file_aad,
    )

    # --------------------------------------------------------
    # Wrap the new file key using the server master key.
    # --------------------------------------------------------

    new_encrypted_key = master_cipher.encrypt(
        new_key_nonce,
        new_file_key,
        key_aad,
    )

    encoded_new_encrypted_key = _b64encode(
        new_encrypted_key
    )

    encoded_new_key_nonce = _b64encode(
        new_key_nonce
    )

    encoded_new_file_nonce = _b64encode(
        new_file_nonce
    )

    # --------------------------------------------------------
    # Write the newly encrypted file to a temporary file first.
    #
    # This prevents us from destroying the existing encrypted
    # file if writing the new ciphertext fails.
    # --------------------------------------------------------

    temporary_path = file_path.with_suffix(
        ".rotation.tmp"
    )

    try:

        with open(
            temporary_path,
            "wb",
        ) as temporary_file:

            temporary_file.write(
                new_encrypted_content
            )

        os.replace(
            temporary_path,
            file_path
        )

    except OSError as error:

        if temporary_path.exists():
            try:
                temporary_path.unlink()
            except OSError:
                pass

        raise HTTPException(
            status_code=500,
            detail=(
                "Unable to replace encrypted file "
                "during key rotation"
            ),
        ) from error

    # --------------------------------------------------------
    # Update encryption metadata.
    # --------------------------------------------------------

    current_version = str(
        file.key_version or "v1"
    )

    if current_version.startswith("v"):

        try:
            current_number = int(
                current_version[1:]
            )

            new_version = (
                f"v{current_number + 1}"
            )

        except ValueError:

            new_version = "v2"

    else:

        new_version = "v2"

    file.encrypted_key = (
        encoded_new_encrypted_key
    )

    file.key_nonce = (
        encoded_new_key_nonce
    )

    file.file_nonce = (
        encoded_new_file_nonce
    )

    file.key_version = new_version

    file.encryption_version = (
        "aes-256-gcm-v1"
    )

    try:

        db.commit()

        db.refresh(
            file
        )

    except Exception as error:

        db.rollback()

        raise HTTPException(
            status_code=500,
            detail=(
                "Encryption key was rotated in storage "
                "but metadata update failed. "
                "Manual recovery is required."
            ),
        ) from error

    return {
        "message": (
            "File encryption key rotated successfully"
        ),
        "file_id": str(file.id),
        "filename": file.filename,
        "encryption": "AES-256-GCM",
        "previous_key_version": current_version,
        "new_key_version": file.key_version,
        "encryption_version": file.encryption_version,
    }


# ============================================================
# CREATE TEMPORARY LINK
# ============================================================

@router.post(
    "/temporary-link",
)
def create_temporary_link(
    link_data: TemporaryLinkCreate,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Create a secure temporary download link.

    Only the file owner can create a temporary link.

    The raw random token is returned only once to the caller.
    Only its SHA-256 hash is stored in the database.
    """

    file = (
        db.query(File)
        .filter(
            File.id == link_data.file_id
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
            detail=(
                "Only the file owner can create "
                "a temporary link"
            ),
        )

    expiry_time = link_data.expires_at

    if expiry_time.tzinfo is not None:
        expiry_time = expiry_time.astimezone(
            timezone.utc
        ).replace(
            tzinfo=None
        )

    if expiry_time <= utc_now():
        raise HTTPException(
            status_code=400,
            detail="Expiration time must be in the future",
        )

    raw_token = secrets.token_urlsafe(32)

    token_hash = hashlib.sha256(
        raw_token.encode("utf-8")
    ).hexdigest()

    temporary_link = TemporaryLink(
        id=uuid.uuid4(),
        file_id=file.id,
        owner_id=current_user.id,
        token_hash=token_hash,
        created_at=utc_now(),
        expires_at=expiry_time,
    )

    try:

        db.add(
            temporary_link
        )

        db.commit()

        db.refresh(
            temporary_link
        )

    except Exception as error:

        db.rollback()

        raise HTTPException(
            status_code=500,
            detail="Unable to create temporary link",
        ) from error

    return {
        "message": "Temporary link created successfully",
        "link_id": str(temporary_link.id),
        "file_id": str(file.id),
        "filename": file.filename,
        "expires_at": temporary_link.expires_at,
        "token": raw_token,
        "download_path": (
            f"/files/temporary/{raw_token}"
        ),
    }


# ============================================================
# DOWNLOAD THROUGH TEMPORARY LINK
# ============================================================

@router.get(
    "/temporary/{token}",
)
def download_with_temporary_link(
    token: str,
    db: Session = Depends(get_db),
):
    """
    Download a file using a temporary link.

    No login is required.

    The supplied token is hashed with SHA-256 and compared
    with the stored token hash.

    Expired links return HTTP 410 Gone.
    """

    if not token:
        raise HTTPException(
            status_code=400,
            detail="Temporary link token is required",
        )

    token_hash = hashlib.sha256(
        token.encode("utf-8")
    ).hexdigest()

    temporary_link = (
        db.query(TemporaryLink)
        .filter(
            TemporaryLink.token_hash
            == token_hash
        )
        .first()
    )

    if temporary_link is None:
        raise HTTPException(
            status_code=404,
            detail="Temporary link not found",
        )

    if is_expired(
        temporary_link.expires_at
    ):
        raise HTTPException(
            status_code=410,
            detail="This temporary link has expired",
        )

    file = (
        db.query(File)
        .filter(
            File.id == temporary_link.file_id
        )
        .first()
    )

    if file is None:
        raise HTTPException(
            status_code=404,
            detail="File not found",
        )

    decrypted_content = read_and_decrypt_file(
        file
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


# ============================================================
# DELETE FILE
# ============================================================

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
            detail=(
                "You do not have permission "
                "to delete this file"
            ),
        )

    file_path = Path(
        file.storage_path
    )

    if file_path.exists():

        try:
            file_path.unlink()

        except OSError as error:

            raise HTTPException(
                status_code=500,
                detail="Unable to delete physical file",
            ) from error

    db.query(FileShare).filter(
        FileShare.file_id == file.id
    ).delete(
        synchronize_session=False
    )

    db.query(TemporaryLink).filter(
        TemporaryLink.file_id == file.id
    ).delete(
        synchronize_session=False
    )

    db.delete(
        file
    )

    db.commit()

    return {
        "message": "File deleted successfully",
        "file_id": str(file_id),
    }


# ============================================================
# SHARE FILE
# ============================================================

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
            detail=(
                "Only the file owner can share this file"
            ),
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
            detail=(
                "Invalid permission. "
                "Only 'view' is supported."
            ),
        )

    if share_data.expires_at is not None:

        expiry_time = share_data.expires_at

        if expiry_time.tzinfo is not None:

            expiry_time = expiry_time.astimezone(
                timezone.utc
            ).replace(
                tzinfo=None
            )

        if expiry_time <= utc_now():

            raise HTTPException(
                status_code=400,
                detail="Expiration time must be in the future",
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
            detail=(
                "File is already shared "
                "with this user"
            ),
        )

    expires_at = share_data.expires_at

    if (
        expires_at is not None
        and expires_at.tzinfo is not None
    ):

        expires_at = expires_at.astimezone(
            timezone.utc
        ).replace(
            tzinfo=None
        )

    new_share = FileShare(
        id=uuid.uuid4(),
        file_id=file.id,
        shared_with_email=target_email,
        permission=share_data.permission,
        created_at=utc_now(),
        expires_at=expires_at,
    )

    db.add(
        new_share
    )

    db.commit()

    db.refresh(
        new_share
    )

    return new_share


# ============================================================
# SHARED WITH ME
# ============================================================

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
            "shared_with_email": share.shared_with_email,
            "permission": share.permission,
            "created_at": share.created_at,
            "expires_at": share.expires_at,
            "expired": is_expired(share.expires_at),
        }
        for share, file, owner in shares
    ]


# ============================================================
# SHARED BY ME
# ============================================================

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
            "shared_with_email": share.shared_with_email,
            "permission": share.permission,
            "created_at": share.created_at,
            "expires_at": share.expires_at,
            "expired": is_expired(share.expires_at),
        }
        for share in shares
    ]


# ============================================================
# REVOKE SHARE
# ============================================================

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
            detail=(
                "Only the file owner can "
                "revoke this share"
            ),
        )

    db.delete(
        share
    )

    db.commit()

    return {
        "message": "File sharing revoked successfully",
        "share_id": str(share_id),
    }