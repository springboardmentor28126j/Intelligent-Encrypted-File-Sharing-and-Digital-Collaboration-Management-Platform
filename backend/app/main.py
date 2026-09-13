from fastapi import (
    FastAPI,
    Depends,
    UploadFile,
    File as FastAPIFile,
    HTTPException,
    Request,
)
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware

from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.database import Base, engine, SessionLocal
from app.models import (
    User,
    Folder,
    File as FileModel,
    FileVersion,
    FilePermission,
    ShareLink,
    Download,
)

from app.security import (
    create_access_token,
    create_password_reset_token,
    verify_password_reset_token,
)
from app.auth import get_current_user, get_current_admin
from app.password import hash_password, verify_password
from app.encryption import generate_key, encrypt_data, decrypt_data
from app.key_manager import encrypt_file_key, decrypt_file_key
from app.key_store import get_protected_key, initialize_legacy_key_store

import os
import secrets
import hashlib
import mimetypes
import uuid

from app.b2_storage import (
    upload_to_b2,
    download_from_b2,
    delete_from_b2,
)

from datetime import datetime, timedelta, timezone


app = FastAPI(title="TrustShare API")


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# DATABASE
# ============================================================

Base.metadata.create_all(bind=engine)


# Create encrypted key store for migrated files
try:
    initialize_legacy_key_store()
except Exception:
    pass


def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()


def now():
    return datetime.now(timezone.utc)


# ============================================================
# STORAGE AND DECRYPTION
# ============================================================

def get_file_from_storage(file_record: FileModel):
    try:
        return download_from_b2(
            file_record.storage_key
        )

    except Exception as error:
        raise HTTPException(
            status_code=404,
            detail=(
                "Encrypted file not found in cloud storage: "
                f"{error}"
            ),
        )


def decrypt_file_record(file_record: FileModel):

    try:
        # Get protected file key
        protected_key = get_protected_key(
            file_record.encryption_key_reference
        )

        # Decrypt file key using master key
        file_key = decrypt_file_key(
            protected_key
        )

        # Download encrypted file from B2
        encrypted_data = get_file_from_storage(
            file_record
        )

        # Decrypt file
        return decrypt_data(
            encrypted_data,
            file_key
        )

    except HTTPException:
        raise

    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Unable to decrypt file.",
        )


# ============================================================
# HOME
# ============================================================

@app.get("/")
def home():

    return {
        "message": "TrustShare API is running"
    }


# ============================================================
# REGISTER
# ============================================================

@app.post("/register")
def register(
    name: str,
    email: str,
    password: str,
    db: Session = Depends(get_db),
):

    existing_user = (
        db.query(User)
        .filter(User.email == email)
        .first()
    )

    if existing_user:
        return {
            "message": "Email already registered"
        }

    new_user = User(
        full_name=name,
        email=email,
        password_hash=hash_password(password),
        role="user",
        account_status="active",
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return {
        "message": "Registration successful",
        "user_id": str(new_user.id),
        "name": new_user.full_name,
        "email": new_user.email,
        "role": new_user.role,
    }


# ============================================================
# LOGIN
# ============================================================

@app.post("/login")
def login(
    email: str,
    password: str,
    db: Session = Depends(get_db),
):

    user = (
        db.query(User)
        .filter(User.email == email)
        .first()
    )

    if not user or user.account_status != "active":
        return {
            "message": "Invalid email or password"
        }

    try:

        password_correct = verify_password(
            password,
            user.password_hash,
        )

    except Exception:

        return {
            "message": (
                "Password data is invalid. "
                "Please register this account again."
            )
        }

    if not password_correct:
        return {
            "message": "Invalid email or password"
        }

    access_token = create_access_token(
        data={
            "user_id": str(user.id),
            "name": user.full_name,
            "email": user.email,
            "role": user.role,
        }
    )

    return {
        "message": "Login successful",
        "user_id": str(user.id),
        "name": user.full_name,
        "email": user.email,
        "role": user.role,
        "access_token": access_token,
        "token_type": "bearer",
    }


# ============================================================
# FORGOT PASSWORD
# ============================================================

@app.post("/forgot-password")
def forgot_password(
    email: str,
    db: Session = Depends(get_db),
):

    user = (
        db.query(User)
        .filter(User.email == email)
        .first()
    )

    if not user:
        return {
            "message": (
                "If the email is registered, "
                "a password reset link has been generated."
            )
        }

    reset_token = create_password_reset_token(
        str(user.id)
    )

    return {
        "message": (
            "Password reset token generated successfully."
        ),
        "reset_token": reset_token,
    }


# ============================================================
# RESET PASSWORD
# ============================================================

@app.post("/reset-password")
def reset_password(
    token: str,
    new_password: str,
    db: Session = Depends(get_db),
):

    user_id = verify_password_reset_token(
        token
    )

    if user_id is None:
        raise HTTPException(
            status_code=400,
            detail="Invalid or expired password reset token.",
        )

    user = (
        db.query(User)
        .filter(User.id == user_id)
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found.",
        )

    user.password_hash = hash_password(
        new_password
    )

    user.updated_at = now()

    db.commit()

    return {
        "message": (
            "Password reset successful. "
            "You can now login with your new password."
        )
    }


# ============================================================
# PROTECTED ROUTE
# ============================================================

@app.get("/protected")
def protected_route(
    current_user: dict = Depends(get_current_user),
):

    return {
        "message": (
            "You have accessed a protected route!"
        ),
        "user": current_user,
    }


# ============================================================
# PROFILE
# ============================================================

@app.get("/profile")
def profile(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):

    user_id = current_user["user_id"]

    user = (
        db.query(User)
        .filter(User.id == user_id)
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found",
        )

    return {
        "message": (
            "Welcome to your TrustShare profile"
        ),
        "user": {
            "user_id": str(user.id),
            "name": user.full_name,
            "email": user.email,
            "role": user.role,
            "account_status": user.account_status,
        },
    }


# ============================================================
# UPLOAD FILE
# ============================================================

@app.post("/upload")
async def upload_file(
    file: UploadFile = FastAPIFile(...),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):

    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="No file selected",
        )

    user_id = current_user["user_id"]

    filename = os.path.basename(
        file.filename
    )

    file_data = await file.read()

    if not file_data:
        raise HTTPException(
            status_code=400,
            detail="Uploaded file is empty",
        )

    # --------------------------------------------------------
    # AES-256 encryption
    # --------------------------------------------------------

    file_key = generate_key()

    encrypted_data = encrypt_data(
        file_data,
        file_key,
    )

    # --------------------------------------------------------
    # Protect encryption key
    # --------------------------------------------------------

    protected_key = encrypt_file_key(
        file_key
    )

    # --------------------------------------------------------
    # Generate cloud storage key
    # --------------------------------------------------------

    stored_filename = (
        secrets.token_hex(32)
        + ".enc"
    )

    storage_key = (
        f"trustshare/"
        f"{user_id}/"
        f"{stored_filename}"
    )

    # --------------------------------------------------------
    # Encryption key reference
    # --------------------------------------------------------

    encryption_reference = (
        f"file-key:"
        f"{secrets.token_urlsafe(24)}"
    )

    # --------------------------------------------------------
    # SHA-256 checksum
    # --------------------------------------------------------

    checksum = hashlib.sha256(
        file_data
    ).hexdigest()

    content_type = (
        file.content_type
        or mimetypes.guess_type(filename)[0]
        or "application/octet-stream"
    )

    new_file = None

    try:

        # ----------------------------------------------------
        # Upload encrypted data to Backblaze B2
        # ----------------------------------------------------

        upload_to_b2(
            encrypted_data,
            storage_key,
            "application/octet-stream",
        )

        # ----------------------------------------------------
        # Save metadata in PostgreSQL
        # ----------------------------------------------------

        new_file = FileModel(
            id=uuid.uuid4(),
            owner_id=user_id,
            folder_id=None,
            original_name=filename,
            storage_key=storage_key,
            content_type=content_type,
            size_bytes=len(file_data),
            checksum=checksum,
            encryption_key_reference=(
                encryption_reference
            ),
        )

        db.add(new_file)

        db.flush()

        # ----------------------------------------------------
        # Create version 1
        # ----------------------------------------------------

        db.add(
            FileVersion(
                id=uuid.uuid4(),
                file_id=new_file.id,
                version_number=1,
                storage_key=storage_key,
                size_bytes=len(file_data),
                checksum=checksum,
                encryption_key_reference=(
                    encryption_reference
                ),
                uploaded_by=user_id,
            )
        )

        db.commit()

        db.refresh(new_file)

        # ----------------------------------------------------
        # Save protected key
        # ----------------------------------------------------

        from app.key_store import save_protected_key

        save_protected_key(
            encryption_reference,
            protected_key,
        )

    except Exception as error:

        db.rollback()

        try:
            delete_from_b2(
                storage_key
            )
        except Exception:
            pass

        raise HTTPException(
            status_code=500,
            detail=(
                "Unable to save encrypted file: "
                f"{error}"
            ),
        )

    return {
        "message": (
            "File uploaded and encrypted successfully"
        ),
        "file_id": str(new_file.id),
        "filename": new_file.original_name,
        "stored_filename": stored_filename,
        "user_id": str(new_file.owner_id),
        "encrypted": True,
        "cloud_storage": True,
    }


# ============================================================
# GET MY FILES
# ============================================================

@app.get("/files")
def get_files(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):

    user_id = current_user["user_id"]

    database_files = (
        db.query(FileModel)
        .filter(
            FileModel.owner_id == user_id,
            FileModel.deleted_at.is_(None),
        )
        .all()
    )

    result = []

    for uploaded_file in database_files:

        result.append(
            {
                "id": str(uploaded_file.id),
                "file_id": str(uploaded_file.id),
                "filename": (
                    uploaded_file.original_name
                ),
                "stored_filename": (
                    uploaded_file.storage_key
                    .rsplit("/", 1)[-1]
                ),
                "owner_id": str(
                    uploaded_file.owner_id
                ),
                "encrypted": True,
                "size_bytes": (
                    uploaded_file.size_bytes
                ),
                "content_type": (
                    uploaded_file.content_type
                ),
                "created_at": (
                    uploaded_file.created_at
                ),
            }
        )

    return {
        "files": result
    }


# ============================================================
# DOWNLOAD FILE
# ============================================================

@app.get("/download/{file_id}")
def download_file(
    file_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):

    user_id = current_user["user_id"]

    # --------------------------------------------------------
    # Validate file ID
    # --------------------------------------------------------

    try:

        file_uuid = uuid.UUID(
            file_id
        )

    except ValueError:

        raise HTTPException(
            status_code=400,
            detail="Invalid file ID",
        )

    # --------------------------------------------------------
    # Find file
    # --------------------------------------------------------

    uploaded_file = (
        db.query(FileModel)
        .filter(
            FileModel.id == file_uuid
        )
        .first()
    )

    if not uploaded_file:

        raise HTTPException(
            status_code=404,
            detail="File not found",
        )

    # --------------------------------------------------------
    # Check deleted file
    # --------------------------------------------------------

    if uploaded_file.deleted_at is not None:

        raise HTTPException(
            status_code=404,
            detail="File has been deleted",
        )

    # ========================================================
    # IMPORTANT FIX
    # ========================================================
    # Convert both UUID and user ID to string before comparing.
    # This prevents the owner from being incorrectly treated
    # as another user.
    # ========================================================

    if str(uploaded_file.owner_id) != str(user_id):

        # ----------------------------------------------------
        # Check permission for another user
        # ----------------------------------------------------

        permission = (
            db.query(FilePermission)
            .filter(
                FilePermission.file_id
                == uploaded_file.id,

                FilePermission.user_id
                == user_id,

                or_(
                    FilePermission.expires_at.is_(None),

                    FilePermission.expires_at
                    > now(),
                ),
            )
            .first()
        )

        if not permission:

            raise HTTPException(
                status_code=403,
                detail=(
                    "You do not have permission "
                    "to access this file."
                ),
            )

        # ----------------------------------------------------
        # Check download permission
        # ----------------------------------------------------

        if permission.access_level != "download":

            raise HTTPException(
                status_code=403,
                detail=(
                    "Your permission does not allow "
                    "file download."
                ),
            )

    # --------------------------------------------------------
    # Decrypt file
    # --------------------------------------------------------

    decrypted_data = decrypt_file_record(
        uploaded_file
    )

    # --------------------------------------------------------
    # Create download audit record
    # --------------------------------------------------------

    db.add(
        Download(
            id=uuid.uuid4(),
            file_id=uploaded_file.id,
            share_link_id=None,
            user_id=user_id,
            ip_address=None,
            user_agent=None,
            downloaded_at=now(),
        )
    )

    db.commit()

    # --------------------------------------------------------
    # Return decrypted file
    # --------------------------------------------------------

    return Response(
        content=decrypted_data,
        media_type=uploaded_file.content_type,
        headers={
            "Content-Disposition": (
                "attachment; "
                f'filename="{uploaded_file.original_name}"'
            )
        },
    )


# ============================================================
# SHARE FILE
# ============================================================

@app.post("/share")
def share_file(
    filename: str,
    recipient_email: str,
    permission: str = "download",
    expires_at: datetime | None = None,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):

    sender_id = current_user["user_id"]

    # Allow "read" as alias for "view"
    if permission == "read":
        permission = "view"

    if permission not in [
        "view",
        "download",
    ]:

        raise HTTPException(
            status_code=400,
            detail=(
                "Permission must be "
                "'view' or 'download'."
            ),
        )

    # --------------------------------------------------------
    # Find recipient
    # --------------------------------------------------------

    recipient = (
        db.query(User)
        .filter(
            User.email == recipient_email
        )
        .first()
    )

    if not recipient:

        raise HTTPException(
            status_code=404,
            detail="Recipient user not found",
        )

    if str(recipient.id) == str(sender_id):

        raise HTTPException(
            status_code=400,
            detail=(
                "You cannot share a file "
                "with yourself."
            ),
        )

    # --------------------------------------------------------
    # Find owner's file
    # --------------------------------------------------------

    uploaded_file = (
        db.query(FileModel)
        .filter(
            FileModel.original_name == filename,
            FileModel.owner_id == sender_id,
            FileModel.deleted_at.is_(None),
        )
        .first()
    )

    if not uploaded_file:

        raise HTTPException(
            status_code=404,
            detail=(
                "File not found. "
                "Please upload the file first."
            ),
        )

    # --------------------------------------------------------
    # Check existing permission
    # --------------------------------------------------------

    existing_permission = (
        db.query(FilePermission)
        .filter(
            FilePermission.file_id
            == uploaded_file.id,

            FilePermission.user_id
            == recipient.id,
        )
        .first()
    )

    if existing_permission:

        existing_permission.access_level = (
            permission
        )

        existing_permission.granted_by = (
            sender_id
        )

        existing_permission.expires_at = (
            expires_at
        )

        db.commit()

        db.refresh(
            existing_permission
        )

        permission_record = (
            existing_permission
        )

    else:

        permission_record = FilePermission(
            id=uuid.uuid4(),
            file_id=uploaded_file.id,
            user_id=recipient.id,
            access_level=permission,
            granted_by=sender_id,
            expires_at=expires_at,
            created_at=now(),
        )

        db.add(
            permission_record
        )

        db.commit()

        db.refresh(
            permission_record
        )

    return {
        "message": (
            "Encrypted file shared successfully"
        ),
        "filename": filename,
        "file_id": str(
            uploaded_file.id
        ),
        "share_id": str(
            permission_record.id
        ),
        "sender_id": str(sender_id),
        "recipient_id": str(
            recipient.id
        ),
        "recipient_email": (
            recipient.email
        ),
        "permission": permission,
        "expires_at": (
            permission_record.expires_at
        ),
        "encrypted": True,
    }


# ============================================================
# SHARED WITH ME
# ============================================================

@app.get("/shared-with-me")
def shared_with_me(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):

    user_id = current_user["user_id"]

    permissions = (
        db.query(FilePermission)
        .filter(
            FilePermission.user_id
            == user_id
        )
        .all()
    )

    result = []

    for permission in permissions:

        expires_at = (
            permission.expires_at
        )

        # ----------------------------------------------------
        # Check expiration
        # ----------------------------------------------------

        if expires_at is not None:

            if expires_at.tzinfo is None:

                expires_at = (
                    expires_at.replace(
                        tzinfo=timezone.utc
                    )
                )

            if expires_at <= now():

                continue

        # ----------------------------------------------------
        # Find file
        # ----------------------------------------------------

        uploaded_file = (
            db.query(FileModel)
            .filter(
                FileModel.id
                == permission.file_id
            )
            .first()
        )

        if not uploaded_file:
            continue

        if uploaded_file.deleted_at is not None:
            continue

        # ----------------------------------------------------
        # Find sender
        # ----------------------------------------------------

        sender = (
            db.query(User)
            .filter(
                User.id
                == permission.granted_by
            )
            .first()
        )

        result.append(
            {
                "file_id": str(
                    uploaded_file.id
                ),
                "share_id": str(
                    permission.id
                ),
                "id": str(
                    uploaded_file.id
                ),
                "filename": (
                    uploaded_file.original_name
                ),
                "stored_filename": (
                    uploaded_file.storage_key
                    .rsplit("/", 1)[-1]
                ),
                "owner_id": str(
                    uploaded_file.owner_id
                ),
                "sender_id": str(
                    permission.granted_by
                ),
                "sender_name": (
                    sender.full_name
                    if sender
                    else "TrustShare User"
                ),
                "sender_email": (
                    sender.email
                    if sender
                    else ""
                ),
                "recipient_id": str(
                    permission.user_id
                ),
                "permission": (
                    permission.access_level
                ),
                "expires_at": (
                    permission.expires_at
                ),
                "encrypted": True,
            }
        )

    return {
        "shared_files": result
    }


# ============================================================
# CREATE TEMPORARY LINK
# ============================================================

@app.post(
    "/create-temporary-link/{file_id}"
)
def create_temporary_link(
    file_id: str,
    access_level: str = "view",
    expires_in_hours: int = 12,
    max_downloads: int | None = None,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):

    if access_level not in [
        "view",
        "download",
    ]:

        raise HTTPException(
            status_code=400,
            detail=(
                "Access level must be "
                "'view' or 'download'."
            ),
        )

    if expires_in_hours <= 0:

        raise HTTPException(
            status_code=400,
            detail=(
                "Expiration must be "
                "greater than zero."
            ),
        )

    if (
        max_downloads is not None
        and max_downloads <= 0
    ):

        raise HTTPException(
            status_code=400,
            detail=(
                "Maximum downloads must be "
                "greater than zero."
            ),
        )

    # --------------------------------------------------------
    # Validate file ID
    # --------------------------------------------------------

    try:

        file_uuid = uuid.UUID(
            file_id
        )

    except ValueError:

        raise HTTPException(
            status_code=400,
            detail="Invalid file ID",
        )

    # --------------------------------------------------------
    # Find file
    # --------------------------------------------------------

    uploaded_file = (
        db.query(FileModel)
        .filter(
            FileModel.id == file_uuid
        )
        .first()
    )

    if not uploaded_file:

        raise HTTPException(
            status_code=404,
            detail="File not found",
        )

    # --------------------------------------------------------
    # Only owner can create link
    # --------------------------------------------------------

    if str(uploaded_file.owner_id) != str(
        current_user["user_id"]
    ):

        raise HTTPException(
            status_code=403,
            detail=(
                "Only the file owner can "
                "create a temporary link."
            ),
        )

    # --------------------------------------------------------
    # Generate secure token
    # --------------------------------------------------------

    raw_token = secrets.token_urlsafe(
        32
    )

    token_hash = hashlib.sha256(
        raw_token.encode()
    ).hexdigest()

    # --------------------------------------------------------
    # Expiration
    # --------------------------------------------------------

    expires_at = (
        now()
        + timedelta(
            hours=expires_in_hours
        )
    )

    # --------------------------------------------------------
    # Create share link
    # --------------------------------------------------------

    link = ShareLink(
        id=uuid.uuid4(),
        file_id=uploaded_file.id,
        created_by=current_user["user_id"],
        token_hash=token_hash,
        access_level=access_level,
        expires_at=expires_at,
        max_downloads=max_downloads,
        download_count=0,
        is_active=True,
        created_at=now(),
    )

    db.add(link)

    db.commit()

    db.refresh(link)

    return {
        "message": (
            "Temporary share link "
            "created successfully"
        ),
        "file_id": str(
            uploaded_file.id
        ),
        "filename": (
            uploaded_file.original_name
        ),
        "token": raw_token,
        "expires_at": expires_at,
        "access_level": access_level,
        "max_downloads": max_downloads,
        "temporary_download_url": (
            f"/temporary-download/"
            f"{raw_token}"
        ),
    }


# ============================================================
# TEMPORARY DOWNLOAD
# ============================================================

@app.get(
    "/temporary-download/{token}"
)
def temporary_download(
    token: str,
    request: Request,
    db: Session = Depends(get_db),
):

    # --------------------------------------------------------
    # Hash token
    # --------------------------------------------------------

    token_hash = hashlib.sha256(
        token.encode()
    ).hexdigest()

    link = (
        db.query(ShareLink)
        .filter(
            ShareLink.token_hash
            == token_hash
        )
        .first()
    )

    if not link:

        raise HTTPException(
            status_code=404,
            detail="Share link not found.",
        )

    # --------------------------------------------------------
    # Check active
    # --------------------------------------------------------

    if not link.is_active:

        raise HTTPException(
            status_code=410,
            detail=(
                "Share link has been revoked."
            ),
        )

    # --------------------------------------------------------
    # Check expiration
    # --------------------------------------------------------

    if now() >= link.expires_at:

        link.is_active = False

        db.commit()

        raise HTTPException(
            status_code=410,
            detail=(
                "Share link has expired."
            ),
        )

    # --------------------------------------------------------
    # Check download limit
    # --------------------------------------------------------

    if (
        link.max_downloads is not None
        and link.download_count
        >= link.max_downloads
    ):

        link.is_active = False

        db.commit()

        raise HTTPException(
            status_code=410,
            detail=(
                "Share link download "
                "limit reached."
            ),
        )

    # --------------------------------------------------------
    # Find file
    # --------------------------------------------------------

    uploaded_file = (
        db.query(FileModel)
        .filter(
            FileModel.id
            == link.file_id
        )
        .first()
    )

    if not uploaded_file:

        raise HTTPException(
            status_code=404,
            detail="File not found.",
        )

    if uploaded_file.deleted_at is not None:

        raise HTTPException(
            status_code=404,
            detail="File has been deleted.",
        )

    # --------------------------------------------------------
    # Decrypt file
    # --------------------------------------------------------

    decrypted_data = decrypt_file_record(
        uploaded_file
    )

    # --------------------------------------------------------
    # Increase download count
    # --------------------------------------------------------

    link.download_count += 1

    if (
        link.max_downloads is not None
        and link.download_count
        >= link.max_downloads
    ):

        link.is_active = False

    # --------------------------------------------------------
    # Get client information
    # --------------------------------------------------------

    client_ip = None

    if request.client:

        client_ip = request.client.host

    # --------------------------------------------------------
    # Create download audit record
    # --------------------------------------------------------

    db.add(
        Download(
            id=uuid.uuid4(),
            file_id=uploaded_file.id,
            share_link_id=link.id,
            user_id=None,
            ip_address=client_ip,
            user_agent=request.headers.get(
                "user-agent"
            ),
            downloaded_at=now(),
        )
    )

    db.commit()

    # --------------------------------------------------------
    # Return decrypted file
    # --------------------------------------------------------

    return Response(
        content=decrypted_data,
        media_type=uploaded_file.content_type,
        headers={
            "Content-Disposition": (
                "attachment; "
                f'filename="{uploaded_file.original_name}"'
            )
        },
    )


# ============================================================
# REVOKE TEMPORARY LINK
# ============================================================

@app.post(
    "/revoke-share-link/{link_id}"
)
def revoke_share_link(
    link_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):

    try:

        link_uuid = uuid.UUID(
            link_id
        )

    except ValueError:

        raise HTTPException(
            status_code=400,
            detail="Invalid share link ID",
        )

    link = (
        db.query(ShareLink)
        .filter(
            ShareLink.id
            == link_uuid
        )
        .first()
    )

    if not link:

        raise HTTPException(
            status_code=404,
            detail="Share link not found",
        )

    if str(link.created_by) != str(
        current_user["user_id"]
    ):

        raise HTTPException(
            status_code=403,
            detail=(
                "Only the link creator "
                "can revoke this link."
            ),
        )

    link.is_active = False
    link.revoked_at = now()

    db.commit()

    return {
        "message": (
            "Share link revoked successfully"
        ),
        "link_id": str(link.id),
    }


# ============================================================
# DELETE FILE
# ============================================================

@app.delete("/files/{file_id}")
def delete_file(
    file_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):

    try:

        file_uuid = uuid.UUID(
            file_id
        )

    except ValueError:

        raise HTTPException(
            status_code=400,
            detail="Invalid file ID",
        )

    uploaded_file = (
        db.query(FileModel)
        .filter(
            FileModel.id == file_uuid
        )
        .first()
    )

    if not uploaded_file:

        raise HTTPException(
            status_code=404,
            detail="File not found",
        )

    if str(uploaded_file.owner_id) != str(
        current_user["user_id"]
    ):

        raise HTTPException(
            status_code=403,
            detail=(
                "Only the file owner can "
                "delete this file."
            ),
        )

    # --------------------------------------------------------
    # Delete from B2
    # --------------------------------------------------------

    try:

        delete_from_b2(
            uploaded_file.storage_key
        )

    except Exception:
        pass

    # --------------------------------------------------------
    # Soft delete in PostgreSQL
    # --------------------------------------------------------

    uploaded_file.deleted_at = now()
    uploaded_file.updated_at = now()

    # --------------------------------------------------------
    # Revoke share links
    # --------------------------------------------------------

    db.query(ShareLink).filter(
        ShareLink.file_id
        == uploaded_file.id
    ).update(
        {
            "is_active": False,
            "revoked_at": now(),
        },
        synchronize_session=False,
    )

    # --------------------------------------------------------
    # Remove permissions
    # --------------------------------------------------------

    db.query(FilePermission).filter(
        FilePermission.file_id
        == uploaded_file.id
    ).delete(
        synchronize_session=False
    )

    db.commit()

    return {
        "message": "File deleted successfully",
        "file_id": str(
            uploaded_file.id
        ),
        "filename": (
            uploaded_file.original_name
        ),
    }


# ============================================================
# ADMIN - GET ALL USERS
# ============================================================

@app.get("/admin/users")
def get_all_users(
    current_admin: dict = Depends(
        get_current_admin
    ),
    db: Session = Depends(get_db),
):

    users = (
        db.query(User)
        .order_by(User.created_at)
        .all()
    )

    return {
        "message": "Admin access granted",

        "users": [
            {
                "id": str(user.id),
                "name": user.full_name,
                "email": user.email,
                "role": user.role,
                "account_status": (
                    user.account_status
                ),
                "created_at": (
                    user.created_at
                ),
            }

            for user in users
        ],
    }


# ============================================================
# ADMIN - CHANGE USER ROLE
# ============================================================

@app.put(
    "/admin/users/{user_id}/role"
)
def change_user_role(
    user_id: str,
    role: str,
    current_admin: dict = Depends(
        get_current_admin
    ),
    db: Session = Depends(get_db),
):

    if role not in [
        "user",
        "admin",
    ]:

        raise HTTPException(
            status_code=400,
            detail=(
                "Role must be either "
                "'user' or 'admin'"
            ),
        )

    try:

        user_uuid = uuid.UUID(
            user_id
        )

    except ValueError:

        raise HTTPException(
            status_code=400,
            detail="Invalid user ID",
        )

    user = (
        db.query(User)
        .filter(
            User.id == user_uuid
        )
        .first()
    )

    if not user:

        raise HTTPException(
            status_code=404,
            detail="User not found",
        )

    user.role = role
    user.updated_at = now()

    db.commit()

    db.refresh(user)

    return {
        "message": (
            "User role updated successfully"
        ),
        "user_id": str(user.id),
        "name": user.full_name,
        "email": user.email,
        "role": user.role,
    }


# ============================================================
# ADMIN - DELETE USER
# ============================================================

@app.delete(
    "/admin/users/{user_id}"
)
def delete_user(
    user_id: str,
    current_admin: dict = Depends(
        get_current_admin
    ),
    db: Session = Depends(get_db),
):

    try:

        user_uuid = uuid.UUID(
            user_id
        )

    except ValueError:

        raise HTTPException(
            status_code=400,
            detail="Invalid user ID",
        )

    user = (
        db.query(User)
        .filter(
            User.id == user_uuid
        )
        .first()
    )

    if not user:

        raise HTTPException(
            status_code=404,
            detail="User not found",
        )

    # --------------------------------------------------------
    # Prevent admin from deleting themselves
    # --------------------------------------------------------

    if str(user.id) == str(
        current_admin["user_id"]
    ):

        raise HTTPException(
            status_code=400,
            detail=(
                "Admin cannot delete "
                "their own account"
            ),
        )

    # --------------------------------------------------------
    # Get files owned by user
    # --------------------------------------------------------

    user_files = (
        db.query(FileModel)
        .filter(
            FileModel.owner_id == user.id
        )
        .all()
    )

    # --------------------------------------------------------
    # Delete user's files
    # --------------------------------------------------------

    for uploaded_file in user_files:

        try:

            delete_from_b2(
                uploaded_file.storage_key
            )

        except Exception:
            pass

        # Delete share links
        db.query(ShareLink).filter(
            ShareLink.file_id
            == uploaded_file.id
        ).delete(
            synchronize_session=False
        )

        # Delete permissions
        db.query(FilePermission).filter(
            FilePermission.file_id
            == uploaded_file.id
        ).delete(
            synchronize_session=False
        )

        # Delete versions
        db.query(FileVersion).filter(
            FileVersion.file_id
            == uploaded_file.id
        ).delete(
            synchronize_session=False
        )

        # Delete download records
        db.query(Download).filter(
            Download.file_id
            == uploaded_file.id
        ).delete(
            synchronize_session=False
        )

        # Delete file
        db.delete(
            uploaded_file
        )

    # --------------------------------------------------------
    # Remove permissions granted by user
    # --------------------------------------------------------

    db.query(FilePermission).filter(
        FilePermission.granted_by
        == user.id
    ).delete(
        synchronize_session=False
    )

    # --------------------------------------------------------
    # Remove folders owned by user
    # --------------------------------------------------------

    db.query(Folder).filter(
        Folder.owner_id
        == user.id
    ).delete(
        synchronize_session=False
    )

    # --------------------------------------------------------
    # Delete user
    # --------------------------------------------------------

    db.delete(user)

    db.commit()

    return {
        "message": "User deleted successfully",
        "user_id": str(user_uuid),
        "email": user.email,
    }