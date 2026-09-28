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
from sqlalchemy import or_, text

from app.database import Base, engine, SessionLocal
from app.models import (
    User,
    Folder,
    File as FileModel,
    FileVersion,
    FilePermission,
    ShareLink,
    Download,
    ActivityLog,
    Notification,
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
import json
import urllib.request
import secrets
import hashlib
import mimetypes
import uuid
import io
import re
import socket



def get_system_name():
    """Return the computer/system name for activity and security records."""
    try:
        return socket.gethostname()
    except Exception:
        return "Unknown System"


from app.b2_storage import (
    upload_to_b2,
    download_from_b2,
    delete_from_b2,
)

from datetime import datetime, timedelta, timezone


# India Standard Time (IST) = UTC+05:30
IST = timezone(timedelta(hours=5, minutes=30))


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
        # Keep PostgreSQL server-side timestamps (server_default=func.now()) in IST.
        db.execute(text("SET TIME ZONE 'Asia/Kolkata'"))
        yield db
    finally:
        db.close()


def now():
    # The project database uses timezone-naive DateTime columns, so store
    # the current Indian wall-clock time without a timezone suffix.
    return datetime.now(IST).replace(tzinfo=None)


def normalize_to_ist(value):
    """Convert a datetime value to naive IST for our PostgreSQL DateTime columns."""
    if value is None:
        return None

    if value.tzinfo is None:
        return value

    return value.astimezone(IST).replace(tzinfo=None)


# ============================================================
# ACTIVITY LOGGING - MILESTONE 3
# ============================================================

def log_activity(
    db: Session,
    action: str,
    user_id=None,
    file_id=None,
    details=None,
    request: Request = None,
):
    activity = ActivityLog(
        user_id=user_id,
        action=action,
        file_id=file_id,
        details=details,
        ip_address=get_system_name(),
        user_agent=(
            request.headers.get("user-agent")
            if request
            else None
        ),
        created_at=now(),
    )

    db.add(activity)
    db.flush()

    return activity


# ============================================================
# NOTIFICATION HELPERS - MILESTONE 3
# ============================================================

def create_notification(
    db: Session,
    user_id,
    notification_type: str,
    title: str,
    message: str,
    related_file_id=None,
):
    notification = Notification(
        id=uuid.uuid4(),
        user_id=user_id,
        notification_type=notification_type,
        title=title,
        message=message,
        related_file_id=related_file_id,
        is_read=False,
        created_at=now(),
    )

    db.add(notification)
    db.flush()
    return notification


def create_security_alert(
    db: Session,
    user_id,
    title: str,
    message: str,
):
    return create_notification(
        db=db,
        user_id=user_id,
        notification_type="security_alert",
        title=title,
        message=message,
    )


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
        protected_key = None
        current_reference = file_record.encryption_key_reference
        legacy_reference = f"legacy-key:{file_record.id}"

        # 1. Normal key reference.
        if current_reference:
            protected_key = get_protected_key(current_reference)

        # 2. Migrated-file key reference.
        if not protected_key:
            protected_key = get_protected_key(legacy_reference)

        # 3. Rebuild the migrated key store if necessary.
        if not protected_key:
            try:
                initialize_legacy_key_store()
            except Exception:
                pass
            protected_key = get_protected_key(legacy_reference)

        # 4. Database fallback for older migrated files.
        # Some older files still have their protected key in legacy_files.
        if not protected_key:
            repair_db = SessionLocal()
            try:
                row = repair_db.execute(
                    text("""
                        SELECT encrypted_key
                        FROM legacy_files
                        WHERE encrypted_key IS NOT NULL
                          AND CONCAT('trustshare/', owner_id, '/', stored_filename) = :storage_key
                        LIMIT 1
                    """),
                    {"storage_key": file_record.storage_key},
                ).mappings().first()

                if row and row["encrypted_key"]:
                    protected_key = row["encrypted_key"]
                    from app.key_store import save_protected_key
                    save_protected_key(legacy_reference, protected_key)
                    if current_reference:
                        save_protected_key(current_reference, protected_key)
            except Exception:
                # Keep the normal key-store path working even if the legacy table
                # does not exist in this database.
                pass
            finally:
                repair_db.close()

        if not protected_key:
            raise HTTPException(
                status_code=500,
                detail=(
                    "Encryption key not found for this file. "
                    "Please re-upload the file or repair its key-store entry."
                ),
            )

        # Keep both references synchronized.
        from app.key_store import save_protected_key
        if current_reference and not get_protected_key(current_reference):
            save_protected_key(current_reference, protected_key)
        if not get_protected_key(legacy_reference):
            save_protected_key(legacy_reference, protected_key)

        file_key = decrypt_file_key(protected_key)
        encrypted_data = get_file_from_storage(file_record)
        return decrypt_data(encrypted_data, file_key)

    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Unable to decrypt file: {error}",
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
    request: Request,
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

    def record_failed_login(detail: str):
        log_activity(
            db=db,
            action="login_failed",
            user_id=user.id,
            details=detail,
            request=request,
        )

        cutoff = now() - timedelta(minutes=10)
        failed_attempts = (
            db.query(ActivityLog)
            .filter(
                ActivityLog.user_id == user.id,
                ActivityLog.action == "login_failed",
                ActivityLog.created_at >= cutoff,
            )
            .count()
        )

        if failed_attempts >= 3:
            create_security_alert(
                db=db,
                user_id=user.id,
                title="Security alert",
                message=(
                    "Multiple failed login attempts were detected "
                    "for your account in the last 10 minutes."
                ),
            )

        db.commit()

    try:
        password_correct = verify_password(
            password,
            user.password_hash,
        )
    except Exception:
        record_failed_login(
            "Login failed because password data is invalid"
        )
        return {
            "message": (
                "Password data is invalid. "
                "Please register this account again."
            )
        }

    if not password_correct:
        record_failed_login("Invalid password entered")
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

    log_activity(
        db=db,
        action="login",
        user_id=user.id,
        details="User login successful",
        request=request,
    )

    create_notification(
        db=db,
        user_id=user.id,
        notification_type="security",
        title="New login detected",
        message=(
            "A new login to your TrustShare account was detected "
            f"from system {get_system_name()}."
        ),
    )

    db.commit()

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
    request: Request = None,
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

        log_activity(
            db=db,
            action="file_upload",
            user_id=user_id,
            file_id=new_file.id,
            details=f"File uploaded: {filename}",
            request=request,
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
    request: Request,
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
            ip_address=get_system_name(),
            user_agent=request.headers.get("user-agent"),
            downloaded_at=now(),
        )
    )

    log_activity(
        db=db,
        action="file_download",
        user_id=user_id,
        file_id=uploaded_file.id,
        details=f"File downloaded: {uploaded_file.original_name}",
        request=request,
    )

    db.commit()

    # --------------------------------------------------------
    # Standard download endpoint always downloads the file.
    # Viewing is handled by /view/{file_id}.
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
# VIEW FILE
# ============================================================

@app.get("/view/{file_id}")
def view_file(
    file_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):

    user_id = current_user["user_id"]

    try:
        file_uuid = uuid.UUID(file_id)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid file ID",
        )

    uploaded_file = (
        db.query(FileModel)
        .filter(FileModel.id == file_uuid)
        .first()
    )

    if not uploaded_file:
        raise HTTPException(
            status_code=404,
            detail="File not found",
        )

    if uploaded_file.deleted_at is not None:
        raise HTTPException(
            status_code=404,
            detail="File has been deleted",
        )

    # Owner can always view the file.
    authorized = str(uploaded_file.owner_id) == str(user_id)

    if not authorized:
        permission = (
            db.query(FilePermission)
            .filter(
                FilePermission.file_id == uploaded_file.id,
                FilePermission.user_id == user_id,
                or_(
                    FilePermission.expires_at.is_(None),
                    FilePermission.expires_at > now(),
                ),
            )
            .first()
        )

        if not permission:
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to view this file.",
            )

        if permission.access_level not in ["view", "download"]:
            raise HTTPException(
                status_code=403,
                detail="Your permission does not allow viewing this file.",
            )

    decrypted_data = decrypt_file_record(uploaded_file)

    log_activity(
        db=db,
        action="file_view",
        user_id=user_id,
        file_id=uploaded_file.id,
        details=f"File viewed: {uploaded_file.original_name}",
        request=request,
    )

    db.commit()

    return Response(
        content=decrypted_data,
        media_type=uploaded_file.content_type,
        headers={
            "Content-Disposition": (
                "inline; "
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
    request: Request = None,
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

    # Store an expiration supplied by the client in IST.
    expires_at = normalize_to_ist(expires_at)

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

        log_activity(
            db=db,
            action="file_shared",
            user_id=sender_id,
            file_id=uploaded_file.id,
            details=(
                f"File shared with {recipient.email} "
                f"with {permission} permission"
            ),
            request=request,
        )

        create_notification(
            db=db,
            user_id=recipient.id,
            notification_type="file_shared",
            title="File shared with you",
            message=(
                f"{current_user['email']} shared {filename} "
                f"with {permission} access."
            ),
            related_file_id=uploaded_file.id,
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

        log_activity(
            db=db,
            action="file_shared",
            user_id=sender_id,
            file_id=uploaded_file.id,
            details=(
                f"File shared with {recipient.email} "
                f"with {permission} permission"
            ),
            request=request,
        )

        create_notification(
            db=db,
            user_id=recipient.id,
            notification_type="file_shared",
            title="File shared with you",
            message=(
                f"{current_user['email']} shared {filename} "
                f"with {permission} access."
            ),
            related_file_id=uploaded_file.id,
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

            expires_at = normalize_to_ist(expires_at)

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
    request: Request = None,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):

    if access_level not in ["view", "download"]:
        raise HTTPException(
            status_code=400,
            detail="Access level must be 'view' or 'download'.",
        )

    if expires_in_hours <= 0:
        raise HTTPException(
            status_code=400,
            detail="Expiration must be greater than zero.",
        )

    if max_downloads is not None and max_downloads <= 0:
        raise HTTPException(
            status_code=400,
            detail="Maximum downloads must be greater than zero.",
        )

    # Maximum downloads apply only to Download links.
    # View links are for inline viewing and do not consume download counts.
    if access_level == "view":
        max_downloads = None

    try:
        file_uuid = uuid.UUID(file_id)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid file ID",
        )

    uploaded_file = (
        db.query(FileModel)
        .filter(FileModel.id == file_uuid)
        .first()
    )

    if not uploaded_file:
        raise HTTPException(
            status_code=404,
            detail="File not found",
        )

    if str(uploaded_file.owner_id) != str(current_user["user_id"]):
        raise HTTPException(
            status_code=403,
            detail="Only the file owner can create a temporary link.",
        )

    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    expires_at = now() + timedelta(hours=expires_in_hours)

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

    log_activity(
        db=db,
        action="temporary_link_created",
        user_id=current_user["user_id"],
        file_id=uploaded_file.id,
        details=f"Temporary link created with {access_level} access",
        request=request,
    )

    db.commit()
    db.refresh(link)

    return {
        "message": "Temporary share link created successfully",
        "link_id": str(link.id),
        "file_id": str(uploaded_file.id),
        "filename": uploaded_file.original_name,
        "token": raw_token,
        "expires_at": expires_at,
        "access_level": access_level,
        "max_downloads": max_downloads,
        "temporary_download_url": f"/temporary-download/{raw_token}",
    }


# ============================================================
# TEMPORARY DOWNLOAD / VIEW
# ============================================================

@app.get("/temporary-download/{token}")
def temporary_download(
    token: str,
    request: Request,
    db: Session = Depends(get_db),
):

    token_hash = hashlib.sha256(token.encode()).hexdigest()

    link = (
        db.query(ShareLink)
        .filter(ShareLink.token_hash == token_hash)
        .first()
    )

    if not link:
        raise HTTPException(
            status_code=404,
            detail="Share link not found.",
        )

    if not link.is_active:
        raise HTTPException(
            status_code=410,
            detail="Share link has been revoked.",
        )

    expires_at = link.expires_at
    if expires_at is not None and expires_at.tzinfo is not None:
        expires_at = expires_at.astimezone(IST).replace(tzinfo=None)

    if expires_at is not None and now() >= expires_at:
        link.is_active = False
        db.commit()
        raise HTTPException(
            status_code=410,
            detail="Share link has expired.",
        )

    # Download limits apply only to Download links.
    if (
        link.access_level == "download"
        and link.max_downloads is not None
        and link.download_count >= link.max_downloads
    ):
        link.is_active = False
        db.commit()
        raise HTTPException(
            status_code=410,
            detail="Share link download limit reached.",
        )

    uploaded_file = (
        db.query(FileModel)
        .filter(FileModel.id == link.file_id)
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

    decrypted_data = decrypt_file_record(uploaded_file)

    client_ip = get_system_name()

    if link.access_level == "download":
        # Count only real downloads.
        link.download_count += 1

        if (
            link.max_downloads is not None
            and link.download_count >= link.max_downloads
        ):
            link.is_active = False

        db.add(
            Download(
                id=uuid.uuid4(),
                file_id=uploaded_file.id,
                share_link_id=link.id,
                user_id=None,
                ip_address=client_ip,
                user_agent=request.headers.get("user-agent"),
                downloaded_at=now(),
            )
        )

        log_activity(
            db=db,
            action="temporary_file_download",
            user_id=None,
            file_id=uploaded_file.id,
            details=f"Temporary download: {uploaded_file.original_name}",
            request=request,
        )

        content_disposition = "attachment"
    else:
        # View links are inline and do not increment download_count.
        log_activity(
            db=db,
            action="temporary_file_viewed",
            user_id=None,
            file_id=uploaded_file.id,
            details=f"Temporary view: {uploaded_file.original_name}",
            request=request,
        )

        content_disposition = "inline"

    db.commit()

    return Response(
        content=decrypted_data,
        media_type=uploaded_file.content_type,
        headers={
            "Content-Disposition": (
                f"{content_disposition}; "
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
    request: Request,
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

    log_activity(
        db=db,
        action="temporary_link_revoked",
        user_id=current_user["user_id"],
        file_id=link.file_id,
        details="Temporary share link revoked",
        request=request,
    )

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
    request: Request,
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

    log_activity(
        db=db,
        action="file_deleted",
        user_id=current_user["user_id"],
        file_id=uploaded_file.id,
        details=f"File deleted: {uploaded_file.original_name}",
        request=request,
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
    request: Request,
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

    log_activity(
        db=db,
        action="admin_role_change",
        user_id=current_admin["user_id"],
        details=(
            f"Admin changed {user.email} role to {role}"
        ),
        request=request,
    )

    create_notification(
        db=db,
        user_id=user.id,
        notification_type="security",
        title="Account role changed",
        message=(
            f"Your TrustShare role was changed to '{role}' by an administrator."
        ),
    )

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
    request: Request,
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
    # Log user deletion
    # --------------------------------------------------------

    log_activity(
        db=db,
        action="admin_user_delete",
        user_id=current_admin["user_id"],
        details=(
            f"Admin deleted user account: {user.email}"
        ),
        request=request,
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

# ============================================================
# AI ACTIVITY SUMMARY - ADDITIONAL FEATURE
# ============================================================

def _local_activity_summary(logs):
    counts = {}
    for log in logs:
        action = str(log.action or "other").lower()
        counts[action] = counts.get(action, 0) + 1

    labels = {
        "login": "logins",
        "login_failed": "failed login attempts",
        "file_upload": "file uploads",
        "file_download": "file downloads",
        "file_view": "file views",
        "file_shared": "file sharing actions",
        "temporary_link_created": "temporary links",
        "file_deleted": "file deletions",
    }
    parts = [
        f"{count} {labels.get(action, action.replace('_', ' '))}"
        for action, count in counts.items() if count
    ]
    summary = (
        "Recent activity includes " + ", ".join(parts) + "."
        if parts else "No recent activity was found."
    )
    failed = counts.get("login_failed", 0)
    downloads = counts.get("file_download", 0)
    if failed >= 5:
        insight = f"{failed} failed login attempts were recorded. This should be reviewed as a possible security concern."
    elif downloads >= 10:
        insight = f"{downloads} file downloads were recorded. Review the download activity if it was unexpected."
    else:
        insight = "No obvious unusual activity was identified in these records."
    return {"summary": summary, "security_insight": insight, "source": "local_activity_analysis"}


def _generate_ai_summary(logs):
    fallback = _local_activity_summary(logs)
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return fallback

    compact_logs = [
        {"action": log.action, "details": log.details, "ip": log.ip_address, "time": str(log.created_at)}
        for log in logs[:50]
    ]
    prompt = (
        "You are the security activity assistant for TrustShare. Analyze these user activity logs. "
        'Return ONLY valid JSON with two string fields: "summary" and "security_insight". '
        "Keep both short and easy to understand. Do not invent events or facts. "
        "Mention suspicious patterns only when supported by the logs.\n\n" +
        json.dumps(compact_logs, default=str)
    )
    payload = json.dumps({
        "model": os.getenv("OPENAI_ACTIVITY_MODEL", "gpt-5.6-luna"),
        "input": prompt,
    }).encode("utf-8")
    request = urllib.request.Request(
        "https://api.openai.com/v1/responses",
        data=payload,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            result = json.loads(response.read().decode("utf-8"))
        output_text = result.get("output_text")
        if not output_text:
            for item in result.get("output", []):
                for content in item.get("content", []):
                    if content.get("type") == "output_text":
                        output_text = content.get("text")
                        break
                if output_text:
                    break
        if not output_text:
            return fallback
        parsed = json.loads(output_text)
        return {
            "summary": str(parsed.get("summary") or fallback["summary"]),
            "security_insight": str(parsed.get("security_insight") or fallback["security_insight"]),
            "source": "openai",
        }
    except Exception:
        return fallback



# AI DASHBOARD INSIGHTS - OVERALL DASHBOARD SUMMARY
# ============================================================

def _generate_ai_dashboard_insights(data: dict) -> dict:
    """Generate a short AI overview from the user's dashboard metrics."""
    fallback = {
        "summary": (
            f"You have {data['total_files']} active files using "
            f"{data['storage_mb']} MB of storage. There are "
            f"{data['activity_count']} recent activity events and "
            f"{data['unread_notifications']} unread notifications."
        ),
        "security_insight": (
            "Suspicious activity is currently detected. Review recent security events."
            if data["suspicious"]
            else "No suspicious activity was detected in the recent monitoring period."
        ),
        "recommendation": (
            "Review the suspicious activity and recent notifications."
            if data["suspicious"]
            else "Continue monitoring recent activity and notifications regularly."
        ),
        "source": "dashboard-fallback",
    }

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return fallback

    prompt = (
        "Analyze this TrustShare user's overall dashboard data. "
        "Return ONLY valid JSON with three short string fields: "
        "summary, security_insight, recommendation. "
        "Keep the language simple. Do not invent facts. "
        "Mention suspicious activity only when the supplied data says it is true.\n\n"
        + json.dumps(data, default=str)
    )

    payload = json.dumps({
        "model": os.getenv("OPENAI_DASHBOARD_MODEL", os.getenv("OPENAI_ACTIVITY_MODEL", "gpt-5.6-luna")),
        "input": prompt,
    }).encode("utf-8")

    request = urllib.request.Request(
        "https://api.openai.com/v1/responses",
        data=payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            result = json.loads(response.read().decode("utf-8"))

        output_text = result.get("output_text")
        if not output_text:
            for item in result.get("output", []):
                for content in item.get("content", []):
                    if content.get("type") == "output_text":
                        output_text = content.get("text")
                        break
                if output_text:
                    break

        if not output_text:
            return fallback

        parsed = json.loads(output_text)
        return {
            "summary": str(parsed.get("summary") or fallback["summary"]),
            "security_insight": str(parsed.get("security_insight") or fallback["security_insight"]),
            "recommendation": str(parsed.get("recommendation") or fallback["recommendation"]),
            "source": "openai",
        }
    except Exception:
        return fallback


@app.get("/ai/dashboard-insights")
def get_ai_dashboard_insights(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return AI-generated insights covering the whole user dashboard."""
    user_id = current_user["user_id"]

    files = (
        db.query(FileModel)
        .filter(
            FileModel.owner_id == user_id,
            FileModel.deleted_at.is_(None),
        )
        .all()
    )
    total_bytes = sum(int(f.size_bytes or 0) for f in files)

    activity_count = (
        db.query(ActivityLog)
        .filter(ActivityLog.user_id == user_id)
        .count()
    )

    unread_notifications = (
        db.query(Notification)
        .filter(
            Notification.user_id == user_id,
            Notification.is_read.is_(False),
        )
        .count()
    )

    suspicious_results = _detect_suspicious_activity(
        db=db,
        user_id=user_id,
        window_minutes=10,
    )

    recent_logs = (
        db.query(ActivityLog)
        .filter(ActivityLog.user_id == user_id)
        .order_by(ActivityLog.created_at.desc())
        .limit(30)
        .all()
    )

    action_counts = {}
    for log in recent_logs:
        action_counts[log.action] = action_counts.get(log.action, 0) + 1

    data = {
        "total_files": len(files),
        "storage_mb": round(total_bytes / (1024 * 1024), 2),
        "activity_count": activity_count,
        "unread_notifications": unread_notifications,
        "suspicious": bool(suspicious_results),
        "suspicious_event_count": len(suspicious_results),
        "recent_action_counts": action_counts,
    }

    return {
        "generated_at": now(),
        "metrics": data,
        **_generate_ai_dashboard_insights(data),
    }


# ============================================================



@app.get("/ai/activity-summary")
def get_ai_activity_summary(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    logs = (
        db.query(ActivityLog)
        .filter(ActivityLog.user_id == current_user["user_id"])
        .order_by(ActivityLog.created_at.desc())
        .limit(50)
        .all()
    )
    return {"generated_at": now(), "activity_count": len(logs), **_generate_ai_summary(logs)}


# ============================================================
# MILESTONE 3 - ACTIVITY LOGS
# ============================================================

@app.get("/activity-logs")
def get_activity_logs(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = current_user["user_id"]

    logs = (
        db.query(ActivityLog)
        .filter(ActivityLog.user_id == user_id)
        .order_by(ActivityLog.created_at.desc())
        .limit(100)
        .all()
    )

    return {
        "logs": [
            {
                "id": str(log.id),
                "action": log.action,
                "file_id": (
                    str(log.file_id)
                    if log.file_id
                    else None
                ),
                "details": log.details,
                "ip_address": log.ip_address,
                "user_agent": log.user_agent,
                "created_at": log.created_at,
            }
            for log in logs
        ]
    }


@app.get("/admin/activity-logs")
def get_all_activity_logs(
    current_admin: dict = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    logs = (
        db.query(ActivityLog)
        .order_by(ActivityLog.created_at.desc())
        .limit(500)
        .all()
    )

    return {
        "logs": [
            {
                "id": str(log.id),
                "user_id": (
                    str(log.user_id)
                    if log.user_id
                    else None
                ),
                "action": log.action,
                "file_id": (
                    str(log.file_id)
                    if log.file_id
                    else None
                ),
                "details": log.details,
                "ip_address": log.ip_address,
                "user_agent": log.user_agent,
                "created_at": log.created_at,
            }
            for log in logs
        ]
    }


# ============================================================
# MILESTONE 3 - FILE ACTIVITY & SECURITY REPORTS
# ============================================================

@app.get("/reports/file-activity/{file_id}")
def get_file_activity_report(
    file_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return an activity report for one file owned by the current user."""

    try:
        file_uuid = uuid.UUID(file_id)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid file ID",
        )

    file_record = (
        db.query(FileModel)
        .filter(FileModel.id == file_uuid)
        .first()
    )

    if not file_record:
        raise HTTPException(
            status_code=404,
            detail="File not found",
        )

    # Only the owner or an admin can generate the file report.
    if (
        str(file_record.owner_id) != str(current_user["user_id"])
        and current_user.get("role") != "admin"
    ):
        raise HTTPException(
            status_code=403,
            detail="You do not have access to this file report",
        )

    logs = (
        db.query(ActivityLog)
        .filter(ActivityLog.file_id == file_uuid)
        .order_by(ActivityLog.created_at.desc())
        .limit(200)
        .all()
    )

    action_counts = {}
    for log in logs:
        action_counts[log.action] = action_counts.get(log.action, 0) + 1

    download_count = (
        db.query(Download)
        .filter(Download.file_id == file_uuid)
        .count()
    )

    share_count = (
        db.query(FilePermission)
        .filter(FilePermission.file_id == file_uuid)
        .count()
    )

    temporary_link_count = (
        db.query(ShareLink)
        .filter(ShareLink.file_id == file_uuid)
        .count()
    )

    return {
        "file": {
            "file_id": str(file_record.id),
            "filename": file_record.original_name,
            "owner_id": str(file_record.owner_id),
            "size_bytes": file_record.size_bytes,
            "created_at": file_record.created_at,
        },
        "summary": {
            "total_activity_events": len(logs),
            "downloads": download_count,
            "active_or_historical_permissions": share_count,
            "temporary_links": temporary_link_count,
            "actions": action_counts,
        },
        "activity": [
            {
                "id": str(log.id),
                "action": log.action,
                "user_id": str(log.user_id) if log.user_id else None,
                "details": log.details,
                "ip_address": log.ip_address,
                "created_at": log.created_at,
            }
            for log in logs
        ],
    }


@app.get("/admin/reports/security")
def get_security_report(
    days: int = 7,
    current_admin: dict = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Return an admin-only security/activity report for the selected period."""

    if days <= 0 or days > 90:
        raise HTTPException(
            status_code=400,
            detail="days must be between 1 and 90",
        )

    cutoff = now() - timedelta(days=days)

    logs = (
        db.query(ActivityLog)
        .filter(ActivityLog.created_at >= cutoff)
        .order_by(ActivityLog.created_at.desc())
        .all()
    )

    action_counts = {}
    for log in logs:
        action_counts[log.action] = action_counts.get(log.action, 0) + 1

    security_notifications = (
        db.query(Notification)
        .filter(
            Notification.created_at >= cutoff,
            Notification.notification_type.in_([
                "security",
                "security_alert",
            ]),
        )
        .count()
    )

    downloads = (
        db.query(Download)
        .filter(Download.downloaded_at >= cutoff)
        .count()
    )

    active_users = (
        db.query(User)
        .filter(User.account_status == "active")
        .count()
    )

    return {
        "report_period_days": days,
        "generated_at": now(),
        "summary": {
            "total_activity_events": len(logs),
            "successful_logins": action_counts.get("login", 0),
            "failed_logins": action_counts.get("login_failed", 0),
            "file_uploads": action_counts.get("file_upload", 0),
            "file_downloads": action_counts.get("file_download", 0),
            "file_shares": action_counts.get("file_shared", 0),
            "temporary_links_created": action_counts.get("temporary_link_created", 0),
            "temporary_links_revoked": action_counts.get("temporary_link_revoked", 0),
            "downloads_in_download_table": downloads,
            "security_notifications": security_notifications,
            "active_users": active_users,
        },
        "action_breakdown": action_counts,
        "recent_security_events": [
            {
                "id": str(log.id),
                "user_id": str(log.user_id) if log.user_id else None,
                "action": log.action,
                "details": log.details,
                "ip_address": log.ip_address,
                "created_at": log.created_at,
            }
            for log in logs
            if log.action in {
                "login",
                "login_failed",
                "file_shared",
                "temporary_link_created",
                "temporary_link_revoked",
                "file_download",
                "admin_role_change",
                "admin_user_delete",
            }
        ][:100],
    }


# ============================================================
# MILESTONE 3 - STORAGE ANALYTICS & USAGE MONITORING
# ============================================================

def _format_size(size_bytes: int) -> dict:
    size_bytes = int(size_bytes or 0)

    return {
        "bytes": size_bytes,
        "kb": round(size_bytes / 1024, 2),
        "mb": round(size_bytes / (1024 * 1024), 2),
        "gb": round(size_bytes / (1024 * 1024 * 1024), 4),
    }


@app.get("/storage-analytics")
def get_storage_analytics(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return storage usage for the currently logged-in user."""

    user_id = current_user["user_id"]

    files = (
        db.query(FileModel)
        .filter(
            FileModel.owner_id == user_id,
            FileModel.deleted_at.is_(None),
        )
        .order_by(FileModel.size_bytes.desc())
        .all()
    )

    total_bytes = sum(
        int(file_record.size_bytes or 0)
        for file_record in files
    )

    type_stats = {}
    for file_record in files:
        content_type = file_record.content_type or "unknown"

        if content_type not in type_stats:
            type_stats[content_type] = {
                "file_count": 0,
                "size_bytes": 0,
            }

        type_stats[content_type]["file_count"] += 1
        type_stats[content_type]["size_bytes"] += int(
            file_record.size_bytes or 0
        )

    by_content_type = []
    for content_type, stats in sorted(
        type_stats.items(),
        key=lambda item: item[1]["size_bytes"],
        reverse=True,
    ):
        by_content_type.append({
            "content_type": content_type,
            "file_count": stats["file_count"],
            "size": _format_size(stats["size_bytes"]),
        })

    largest_files = [
        {
            "file_id": str(file_record.id),
            "filename": file_record.original_name,
            "content_type": file_record.content_type,
            "size": _format_size(file_record.size_bytes),
            "created_at": file_record.created_at,
        }
        for file_record in files[:10]
    ]

    return {
        "scope": "current_user",
        "generated_at": now(),
        "summary": {
            "total_files": len(files),
            "total_storage": _format_size(total_bytes),
            "largest_file": largest_files[0] if largest_files else None,
        },
        "by_content_type": by_content_type,
        "largest_files": largest_files,
    }


@app.get("/admin/reports/storage")
def get_storage_usage_report(
    current_admin: dict = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Return an admin-only storage usage report for the whole platform."""

    files = (
        db.query(FileModel)
        .filter(FileModel.deleted_at.is_(None))
        .order_by(FileModel.size_bytes.desc())
        .all()
    )

    total_bytes = sum(
        int(file_record.size_bytes or 0)
        for file_record in files
    )

    deleted_files = (
        db.query(FileModel)
        .filter(FileModel.deleted_at.is_not(None))
        .count()
    )

    folder_count = db.query(Folder).count()
    version_count = db.query(FileVersion).count()
    active_users = (
        db.query(User)
        .filter(User.account_status == "active")
        .count()
    )

    type_stats = {}
    for file_record in files:
        content_type = file_record.content_type or "unknown"

        if content_type not in type_stats:
            type_stats[content_type] = {
                "file_count": 0,
                "size_bytes": 0,
            }

        type_stats[content_type]["file_count"] += 1
        type_stats[content_type]["size_bytes"] += int(
            file_record.size_bytes or 0
        )

    by_content_type = []
    for content_type, stats in sorted(
        type_stats.items(),
        key=lambda item: item[1]["size_bytes"],
        reverse=True,
    ):
        by_content_type.append({
            "content_type": content_type,
            "file_count": stats["file_count"],
            "size": _format_size(stats["size_bytes"]),
        })

    user_usage = (
        db.query(
            User.id,
            User.full_name,
            User.email,
        )
        .filter(User.account_status == "active")
        .all()
    )

    per_user = []
    for user in user_usage:
        user_files = (
            db.query(FileModel)
            .filter(
                FileModel.owner_id == user.id,
                FileModel.deleted_at.is_(None),
            )
            .all()
        )

        user_bytes = sum(
            int(file_record.size_bytes or 0)
            for file_record in user_files
        )

        per_user.append({
            "user_id": str(user.id),
            "name": user.full_name,
            "email": user.email,
            "file_count": len(user_files),
            "storage": _format_size(user_bytes),
        })

    per_user.sort(
        key=lambda item: item["storage"]["bytes"],
        reverse=True,
    )

    return {
        "generated_at": now(),
        "summary": {
            "total_files": len(files),
            "total_storage": _format_size(total_bytes),
            "deleted_files": deleted_files,
            "folders": folder_count,
            "file_versions": version_count,
            "active_users": active_users,
        },
        "by_content_type": by_content_type,
        "top_users_by_storage": per_user[:20],
        "largest_files": [
            {
                "file_id": str(file_record.id),
                "filename": file_record.original_name,
                "owner_id": str(file_record.owner_id),
                "content_type": file_record.content_type,
                "size": _format_size(file_record.size_bytes),
                "created_at": file_record.created_at,
            }
            for file_record in files[:20]
        ],
    }


# ============================================================
# MILESTONE 3 - SUSPICIOUS ACTIVITY DETECTION
# ============================================================

def _detect_suspicious_activity(db: Session, user_id=None, window_minutes: int = 10):
    cutoff = now() - timedelta(minutes=window_minutes)

    query = (
        db.query(ActivityLog)
        .filter(ActivityLog.created_at >= cutoff)
    )

    if user_id is not None:
        query = query.filter(ActivityLog.user_id == user_id)

    logs = query.order_by(ActivityLog.created_at.desc()).all()

    grouped = {}
    for log in logs:
        if not log.user_id:
            continue
        key = str(log.user_id)
        grouped.setdefault(key, []).append(log)

    suspicious = []

    for user_key, user_logs in grouped.items():
        failed_logins = [log for log in user_logs if log.action == "login_failed"]
        downloads = [log for log in user_logs if log.action == "file_download"]
        temp_links = [log for log in user_logs if log.action == "temporary_link_created"]
        login_ips = {log.ip_address for log in user_logs if log.action == "login" and log.ip_address}

        reasons = []

        if len(failed_logins) >= 3:
            reasons.append({
                "type": "multiple_failed_logins",
                "count": len(failed_logins),
                "threshold": 3,
            })

        if len(downloads) >= 10:
            reasons.append({
                "type": "download_spike",
                "count": len(downloads),
                "threshold": 10,
            })

        if len(temp_links) >= 5:
            reasons.append({
                "type": "temporary_link_spike",
                "count": len(temp_links),
                "threshold": 5,
            })

        if len(login_ips) >= 2:
            reasons.append({
                "type": "multiple_login_ips",
                "count": len(login_ips),
                "threshold": 2,
                "ips": sorted(login_ips),
            })

        if reasons:
            suspicious.append({
                "user_id": user_key,
                "window_minutes": window_minutes,
                "reasons": reasons,
                "activity_count": len(user_logs),
                "recent_events": [
                    {
                        "action": log.action,
                        "details": log.details,
                        "ip_address": log.ip_address,
                        "created_at": log.created_at,
                    }
                    for log in user_logs[:20]
                ],
            })

    return suspicious


@app.get("/admin/security/suspicious-activity")
def get_suspicious_activity(
    current_admin: dict = Depends(get_current_admin),
    db: Session = Depends(get_db),
    window_minutes: int = 10,
):
    if window_minutes <= 0:
        raise HTTPException(
            status_code=400,
            detail="window_minutes must be greater than zero",
        )

    suspicious = _detect_suspicious_activity(
        db=db,
        window_minutes=window_minutes,
    )

    # Create an admin-facing security alert only when suspicious activity is found.
    if suspicious:
        admin_user = (
            db.query(User)
            .filter(User.id == current_admin["user_id"])
            .first()
        )

        if admin_user:
            create_security_alert(
                db=db,
                user_id=admin_user.id,
                title="Suspicious activity detected",
                message=(
                    f"TrustShare detected {len(suspicious)} user account(s) "
                    f"with suspicious activity in the last {window_minutes} minutes."
                ),
            )
            db.commit()

    return {
        "window_minutes": window_minutes,
        "suspicious_users_count": len(suspicious),
        "suspicious_users": suspicious,
    }


@app.get("/security/suspicious-activity")
def get_my_suspicious_activity(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
    window_minutes: int = 10,
):
    if window_minutes <= 0:
        raise HTTPException(
            status_code=400,
            detail="window_minutes must be greater than zero",
        )

    suspicious = _detect_suspicious_activity(
        db=db,
        user_id=current_user["user_id"],
        window_minutes=window_minutes,
    )

    return {
        "window_minutes": window_minutes,
        "suspicious": bool(suspicious),
        "results": suspicious,
    }


# ============================================================
# MILESTONE 3 - NOTIFICATIONS & SECURITY ALERTS
# ============================================================

@app.get("/notifications")
def get_notifications(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = current_user["user_id"]

    notifications = (
        db.query(Notification)
        .filter(Notification.user_id == user_id)
        .order_by(Notification.created_at.desc())
        .limit(100)
        .all()
    )

    unread_count = (
        db.query(Notification)
        .filter(
            Notification.user_id == user_id,
            Notification.is_read.is_(False),
        )
        .count()
    )

    return {
        "unread_count": unread_count,
        "notifications": [
            {
                "id": str(notification.id),
                "notification_type": notification.notification_type,
                "title": notification.title,
                "message": notification.message,
                "related_file_id": (
                    str(notification.related_file_id)
                    if notification.related_file_id
                    else None
                ),
                "is_read": notification.is_read,
                "created_at": notification.created_at,
            }
            for notification in notifications
        ],
    }


@app.put("/notifications/{notification_id}/read")
def mark_notification_read(
    notification_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        notification_uuid = uuid.UUID(notification_id)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid notification ID",
        )

    notification = (
        db.query(Notification)
        .filter(
            Notification.id == notification_uuid,
            Notification.user_id == current_user["user_id"],
        )
        .first()
    )

    if not notification:
        raise HTTPException(
            status_code=404,
            detail="Notification not found",
        )

    notification.is_read = True
    db.commit()

    return {
        "message": "Notification marked as read",
        "notification_id": str(notification.id),
    }


@app.put("/notifications/read-all")
def mark_all_notifications_read(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    updated = (
        db.query(Notification)
        .filter(
            Notification.user_id == current_user["user_id"],
            Notification.is_read.is_(False),
        )
        .update(
            {Notification.is_read: True},
            synchronize_session=False,
        )
    )

    db.commit()

    return {
        "message": "All notifications marked as read",
        "updated_count": updated,
    }
