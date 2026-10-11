from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

import secrets
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from encryption import (
    generate_key,
    encrypt_file,
    save_key,
    load_key,
    decrypt_file,
    safe_filename
)
from storage import (
    upload_encrypted_file,
    download_encrypted_file,
    delete_encrypted_file
)

from fastapi.responses import StreamingResponse
from io import BytesIO
from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from pydantic import BaseModel
class ShareRequest(BaseModel):
    filename: str
    recipient_email: str
    permission: str = "read"


import os
from encryption import generate_key, encrypt_file, save_key, load_key, decrypt_file

from database.connection import engine, Base
from models.user import User
from models.file import File as FileModel
from models.file_share import FileShare
from models.activity_log import ActivityLog
from models.notification import Notification
from notification_logger import create_notification

from activity_logger import log_activity


from routes.test_route import router
from routes.auth import router as auth_router
from routes.share import router as share_router
from routes.activity import router as activity_router
from routes.security import router as security_router
from routes.notifications import router as notifications_router
from routes.analytics import router as analytics_router
from routes.ai_security import router as ai_security_router

from auth_utils import verify_access_token


# =========================
# CREATE APP
# =========================

app = FastAPI()


# =========================
# DATABASE
# =========================

Base.metadata.create_all(bind=engine)


# =========================
# CORS
# =========================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:8080",
    "https://trustshare-frontend.onrender.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================
# ROUTERS
# =========================

app.include_router(router)
app.include_router(auth_router)
app.include_router(share_router)
app.include_router(activity_router)
app.include_router(security_router)
app.include_router(notifications_router)
app.include_router(analytics_router)
app.include_router(ai_security_router)


# =========================
# SECURITY
# =========================

security = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    token = credentials.credentials

    payload = verify_access_token(token)

    if not payload:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token"
        )

    user_id = payload.get("user_id")
    email = payload.get("email")

    if not user_id or not email:
        raise HTTPException(
            status_code=401,
            detail="Invalid user token"
        )

    return {
        "user_id": user_id,
        "email": email
    }


# =========================
# ROOT
# =========================

@app.get("/")
def root():
    return {
        "message": "TrustShare Backend is running"
    }



# =========================
# UPLOAD FILE
# =========================

@app.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    try:
        filename = safe_filename(file.filename)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid filename"
        )

    # =========================
    # READ FILE
    # =========================

    content = await file.read()

    # =========================
    # GENERATE AES-256 KEY
    # =========================

    key = generate_key()

    # =========================
    # ENCRYPT FILE
    # =========================

    nonce, encrypted_data = encrypt_file(
        content,
        key
    )

    # =========================
    # PREPARE ENCRYPTED DATA
    # =========================
    # Store nonce first, followed by encrypted content

    encrypted_storage_data = nonce + encrypted_data

    # =========================
    # UPLOAD ENCRYPTED FILE
    # TO SUPABASE STORAGE
    # =========================

    storage_path = filename + ".enc"

    try:
        upload_encrypted_file(
            storage_path,
            encrypted_storage_data
        )

    except Exception as e:
        print("Supabase upload error:", e)

        raise HTTPException(
            status_code=500,
            detail=f"Supabase upload error: {str(e)}"
        )

    # =========================
    # SAVE ENCRYPTION KEY
    # =========================

    save_key(filename, key)

    # =========================
    # SAVE FILE RECORD
    # IN DATABASE
    # =========================

    db = Session(bind=engine)

    try:

        existing_file = db.query(FileModel).filter(
            FileModel.filename == filename,
            FileModel.owner_id == current_user["user_id"]
        ).first()

        if not existing_file:

            new_file = FileModel(
                filename=filename,
                owner_id=current_user["user_id"],
                stored_name=storage_path,
                owner_email=current_user["email"],
                file_size=len(content),
                is_encrypted=True
            )

            db.add(new_file)
            db.commit()
            log_activity(
                action="FILE_UPLOADED",
                user_id=current_user["user_id"],
                user_email=current_user["email"],
                filename=file.filename,
                details="File uploaded and encrypted successfully"
            )
    

    finally:
        db.close()

    # =========================
    # RESPONSE
    # =========================

    return {
        "message": "File uploaded, encrypted, and stored securely in Supabase",
        "filename": filename,
        "encrypted_file": storage_path
    }

# =========================
# GET FILES
# =========================

@app.get("/files")
def get_files(
    current_user: dict = Depends(get_current_user)
):
    db = Session(bind=engine)

    files = db.query(FileModel).filter(
        FileModel.owner_id == current_user["user_id"]
    ).all()

    db.close()

    return {
        "files": [
            file.filename
            for file in files
        ]
    }




# =========================
# DOWNLOAD / DECRYPT FILE
# =========================
@app.get("/download/{filename}")
def download_file(
    filename: str,
    current_user: dict = Depends(get_current_user)
):
    try:
        filename = safe_filename(filename)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid filename"
        )

    db = Session(bind=engine)

    try:
        # =========================
        # CHECK FILE ACCESS
        # =========================

        file_record = db.query(FileModel).filter(
            FileModel.filename == filename,
            FileModel.owner_id == current_user["user_id"]
        ).first()

        # Owner has full access
        if file_record:
            has_access = True

        else:
            # Check shared access
            shared_file = db.query(FileShare).filter(
                FileShare.filename == filename,
                FileShare.recipient_email == current_user["email"],
                FileShare.permission.in_(
                    ["read", "read_write"]
                )
            ).first()

            has_access = shared_file is not None

        # Deny unauthorized access
        if not has_access:
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to download this file"
            )

        # =========================
        # DOWNLOAD ENCRYPTED FILE
        # FROM SUPABASE
        # =========================

        storage_path = filename + ".enc"

        try:
            encrypted_storage_data = download_encrypted_file(
                storage_path
            )

        except Exception as e:
            print("Supabase download error:", e)

            raise HTTPException(
                status_code=404,
                detail="Encrypted file not found in secure storage"
            )

        # =========================
        # SEPARATE NONCE
        # =========================

        if len(encrypted_storage_data) < 13:
            raise HTTPException(
                status_code=500,
                detail="Invalid encrypted file"
            )

        nonce = encrypted_storage_data[:12]
        encrypted_data = encrypted_storage_data[12:]

        # =========================
        # LOAD ENCRYPTION KEY
        # =========================

        try:
            key = load_key(filename)

        except FileNotFoundError:
            raise HTTPException(
                status_code=404,
                detail="Encryption key not found"
            )

        # =========================
        # DECRYPT IN MEMORY
        # =========================

        try:
            decrypted_data = decrypt_file(
                encrypted_data,
                key,
                nonce
            )

        except Exception as e:
            print("Decryption error:", e)

            raise HTTPException(
                status_code=500,
                detail="File decryption failed"
            )

        # =========================
        # SEND ORIGINAL FILE
        # =========================
        log_activity(
            action="FILE_DOWNLOADED",
            user_id=current_user["user_id"],
            user_email=current_user["email"],
            filename=filename,
            details="File downloaded successfully"
        )

        return StreamingResponse(
            BytesIO(decrypted_data),
            media_type="application/octet-stream",
            headers={
                "Content-Disposition":
                    f'attachment; filename="{filename}"'
            }
        )

    finally:
        db.close()


@app.get("/download/shared/{token}")
def download_shared_file(token: str):
    db = Session(bind=engine)

    try:
        # Find the share using the secure token
        shared_file = db.query(FileShare).filter(
            FileShare.share_token == token
        ).first()

        if not shared_file:
            raise HTTPException(
                status_code=404,
                detail="Invalid or expired share link"
            )

        # Check expiration
        if (
            shared_file.expires_at is not None
            and datetime.now(ZoneInfo("Asia/Kolkata")).replace(tzinfo=None)
            > shared_file.expires_at
        ):
            raise HTTPException(
                status_code=403,
                detail="This share link has expired"
            )

        filename = shared_file.filename

        # Download encrypted file from Supabase
        storage_path = filename + ".enc"

        try:
            encrypted_storage_data = download_encrypted_file(
                storage_path
            )
        except Exception as e:
            print("Supabase download error:", e)
            raise HTTPException(
                status_code=404,
                detail="Encrypted file not found in secure storage"
            )

        # Validate encrypted data
        if len(encrypted_storage_data) < 13:
            raise HTTPException(
                status_code=500,
                detail="Invalid encrypted file"
            )

        # Extract nonce and encrypted data
        nonce = encrypted_storage_data[:12]
        encrypted_data = encrypted_storage_data[12:]

        # Load encryption key
        try:
            key = load_key(filename)
        except FileNotFoundError:
            raise HTTPException(
                status_code=404,
                detail="Encryption key not found"
            )

        # Decrypt in memory
        try:
            decrypted_data = decrypt_file(
                encrypted_data,
                key,
                nonce
            )
        except Exception as e:
            print("Decryption error:", e)
            raise HTTPException(
                status_code=500,
                detail="File decryption failed"
            )

        log_activity(
            action="TEMPORARY_LINK_DOWNLOADED",
            user_id=None,
            user_email=shared_file.recipient_email,
            filename=shared_file.filename,
            details="Temporary link used successfully"
        )

        # Return decrypted file directly
        return StreamingResponse(
            BytesIO(decrypted_data),
            media_type="application/octet-stream",
            headers={
                "Content-Disposition":
                    f'attachment; filename="{filename}"'
            }
        )

    finally:
        db.close()

@app.delete("/share/{share_id}")
def revoke_share(
    share_id: int,
    current_user: dict = Depends(get_current_user)
):
    db = Session(bind=engine)

    try:
        # Find the share
        shared_file = db.query(FileShare).filter(
            FileShare.id == share_id
        ).first()

        if not shared_file:
            raise HTTPException(
                status_code=404,
                detail="Share not found"
            )

        # Only the person who created the share can revoke it
        if shared_file.sender_id != current_user["user_id"]:
            raise HTTPException(
                status_code=403,
                detail="You can only revoke your own shared links"
            )

        db.delete(shared_file)
        db.commit()

        return {
            "message": "Share revoked successfully",
            "share_id": share_id
        }

    finally:
        db.close()
# =========================
# DELETE FILE
# =========================
@app.delete("/delete/{filename}")
def delete_file(
    filename: str,
    current_user: dict = Depends(get_current_user)
):
    try:
        filename = safe_filename(filename)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid filename"
        )

    db = Session(bind=engine)

    try:
        # =========================
        # CHECK FILE OWNERSHIP
        # =========================

        file_record = db.query(FileModel).filter(
            FileModel.filename == filename,
            FileModel.owner_id == current_user["user_id"]
        ).first()

        if not file_record:
            raise HTTPException(
                status_code=404,
                detail="File not found or you are not the owner"
            )

        # =========================
        # DELETE ENCRYPTED FILE
        # FROM SUPABASE
        # =========================

        storage_path = filename + ".enc"

        try:
            delete_encrypted_file(storage_path)

        except Exception as e:
            print("Supabase delete error:", e)

            raise HTTPException(
                status_code=500,
                detail="Failed to delete encrypted file from secure storage"
            )

        # =========================
        # DELETE ENCRYPTION KEY
        # =========================

        key_file_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            "keys",
            filename + ".key"
        )

        if os.path.isfile(key_file_path):
            os.remove(key_file_path)

        # =========================
        # DELETE SHARING RECORDS
        # =========================

        db.query(FileShare).filter(
            FileShare.filename == filename,
            FileShare.sender_id == current_user["user_id"]
        ).delete(
            synchronize_session=False
        )

        # =========================
        # DELETE DATABASE RECORD
        # =========================

        db.delete(file_record)

        db.commit()
        log_activity(
            action="FILE_DELETED",
            user_id=current_user["user_id"],
            user_email=current_user["email"],
            filename=filename,
            details="File deleted successfully"
        )

        return {
            "message": "File deleted successfully",
            "filename": filename
        }

    finally:
        db.close()

@app.post("/share")
def share_file(
    request: ShareRequest,
    current_user: dict = Depends(get_current_user)
):
    filename = request.filename
    recipient_email = request.recipient_email
    permission = request.permission

    # Validate permission
    if permission not in ["read", "write", "read_write"]:
        raise HTTPException(
            status_code=400,
            detail="Invalid permission. Use read, write, or read_write."
        )

    db = Session(bind=engine)

    try:
        # Check that current user owns the file
        file_record = db.query(FileModel).filter(
            FileModel.filename == filename,
            FileModel.owner_id == current_user["user_id"]
        ).first()

        if not file_record:
            raise HTTPException(
                status_code=404,
                detail="File not found or you are not the owner"
            )

        # Check encrypted file exists
        encrypted_file_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            "uploads",
            filename + ".enc"
        )

        if not os.path.isfile(encrypted_file_path):
            raise HTTPException(
                status_code=404,
                detail="Encrypted file not found"
            )

        # Check existing share
        existing_share = db.query(FileShare).filter(
            FileShare.filename == filename,
            FileShare.sender_id == current_user["user_id"],
            FileShare.recipient_email == recipient_email
        ).first()

        if existing_share:
            existing_share.permission = permission
            db.commit()

            return {
                "message": "File sharing permission updated",
                "filename": filename,
                "recipient_email": recipient_email,
                "permission": permission
            }

        # Create new share
        new_share = FileShare(
            filename=filename,
            sender_id=current_user["user_id"],
            recipient_email=recipient_email,
            permission=permission
        )

        db.add(new_share)
        db.commit()
        db.refresh(new_share)

        return {
            "message": "File shared successfully",
            "filename": filename,
            "recipient_email": recipient_email,
            "permission": permission
        }

    finally:
        db.close()

@app.post("/share/temporary")
def create_temporary_share(
    filename: str,
    recipient_email: str,
    expires_in_minutes: int = 30,
    current_user: dict = Depends(get_current_user)
):
    if expires_in_minutes <= 0:
        raise HTTPException(
            status_code=400,
            detail="Expiration time must be greater than 0 minutes"
        )

    try:
        filename = safe_filename(filename)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid filename"
        )

    db = Session(bind=engine)

    try:
        # Check file ownership
        file_record = db.query(FileModel).filter(
            FileModel.filename == filename,
            FileModel.owner_id == current_user["user_id"]
        ).first()

        if not file_record:
            raise HTTPException(
                status_code=404,
                detail="File not found or you are not the owner"
            )
        # Check recipient account
        recipient = db.query(User).filter(
            User.email == recipient_email
        ).first()

        if not recipient:
            raise HTTPException(
                status_code=404,
                detail="No TrustShare account found with this email"
            )

        # Prevent self-sharing
        if recipient_email == current_user["email"]:
            raise HTTPException(
                status_code=400,
                detail="You cannot create a temporary link for yourself"
            )

        # Check encrypted file exists in Supabase
        storage_path = filename + ".enc"

        try:
            download_encrypted_file(storage_path)
        except Exception:
            raise HTTPException(
                status_code=404,
                detail="Encrypted file not found in secure storage"
            )

        # Generate secure random token
        token = secrets.token_urlsafe(32)

        # Calculate expiration time using India Standard Time
        expires_at = (
            datetime.now(ZoneInfo("Asia/Kolkata")).replace(tzinfo=None)
            + timedelta(minutes=expires_in_minutes)
        )

        # Create share record
        new_share = FileShare(
            filename=filename,
            sender_id=current_user["user_id"],
            recipient_email=recipient_email,
            permission="read",
            share_token=token,
            expires_at=expires_at
        )

        db.add(new_share)
        db.commit()
        db.refresh(new_share)
        log_activity(
            action="TEMPORARY_LINK_CREATED",
            user_id=current_user["user_id"],
            user_email=current_user["email"],
            filename=filename,
            details=(
                f"Temporary link created for {recipient_email}; "
                f"expires at {expires_at}"
            )
        )
        create_notification(
            user_id=recipient.id,
            title="Temporary File Link Created",
            message=(
                f"{current_user['email']} created a temporary link "
                f"for '{filename}' for you. "
                f"The link expires at {expires_at}."
            ),
            notification_type="TEMPORARY_LINK"
        )

        return {
            "message": "Temporary share link created successfully",
            "filename": filename,
            "recipient_email": recipient_email,
            "expires_at": expires_at.isoformat() + "+05:30",
            "share_token": token
        }

    finally:
        db.close()
# =========================================================
# GET TEMPORARY SHARE INFORMATION
# =========================================================

@app.get("/share/temporary/{token}")
def get_temporary_share_info(token: str):
    db = Session(bind=engine)

    try:
        shared_file = db.query(FileShare).filter(
            FileShare.share_token == token
        ).first()

        if not shared_file:
            raise HTTPException(
                status_code=404,
                detail="Invalid or expired share link"
            )

        # Check expiration
        if (
            shared_file.expires_at is not None
            and datetime.now(ZoneInfo("Asia/Kolkata")).replace(tzinfo=None)
            > shared_file.expires_at
        ):
            raise HTTPException(
                status_code=403,
                detail="This share link has expired"
            )

        return {
            "valid": True,
            "filename": shared_file.filename,
            "expires_at": (
                shared_file.expires_at.isoformat() + "+05:30"
                if shared_file.expires_at
                else None
            )
            if shared_file.expires_at
            else None
        }

    finally:
        db.close()