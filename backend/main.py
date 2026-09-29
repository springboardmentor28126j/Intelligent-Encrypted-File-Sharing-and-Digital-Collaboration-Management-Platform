import os
import uuid
import mimetypes

from dotenv import load_dotenv

load_dotenv()

from fastapi import (
    FastAPI,
    Depends,
    Form,
    UploadFile,
    File as FastAPIFile,
    HTTPException,
    Header,
    Request
)

from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

from sqlalchemy.orm import Session
from sqlalchemy import text

from cryptography.exceptions import InvalidTag

from database import Base, engine, get_db
from models import User, File as DBFile, Share

from auth import (
    hash_password,
    verify_password,
    create_access_token,
    verify_token
)

from encryption import (
    generate_data_key,
    wrap_key,
    unwrap_key,
    encrypt_file_bytes,
    decrypt_file_bytes
)

from storage import storage

from sharing import (
    create_share as sharing_create_share,
    get_valid_share,
    check_and_register_access,
    revoke_share as sharing_revoke_share
)


# =========================================================
# CREATE APPLICATION
# =========================================================

app = FastAPI(
    title="TrustShare API",
    description="Secure File Sharing and Collaboration Platform",
    version="2.0"
)


# =========================================================
# CORS
# =========================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:3000",
        "http://127.0.0.1:3000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


# =========================================================
# DATABASE TABLE CREATION
# =========================================================


Base.metadata.create_all(bind=engine)

# Milestone 2 account-to-account sharing:
# add recipient_id to the existing shares table if it is not present.
try:
    with engine.begin() as connection:
        connection.execute(
            text(
                "ALTER TABLE shares "
                "ADD COLUMN IF NOT EXISTS recipient_id INTEGER"
            )
        )
        connection.execute(
            text(
                "CREATE INDEX IF NOT EXISTS idx_shares_recipient_id "
                "ON shares(recipient_id)"
            )
        )
except Exception as schema_error:
    print("Account-sharing schema check:", schema_error)

# =========================================================
# MILESTONE 3 DATABASE TABLES
# Activity monitoring, audit logging, notifications,
# security alerts and analytics.
# =========================================================

try:
    with engine.begin() as connection:
        connection.execute(text("""
            CREATE TABLE IF NOT EXISTS activity_logs (
                id SERIAL PRIMARY KEY,
                user_id INTEGER,
                file_id INTEGER,
                action VARCHAR(100) NOT NULL,
                description TEXT,
                ip_address VARCHAR(100),
                created_at TIMESTAMP DEFAULT NOW()
            )
        """))
        connection.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id
            ON activity_logs(user_id)
        """))
        connection.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at
            ON activity_logs(created_at)
        """))

        connection.execute(text("""
            CREATE TABLE IF NOT EXISTS notifications (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                title VARCHAR(200) NOT NULL,
                message TEXT NOT NULL,
                notification_type VARCHAR(50),
                is_read BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT NOW()
            )
        """))
        connection.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_notifications_user_id
            ON notifications(user_id)
        """))

        connection.execute(text("""
            CREATE TABLE IF NOT EXISTS security_alerts (
                id SERIAL PRIMARY KEY,
                user_id INTEGER,
                alert_type VARCHAR(100) NOT NULL,
                severity VARCHAR(20),
                description TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT NOW(),
                resolved BOOLEAN DEFAULT FALSE
            )
        """))
        connection.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_security_alerts_user_id
            ON security_alerts(user_id)
        """))
        # Existing M3 tables may have been created without defaults.
        connection.execute(text("""
            ALTER TABLE activity_logs
            ALTER COLUMN created_at SET DEFAULT NOW()
        """))
        connection.execute(text("""
            ALTER TABLE notifications
            ALTER COLUMN created_at SET DEFAULT NOW()
        """))
        connection.execute(text("""
            ALTER TABLE security_alerts
            ALTER COLUMN created_at SET DEFAULT NOW()
        """))
except Exception as milestone3_schema_error:
    print("Milestone 3 schema check:", milestone3_schema_error)


# =========================================================
# MILESTONE 3 HELPERS
# =========================================================

def _utc_iso(value):
    """Return database timestamps as explicit UTC ISO-8601 strings."""
    if value is None:
        return None
    from datetime import timezone
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    else:
        value = value.astimezone(timezone.utc)
    return value.isoformat()


def _client_ip(request: Request | None) -> str | None:
    if request is None:
        return None
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


def log_activity(
    db: Session,
    user_id: int | None,
    action: str,
    description: str | None = None,
    file_id: int | None = None,
    ip_address: str | None = None
):
    db.execute(
        text("""
            INSERT INTO activity_logs
                (user_id, file_id, action, description, ip_address)
            VALUES
                (:user_id, :file_id, :action, :description, :ip_address)
        """),
        {
            "user_id": user_id,
            "file_id": file_id,
            "action": action,
            "description": description,
            "ip_address": ip_address
        }
    )


def create_notification(
    db: Session,
    user_id: int,
    title: str,
    message: str,
    notification_type: str = "general"
):
    db.execute(
        text("""
            INSERT INTO notifications
                (user_id, title, message, notification_type)
            VALUES
                (:user_id, :title, :message, :notification_type)
        """),
        {
            "user_id": user_id,
            "title": title,
            "message": message,
            "notification_type": notification_type
        }
    )


def create_security_alert(
    db: Session,
    user_id: int | None,
    alert_type: str,
    severity: str,
    description: str
):
    # Avoid creating the same unresolved alert repeatedly.
    existing = db.execute(
        text("""
            SELECT id
            FROM security_alerts
            WHERE user_id = :user_id
              AND alert_type = :alert_type
              AND resolved = FALSE
              AND created_at >= NOW() - INTERVAL '1 hour'
            LIMIT 1
        """),
        {"user_id": user_id, "alert_type": alert_type}
    ).first()

    if existing:
        return

    db.execute(
        text("""
            INSERT INTO security_alerts
                (user_id, alert_type, severity, description)
            VALUES
                (:user_id, :alert_type, :severity, :description)
        """),
        {
            "user_id": user_id,
            "alert_type": alert_type,
            "severity": severity,
            "description": description
        }
    )


def run_suspicious_activity_checks(
    db: Session,
    user_id: int
):
    # Simple rule-based checks for Milestone 3.
    download_count = db.execute(
        text("""
            SELECT COUNT(*)
            FROM activity_logs
            WHERE user_id = :user_id
              AND action IN ('DOWNLOAD', 'SHARED_DOWNLOAD')
              AND created_at >= NOW() - INTERVAL '1 hour'
        """),
        {"user_id": user_id}
    ).scalar() or 0

    if download_count >= 5:
        create_security_alert(
            db, user_id,
            "EXCESSIVE_DOWNLOADS",
            "HIGH",
            f"{download_count} downloads were recorded within the last hour."
        )

    share_count = db.execute(
        text("""
            SELECT COUNT(*)
            FROM activity_logs
            WHERE user_id = :user_id
              AND action = 'SHARE_CREATED'
              AND created_at >= NOW() - INTERVAL '1 hour'
        """),
        {"user_id": user_id}
    ).scalar() or 0

    if share_count >= 5:
        create_security_alert(
            db, user_id,
            "EXCESSIVE_SHARING",
            "MEDIUM",
            f"{share_count} file shares were created within the last hour."
        )

    failed_logins = db.execute(
        text("""
            SELECT COUNT(*)
            FROM activity_logs
            WHERE user_id = :user_id
              AND action = 'LOGIN_FAILED'
              AND created_at >= NOW() - INTERVAL '15 minutes'
        """),
        {"user_id": user_id}
    ).scalar() or 0

    if failed_logins >= 3:
        create_security_alert(
            db, user_id,
            "MULTIPLE_LOGIN_FAILURES",
            "HIGH",
            f"{failed_logins} failed login attempts were recorded within 15 minutes."
        )



# =========================================================
# SHARED AUTH HELPER
# =========================================================

def get_authenticated_user(
    authorization: str = Header(None)
) -> dict:

    if not authorization:
        raise HTTPException(
            status_code=401,
            detail="Authentication required."
        )

    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="Invalid authorization format."
        )

    token = authorization.split(" ", 1)[1]

    user_data = verify_token(token)

    if not user_data:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token."
        )

    return user_data


# =========================================================
# HOME
# =========================================================

@app.get("/")
def home():

    return {
        "success": True,
        "message": "TrustShare backend is running."
    }


# =========================================================
# HEALTH CHECK
# =========================================================

@app.get("/health")
def health():

    return {
        "success": True,
        "status": "healthy",
        "message": "TrustShare API is working."
    }


# =========================================================
# REGISTER
# =========================================================

@app.post("/register")
def register(
    username: str = Form(...),
    email: str = Form(...),
    password: str = Form(...),
    request: Request = None,
    db: Session = Depends(get_db)
):

    username = username.strip()
    email = email.strip().lower()

    if not username:
        return {
            "success": False,
            "message": "Username is required."
        }

    if not email:
        return {
            "success": False,
            "message": "Email is required."
        }

    # Check existing username.
    # Python username maps to the existing DB column "name".
    existing_username = (
        db.query(User)
        .filter(User.username == username)
        .first()
    )

    if existing_username:
        return {
            "success": False,
            "message": "Username already exists."
        }

    # Check existing email.
    existing_email = (
        db.query(User)
        .filter(User.email == email)
        .first()
    )

    if existing_email:
        return {
            "success": False,
            "message": "Email already registered."
        }

    if len(password) < 6:
        return {
            "success": False,
            "message": "Password must contain at least 6 characters."
        }

    hashed_password = hash_password(password)

    new_user = User(
        username=username,
        email=email,
        password=hashed_password,
        role="USER",
        is_active=True
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    log_activity(
        db, new_user.id, "REGISTER",
        "New TrustShare account registered.",
        ip_address=_client_ip(request)
    )
    db.commit()

    return {
        "success": True,
        "message": "Registration successful.",
        "user_id": new_user.id,
        "username": new_user.username,
        "email": new_user.email
    }


# =========================================================
# LOGIN
# =========================================================

@app.post("/login")
def login(
    email: str = Form(...),
    password: str = Form(...),
    request: Request = None,
    db: Session = Depends(get_db)
):

    email = email.strip().lower()

    user = (
        db.query(User)
        .filter(User.email == email)
        .first()
    )

    if not user:
        return {
            "success": False,
            "message": "Invalid email or password."
        }

    if not user.is_active:
        return {
            "success": False,
            "message": "This account is inactive."
        }

    if not verify_password(password, user.password):
        log_activity(
            db, user.id, "LOGIN_FAILED",
            "Invalid password during login.",
            ip_address=_client_ip(request)
        )
        db.commit()
        run_suspicious_activity_checks(db, user.id)
        db.commit()
        return {
            "success": False,
            "message": "Invalid email or password."
        }

    token = create_access_token(
        user.id,
        user.username,
        user.role
    )

    log_activity(
        db, user.id, "LOGIN_SUCCESS",
        "User logged in successfully.",
        ip_address=_client_ip(request)
    )
    db.commit()

    return {
        "success": True,
        "message": "Login successful.",
        "access_token": token,
        "token_type": "bearer",
        "user_id": user.id,
        "username": user.username,
        "email": user.email,
        "role": user.role
    }


# =========================================================
# RESET PASSWORD
# =========================================================

@app.post("/reset-password")
def reset_password(
    email: str = Form(...),
    new_password: str = Form(...),
    request: Request = None,
    db: Session = Depends(get_db)
):

    email = email.strip().lower()

    user = (
        db.query(User)
        .filter(User.email == email)
        .first()
    )

    if not user:
        return {
            "success": False,
            "message": "No account found with this email address."
        }

    if len(new_password) < 6:
        return {
            "success": False,
            "message": "Password must contain at least 6 characters."
        }

    user.password = hash_password(new_password)

    log_activity(
        db, user.id, "PASSWORD_RESET",
        "Password was reset successfully.",
        ip_address=_client_ip(request)
    )
    db.commit()

    return {
        "success": True,
        "message": "Password reset successfully. You can now login with your new password."
    }


# =========================================================
# CURRENT USER
# =========================================================

@app.get("/me")
def get_current_user(
    user_data: dict = Depends(get_authenticated_user),
    db: Session = Depends(get_db)
):

    user = (
        db.query(User)
        .filter(User.id == user_data["user_id"])
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found."
        )

    return {
        "success": True,
        "user_id": user.id,
        "username": user.username,
        "email": user.email,
        "role": user.role
    }


# =========================================================
# GET USER FILES
# =========================================================

@app.get("/files/{user_id}")
def get_files(
    user_id: int,
    user_data: dict = Depends(get_authenticated_user),
    db: Session = Depends(get_db)
):

    if user_data["user_id"] != user_id:
        raise HTTPException(
            status_code=403,
            detail="Access denied."
        )

    files = (
        db.query(DBFile)
        .filter(
            DBFile.user_id == user_id,
            DBFile.is_deleted == False
        )
        .all()
    )

    return [
        {
            "id": file.id,
            "filename": file.filename,
            "content_type": file.content_type,
            "size": file.size,
            "category": file.category,
            "is_encrypted": file.is_encrypted,
            "created_at": (
                file.created_at.isoformat()
                if file.created_at
                else None
            )
        }
        for file in files
    ]


# =========================================================
# UPLOAD FILE
# Milestone 2: Secure File Encryption
# =========================================================

@app.post("/upload")
async def upload_file(
    user_id: int = Form(...),
    file: UploadFile = FastAPIFile(...),
    request: Request = None,
    user_data: dict = Depends(get_authenticated_user),
    db: Session = Depends(get_db)
):

    if user_data["user_id"] != user_id:
        raise HTTPException(
            status_code=403,
            detail="Access denied."
        )

    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="Please select a file."
        )

    content = await file.read()

    if not content:
        raise HTTPException(
            status_code=400,
            detail="The selected file is empty."
        )

    # =====================================================
    # FILE METADATA
    # =====================================================

    extension = ""

    if "." in file.filename:
        extension = "." + file.filename.rsplit(".", 1)[-1]

    category = (
        file.filename.rsplit(".", 1)[-1].lower()
        if "." in file.filename
        else "other"
    )

    stored_key = str(uuid.uuid4()) + extension

    file_size = len(content)

    # =====================================================
    # ENCRYPTION
    # =====================================================

    # Generate a unique 256-bit key for this file.
    data_key = generate_data_key()

    # Encrypt file using AES-256-GCM.
    ciphertext, nonce_b64 = encrypt_file_bytes(
        content,
        data_key
    )

    # Encrypt/wrap the file key using the master key.
    wrapped_key = wrap_key(data_key)

    # =====================================================
    # STORAGE
    # =====================================================

    location = storage.save(
        stored_key,
        ciphertext
    )

    # =====================================================
    # CONTENT TYPE
    # =====================================================

    content_type = file.content_type

    if (
        not content_type
        or content_type == "application/octet-stream"
    ):
        guessed_type, _ = mimetypes.guess_type(
            file.filename
        )

        content_type = (
            guessed_type
            or "application/octet-stream"
        )

    # =====================================================
    # DATABASE RECORD
    # =====================================================

    new_file = DBFile(
        filename=file.filename,
        stored_filename=location,
        content_type=content_type,
        user_id=user_id,
        size=file_size,
        category=category,
        is_deleted=False,
        is_encrypted=True,
        encryption_key=wrapped_key,
        encryption_nonce=nonce_b64
    )

    db.add(new_file)
    db.commit()
    db.refresh(new_file)

    log_activity(
        db, user_data["user_id"], "UPLOAD",
        f"Uploaded file {new_file.filename}.",
        new_file.id, _client_ip(request)
    )
    create_notification(
        db, user_data["user_id"],
        "File Uploaded",
        f"{new_file.filename} was uploaded and encrypted successfully.",
        "file_uploaded"
    )
    db.commit()

    return {
        "success": True,
        "message": "File uploaded and encrypted successfully.",
        "file_id": new_file.id,
        "filename": new_file.filename,
        "size": new_file.size,
        "category": new_file.category,
        "is_encrypted": new_file.is_encrypted
    }


# =========================================================
# DOWNLOAD FILE
# Milestone 2: Decrypt Before Serving
# =========================================================

@app.get("/download/{file_id}")
def download_file(
    file_id: int,
    request: Request = None,
    user_data: dict = Depends(get_authenticated_user),
    db: Session = Depends(get_db)
):

    file = (
        db.query(DBFile)
        .filter(
            DBFile.id == file_id,
            DBFile.is_deleted == False
        )
        .first()
    )

    if not file:
        raise HTTPException(
            status_code=404,
            detail="File not found."
        )

    if file.user_id != user_data["user_id"]:
        raise HTTPException(
            status_code=403,
            detail="Access denied."
        )

    plaintext = _load_and_decrypt(file)

    log_activity(
        db, user_data["user_id"], "DOWNLOAD",
        f"Downloaded file {file.filename}.",
        file.id, _client_ip(request)
    )
    db.commit()
    run_suspicious_activity_checks(db, user_data["user_id"])
    db.commit()

    return Response(
        content=plaintext,
        media_type=_resolve_content_type(file),
        headers={
            "Content-Disposition":
                f'attachment; filename="{file.filename}"'
        }
    )


# =========================================================
# DELETE FILE
# =========================================================

@app.delete("/files/{file_id}")
def delete_file(
    file_id: int,
    request: Request = None,
    user_data: dict = Depends(get_authenticated_user),
    db: Session = Depends(get_db)
):

    file = (
        db.query(DBFile)
        .filter(
            DBFile.id == file_id,
            DBFile.is_deleted == False
        )
        .first()
    )

    if not file:
        raise HTTPException(
            status_code=404,
            detail="File not found."
        )

    if file.user_id != user_data["user_id"]:
        raise HTTPException(
            status_code=403,
            detail="Access denied."
        )

    # Delete encrypted file from storage.
    storage.delete(file.stored_filename)

    # Delete database record.
    filename_for_log = file.filename
    db.delete(file)
    log_activity(
        db, user_data["user_id"], "DELETE",
        f"Deleted file {filename_for_log}.",
        file_id, _client_ip(request)
    )
    db.commit()

    return {
        "success": True,
        "message": "File deleted successfully."
    }


# =========================================================
# CREATE SHARE LINK
# Milestone 2:
# Secure Sharing + Permission Management
# =========================================================

@app.post("/files/{file_id}/share")
def create_share(
    file_id: int,
    permission: str = Form("download"),
    expires_in_hours: int = Form(24),
    max_downloads: int = Form(None),
    request: Request = None,
    user_data: dict = Depends(get_authenticated_user),
    db: Session = Depends(get_db)
):

    file = (
        db.query(DBFile)
        .filter(
            DBFile.id == file_id,
            DBFile.is_deleted == False
        )
        .first()
    )

    if not file:
        raise HTTPException(
            status_code=404,
            detail="File not found."
        )

    if file.user_id != user_data["user_id"]:
        raise HTTPException(
            status_code=403,
            detail="Access denied."
        )

    share, raw_token = sharing_create_share(
        db=db,
        file=file,
        user_id=user_data["user_id"],
        permission=permission,
        expires_in_hours=expires_in_hours,
        max_downloads=max_downloads
    )

    log_activity(
        db, user_data["user_id"], "SHARE_CREATED",
        f"Created a {permission} share link for {file.filename}.",
        file.id, _client_ip(request)
    )
    db.commit()

    return {
        "success": True,
        "message": "Share link created. Save this token now -- it will not be shown again.",
        "share_id": share.id,
        "share_token": raw_token,
        "share_url": f"/share/{raw_token}",
        "permission": share.permission,
        "expires_at": share.expires_at.isoformat()
    }


# =========================================================
# LIST SHARE LINKS
# Milestone 2: Permission Management
# =========================================================

@app.get("/files/{file_id}/shares")
def list_shares(
    file_id: int,
    user_data: dict = Depends(get_authenticated_user),
    db: Session = Depends(get_db)
):

    file = (
        db.query(DBFile)
        .filter(
            DBFile.id == file_id,
            DBFile.is_deleted == False
        )
        .first()
    )

    if not file:
        raise HTTPException(
            status_code=404,
            detail="File not found."
        )

    if file.user_id != user_data["user_id"]:
        raise HTTPException(
            status_code=403,
            detail="Access denied."
        )

    shares = (
        db.query(Share)
        .filter(Share.file_id == file_id)
        .all()
    )

    return [
        {
            "id": share.id,
            "permission": share.permission,
            "expires_at": share.expires_at.isoformat(),
            "revoked": share.revoked,
            "download_count": share.download_count,
            "max_downloads": share.max_downloads
        }
        for share in shares
    ]


# =========================================================
# REVOKE SHARE LINK
# Milestone 2: Permission Management
# =========================================================

@app.delete("/shares/{share_id}")
def revoke_share(
    share_id: int,
    request: Request = None,
    user_data: dict = Depends(get_authenticated_user),
    db: Session = Depends(get_db)
):

    share = (
        db.query(Share)
        .filter(Share.id == share_id)
        .first()
    )

    if not share:
        raise HTTPException(
            status_code=404,
            detail="Share link not found."
        )

    sharing_revoke_share(
        db=db,
        share=share,
        user_id=user_data["user_id"]
    )

    log_activity(
        db, user_data["user_id"], "SHARE_REVOKED",
        f"Revoked share {share_id}.",
        share.file_id, _client_ip(request)
    )
    db.commit()

    return {
        "success": True,
        "message": "Share link revoked."
    }



# =========================================================
# ACCOUNT-TO-ACCOUNT SHARING
# Milestone 2: Share directly with another TrustShare user
# =========================================================

@app.post("/files/{file_id}/share-account")
def share_file_with_account(
    file_id: int,
    recipient: str = Form(...),
    permission: str = Form("view"),
    expires_in_hours: int = Form(24),
    max_downloads: int = Form(None),
    request: Request = None,
    user_data: dict = Depends(get_authenticated_user),
    db: Session = Depends(get_db)
):
    recipient = recipient.strip()

    if not recipient:
        raise HTTPException(
            status_code=400,
            detail="Recipient email or username is required."
        )

    if permission not in ("view", "download"):
        raise HTTPException(
            status_code=400,
            detail="Permission must be view or download."
        )

    if expires_in_hours <= 0:
        raise HTTPException(
            status_code=400,
            detail="Expiry must be greater than 0 hours."
        )

    if max_downloads is not None and max_downloads <= 0:
        raise HTTPException(
            status_code=400,
            detail="Maximum downloads must be greater than 0."
        )

    file = (
        db.query(DBFile)
        .filter(
            DBFile.id == file_id,
            DBFile.is_deleted == False
        )
        .first()
    )

    if not file:
        raise HTTPException(
            status_code=404,
            detail="File not found."
        )

    if file.user_id != user_data["user_id"]:
        raise HTTPException(
            status_code=403,
            detail="Access denied."
        )

    sender = (
        db.query(User)
        .filter(User.id == user_data["user_id"])
        .first()
    )

    recipient_user = (
        db.query(User)
        .filter(
            (User.email == recipient.lower()) |
            (User.username == recipient)
        )
        .first()
    )

    if not recipient_user:
        raise HTTPException(
            status_code=404,
            detail="TrustShare account not found."
        )

    if recipient_user.id == sender.id:
        raise HTTPException(
            status_code=400,
            detail="You cannot share a file with yourself."
        )

    # Reuse the existing secure share creation logic for token,
    # permission, expiry and download-limit handling.
    share, raw_token = sharing_create_share(
        db=db,
        file=file,
        user_id=user_data["user_id"],
        permission=permission,
        expires_in_hours=expires_in_hours,
        max_downloads=max_downloads
    )

    # Store the recipient account directly on the share record.
    db.execute(
        text(
            "UPDATE shares "
            "SET recipient_id = :recipient_id "
            "WHERE id = :share_id"
        ),
        {
            "recipient_id": recipient_user.id,
            "share_id": share.id
        }
    )
    log_activity(
        db, user_data["user_id"], "SHARE_CREATED",
        f"Shared {file.filename} with {recipient_user.username} ({permission}).",
        file.id, _client_ip(request)
    )
    create_notification(
        db, recipient_user.id,
        "New File Shared",
        f"{sender.username} shared {file.filename} with you. Permission: {permission}.",
        "file_shared"
    )
    db.commit()
    db.refresh(share)

    return {
        "success": True,
        "message": f"File shared successfully with {recipient_user.username}.",
        "share_id": share.id,
        "recipient_id": recipient_user.id,
        "recipient_username": recipient_user.username,
        "recipient_email": recipient_user.email,
        "permission": share.permission,
        "expires_at": (
            _utc_iso(share.expires_at)
        ),
        # The raw token is deliberately not needed by the frontend.
        # The recipient accesses the file from Shared With Me.
    }


@app.get("/shared-with-me")
def get_shared_with_me(
    user_data: dict = Depends(get_authenticated_user),
    db: Session = Depends(get_db)
):
    current_user_id = user_data["user_id"]

    rows = db.execute(
        text(
            """
            SELECT
                s.id AS share_id,
                s.permission,
                s.expires_at,
                s.max_downloads,
                s.download_count,
                s.revoked,
                s.created_at,
                f.id AS file_id,
                f.filename,
                f.content_type,
                f.size,
                f.category,
                f.created_at AS file_created_at,
                u.id AS owner_id,
                u.name AS owner_username,
                u.email AS owner_email
            FROM shares s
            JOIN files f ON f.id = s.file_id
            JOIN users u ON u.id = s.created_by
            WHERE s.recipient_id = :user_id
              AND f.is_deleted = FALSE
            ORDER BY s.created_at DESC
            """
        ),
        {"user_id": current_user_id}
    ).mappings().all()

    return [
        {
            "share_id": row["share_id"],
            "file_id": row["file_id"],
            "filename": row["filename"],
            "content_type": row["content_type"],
            "size": row["size"],
            "category": row["category"],
            "permission": row["permission"],
            "expires_at": (
                row["expires_at"].isoformat()
                if row["expires_at"]
                else None
            ),
            "max_downloads": row["max_downloads"],
            "download_count": row["download_count"],
            "revoked": row["revoked"],
            "created_at": (
                row["created_at"].isoformat()
                if row["created_at"]
                else None
            ),
            "owner": {
                "user_id": row["owner_id"],
                "username": row["owner_username"],
                "email": row["owner_email"],
            }
        }
        for row in rows
    ]


@app.get("/shared-with-me/{share_id}")
def access_account_shared_file(
    share_id: int,
    request: Request = None,
    user_data: dict = Depends(get_authenticated_user),
    db: Session = Depends(get_db)
):
    row = db.execute(
        text(
            """
            SELECT id, file_id, permission, expires_at,
                   max_downloads, download_count, revoked,
                   recipient_id, created_by
            FROM shares
            WHERE id = :share_id
              AND recipient_id = :recipient_id
            """
        ),
        {
            "share_id": share_id,
            "recipient_id": user_data["user_id"]
        }
    ).mappings().first()

    if not row:
        raise HTTPException(
            status_code=404,
            detail="Shared file not found."
        )

    if row["revoked"]:
        raise HTTPException(
            status_code=403,
            detail="This share has been revoked."
        )

    if row["expires_at"] is not None:
        from datetime import datetime, timezone
        expires_at = row["expires_at"]
        now = datetime.now(timezone.utc)
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)

        if expires_at <= now:
            raise HTTPException(
                status_code=403,
                detail="This shared access has expired."
            )

    if (
        row["max_downloads"] is not None
        and row["download_count"] >= row["max_downloads"]
    ):
        raise HTTPException(
            status_code=403,
            detail="The maximum download limit has been reached."
        )

    file = (
        db.query(DBFile)
        .filter(
            DBFile.id == row["file_id"],
            DBFile.is_deleted == False
        )
        .first()
    )

    if not file:
        raise HTTPException(
            status_code=404,
            detail="The shared file no longer exists."
        )

    # Decrypt first. The download counter is updated only after
    # the encrypted file has been successfully recovered.
    plaintext = _load_and_decrypt(file)

    access_action = (
        "SHARED_DOWNLOAD"
        if row["permission"] == "download"
        else "VIEW"
    )

    if row["permission"] == "download":
        db.execute(
            text(
                """
                UPDATE shares
                SET download_count = download_count + 1
                WHERE id = :share_id
                """
            ),
            {"share_id": share_id}
        )

    log_activity(
        db,
        user_data["user_id"],
        access_action,
        f"Accessed shared file {file.filename}.",
        file.id,
        _client_ip(request)
    )

    # Notification is useful for Milestone 3, but a notification
    # failure must never prevent the recipient from downloading
    # the already-decrypted file.
    try:
        access_word = (
            "downloaded"
            if row["permission"] == "download"
            else "viewed"
        )

        create_notification(
            db,
            row["created_by"],
            "Shared File Accessed",
            f"{file.filename} was {access_word} by a shared recipient.",
            "file_accessed"
        )
    except Exception as notification_error:
        print("Shared-file notification error:", notification_error)

    try:
        run_suspicious_activity_checks(
            db,
            user_data["user_id"]
        )
    except Exception as security_error:
        print("Security check error:", security_error)

    db.commit()

    disposition = (
        "attachment"
        if row["permission"] == "download"
        else "inline"
    )

    return Response(
        content=plaintext,
        media_type=_resolve_content_type(file),
        headers={
            "Content-Disposition":
                f'{disposition}; filename="{file.filename}"'
        }
    )


@app.delete("/shared-with-me/{share_id}")
def remove_shared_access(
    share_id: int,
    request: Request = None,
    user_data: dict = Depends(get_authenticated_user),
    db: Session = Depends(get_db)
):
    result = db.execute(
        text(
            """
            DELETE FROM shares
            WHERE id = :share_id
              AND recipient_id = :recipient_id
            """
        ),
        {
            "share_id": share_id,
            "recipient_id": user_data["user_id"]
        }
    )

    db.commit()

    if result.rowcount == 0:
        raise HTTPException(
            status_code=404,
            detail="Shared access not found."
        )

    log_activity(
        db, user_data["user_id"], "SHARED_ACCESS_REMOVED",
        f"Removed shared access {share_id} from Shared With Me.",
        None, _client_ip(request)
    )
    db.commit()

    return {
        "success": True,
        "message": "Shared file removed from your list."
    }



# =========================================================
# SENT FILES
# =========================================================

@app.get("/sent-files")
def get_sent_files(
    user_data: dict = Depends(get_authenticated_user),
    db: Session = Depends(get_db)
):
    """Return files the logged-in TrustShare user shared with other accounts."""
    current_user_id = user_data["user_id"]

    rows = db.execute(
        text("""
            SELECT
                s.id AS share_id,
                s.file_id,
                s.permission,
                s.expires_at,
                s.max_downloads,
                s.download_count,
                s.revoked,
                s.created_at,
                f.filename,
                f.content_type,
                f.size,
                f.category,
                r.id AS recipient_id,
                r.name AS recipient_username,
                r.email AS recipient_email
            FROM shares s
            JOIN files f ON f.id = s.file_id
            JOIN users r ON r.id = s.recipient_id
            WHERE s.created_by = :user_id
              AND s.recipient_id IS NOT NULL
              AND COALESCE(f.is_deleted, FALSE) = FALSE
            ORDER BY s.created_at DESC
        """),
        {"user_id": current_user_id}
    ).mappings().all()

    return [
        {
            "share_id": row["share_id"],
            "file_id": row["file_id"],
            "filename": row["filename"],
            "content_type": row["content_type"],
            "size": row["size"],
            "category": row["category"],
            "permission": row["permission"],
            "expires_at": _utc_iso(row["expires_at"]),
            "max_downloads": row["max_downloads"],
            "download_count": row["download_count"],
            "revoked": bool(row["revoked"]),
            "created_at": _utc_iso(row["created_at"]),
            "recipient": {
                "id": row["recipient_id"],
                "username": row["recipient_username"],
                "email": row["recipient_email"]
            }
        }
        for row in rows
    ]


# =========================================================
# MILESTONE 3 APIs
# =========================================================

@app.get("/activity")
def get_activity(
    limit: int = 50,
    user_data: dict = Depends(get_authenticated_user),
    db: Session = Depends(get_db)
):
    limit = max(1, min(limit, 200))
    rows = db.execute(
        text("""
            SELECT
                a.id, a.action, a.description, a.ip_address, a.created_at,
                a.file_id, f.filename
            FROM activity_logs a
            LEFT JOIN files f ON f.id = a.file_id
            WHERE a.user_id = :user_id
            ORDER BY a.created_at DESC
            LIMIT :limit
        """),
        {"user_id": user_data["user_id"], "limit": limit}
    ).mappings().all()

    return [
        {
            "id": row["id"],
            "action": row["action"],
            "description": row["description"],
            "ip_address": row["ip_address"],
            "file_id": row["file_id"],
            "filename": row["filename"],
            "created_at": _utc_iso(row["created_at"])
        }
        for row in rows
    ]


@app.get("/notifications")
def get_notifications(
    user_data: dict = Depends(get_authenticated_user),
    db: Session = Depends(get_db)
):
    rows = db.execute(
        text("""
            SELECT id, title, message, notification_type, is_read, created_at
            FROM notifications
            WHERE user_id = :user_id
            ORDER BY created_at DESC
            LIMIT 100
        """),
        {"user_id": user_data["user_id"]}
    ).mappings().all()

    return [
        {
            "id": row["id"],
            "title": row["title"],
            "message": row["message"],
            "notification_type": row["notification_type"],
            "is_read": row["is_read"],
            "created_at": _utc_iso(row["created_at"])
        }
        for row in rows
    ]


@app.put("/notifications/{notification_id}/read")
def mark_notification_read(
    notification_id: int,
    user_data: dict = Depends(get_authenticated_user),
    db: Session = Depends(get_db)
):
    result = db.execute(
        text("""
            UPDATE notifications
            SET is_read = TRUE
            WHERE id = :notification_id
              AND user_id = :user_id
        """),
        {"notification_id": notification_id, "user_id": user_data["user_id"]}
    )
    db.commit()

    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Notification not found.")

    return {"success": True, "message": "Notification marked as read."}


@app.put("/notifications/read-all")
def mark_all_notifications_read(
    user_data: dict = Depends(get_authenticated_user),
    db: Session = Depends(get_db)
):
    db.execute(
        text("""
            UPDATE notifications
            SET is_read = TRUE
            WHERE user_id = :user_id
              AND is_read = FALSE
        """),
        {"user_id": user_data["user_id"]}
    )
    db.commit()
    return {"success": True, "message": "All notifications marked as read."}


@app.get("/security-alerts")
def get_security_alerts(
    user_data: dict = Depends(get_authenticated_user),
    db: Session = Depends(get_db)
):
    """Return current unresolved security alerts for the logged-in user.

    Suspicious-activity checks are triggered by the relevant account/file
    events themselves (for example failed login, download and share).
    Loading or refreshing this page only reads alerts; it does not create
    another alert. There is intentionally no resolve endpoint because
    resolving an alert can immediately satisfy the detection rule again
    and create a new alert.
    """
    rows = db.execute(
        text("""
            SELECT id, alert_type, severity, description, created_at
            FROM security_alerts
            WHERE user_id = :user_id
              AND resolved = FALSE
            ORDER BY created_at DESC
            LIMIT 100
        """),
        {"user_id": user_data["user_id"]}
    ).mappings().all()

    return [
        {
            "id": row["id"],
            "alert_type": row["alert_type"],
            "severity": row["severity"],
            "description": row["description"],
            "created_at": _utc_iso(row["created_at"]),
            "resolved": False
        }
        for row in rows
    ]


@app.get("/analytics")
def get_analytics(
    user_data: dict = Depends(get_authenticated_user),
    db: Session = Depends(get_db)
):
    """Return live Milestone 3 statistics for the logged-in user.

    File access statistics are based on the user's files, so downloads/views
    performed by a recipient are also reflected in the owner's dashboard.
    """
    user_id = user_data["user_id"]

    # Count unique active files visible to the user.
    # A file shared more than once must still count as ONE file.
    total_files = db.execute(
        text("""
            SELECT COUNT(*)
            FROM (
                SELECT f.id
                FROM files f
                WHERE f.owner_id = :user_id
                  AND f.is_deleted = FALSE

                UNION

                SELECT s.file_id
                FROM shares s
                JOIN files f2 ON f2.id = s.file_id
                WHERE s.recipient_id = :user_id
                  AND s.revoked = FALSE
                  AND f2.is_deleted = FALSE
                  AND (s.expires_at IS NULL OR s.expires_at > NOW())
            ) visible_files
        """),
        {"user_id": user_id}
    ).scalar() or 0

    # Count unique files that the user has shared directly with another
    # TrustShare account. This is a historical sharing metric, so an expired
    # temporary share is still counted as a file that was shared.
    # Public-link shares are excluded by requiring recipient_id.
    total_shared = db.execute(
        text("""
            SELECT COUNT(DISTINCT s.file_id)
            FROM shares s
            JOIN files f ON f.id = s.file_id
            WHERE s.created_by = :user_id
              AND s.recipient_id IS NOT NULL
              AND f.is_deleted = FALSE
        """),
        {"user_id": user_id}
    ).scalar() or 0

    total_downloads = db.execute(
        text("""
            SELECT COUNT(*)
            FROM activity_logs a
            LEFT JOIN files f ON f.id = a.file_id
            WHERE (
                    a.user_id = :user_id
                    OR f.owner_id = :user_id
                  )
              AND a.action IN ('DOWNLOAD', 'SHARED_DOWNLOAD')
        """),
        {"user_id": user_id}
    ).scalar() or 0

    total_views = db.execute(
        text("""
            SELECT COUNT(*)
            FROM activity_logs a
            LEFT JOIN files f ON f.id = a.file_id
            WHERE (
                    a.user_id = :user_id
                    OR f.owner_id = :user_id
                  )
              AND a.action = 'VIEW'
        """),
        {"user_id": user_id}
    ).scalar() or 0

    unread_notifications = db.execute(
        text("""
            SELECT COUNT(*)
            FROM notifications
            WHERE user_id = :user_id
              AND is_read = FALSE
        """),
        {"user_id": user_id}
    ).scalar() or 0

    active_alerts = db.execute(
        text("""
            SELECT COUNT(*)
            FROM security_alerts
            WHERE user_id = :user_id
              AND resolved = FALSE
        """),
        {"user_id": user_id}
    ).scalar() or 0

    storage_bytes = db.execute(
        text("""
            SELECT COALESCE(SUM(size), 0)
            FROM files
            WHERE owner_id = :user_id
              AND is_deleted = FALSE
        """),
        {"user_id": user_id}
    ).scalar() or 0

    return {
        "total_files": int(total_files),
        "total_shared": int(total_shared),
        "total_downloads": int(total_downloads),
        "total_views": int(total_views),
        "unread_notifications": int(unread_notifications),
        "security_alerts": int(active_alerts),
        "storage_bytes": int(storage_bytes)
    }


@app.get("/security-check")
def security_check(
    user_data: dict = Depends(get_authenticated_user),
    db: Session = Depends(get_db)
):
    run_suspicious_activity_checks(db, user_data["user_id"])
    db.commit()
    alert_count = db.execute(
        text("""
            SELECT COUNT(*) FROM security_alerts
            WHERE user_id = :user_id AND resolved = FALSE
        """),
        {"user_id": user_data["user_id"]}
    ).scalar() or 0

    return {
        "success": True,
        "security_alerts": alert_count,
        "status": "attention_required" if alert_count else "normal"
    }


# =========================================================
# ACCESS SHARED FILE
# Milestone 2: Temporary Access
#
# This endpoint does NOT require login.
# The share token acts as the access credential.
# =========================================================

@app.get("/share/{token}")
def access_shared_file(
    token: str,
    request: Request = None,
    db: Session = Depends(get_db)
):

    # Validate:
    # - token
    # - expiration
    # - revocation
    share = get_valid_share(
        db,
        token
    )

    file = (
        db.query(DBFile)
        .filter(
            DBFile.id == share.file_id,
            DBFile.is_deleted == False
        )
        .first()
    )

    if not file:
        raise HTTPException(
            status_code=404,
            detail="The shared file no longer exists."
        )

    # Check maximum download limit.
    check_and_register_access(
        db,
        share
    )

    # Decrypt before serving.
    plaintext = _load_and_decrypt(file)

    log_activity(
        db, None,
        "SHARED_LINK_ACCESS",
        f"Accessed shared link for {file.filename}.",
        file.id, _client_ip(request)
    )
    db.commit()


    disposition = (
        "attachment"
        if share.permission == "download"
        else "inline"
    )

    return Response(
        content=plaintext,
        media_type=_resolve_content_type(file),
        headers={
            "Content-Disposition":
                f'{disposition}; filename="{file.filename}"'
        }
    )


# =========================================================
# LOAD + DECRYPT FILE
# =========================================================

def _load_and_decrypt(
    file: DBFile
) -> bytes:

    try:
        ciphertext = storage.load(
            file.stored_filename
        )

    except Exception:
        raise HTTPException(
            status_code=404,
            detail="Stored file could not be found."
        )

    # Backward compatibility for files uploaded before
    # Milestone 2 encryption was enabled.
    if not file.is_encrypted:
        return ciphertext

    if (
        not file.encryption_key
        or not file.encryption_nonce
    ):
        raise HTTPException(
            status_code=500,
            detail="Encryption metadata is missing."
        )

    try:

        data_key = unwrap_key(
            file.encryption_key
        )

        return decrypt_file_bytes(
            ciphertext,
            data_key,
            file.encryption_nonce
        )

    except InvalidTag:

        raise HTTPException(
            status_code=500,
            detail="File integrity check failed. The stored file may have been corrupted or tampered with."
        )

    except Exception:

        raise HTTPException(
            status_code=500,
            detail="Unable to decrypt the file."
        )


# =========================================================
# RESOLVE FILE CONTENT TYPE
# =========================================================

def _resolve_content_type(
    file: DBFile
) -> str:

    if file.content_type:
        return file.content_type

    guessed_type, _ = mimetypes.guess_type(
        file.filename
    )

    return guessed_type or "application/octet-stream"
