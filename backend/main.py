from redis_client import redis_client
from mongo import activity_logs
from datetime import datetime, timedelta
from fastapi import UploadFile, File, Form
from fastapi.responses import FileResponse, Response  # FIX: Response was missing — download_file needs it
import os
import secrets
import secrets as pysecrets
import uuid
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from database import engine, Base, SessionLocal
import models
import schemas
import auth
import encryption  # AES-256-GCM encrypt/decrypt helpers (Milestone 2)
from storage_client import upload_to_storage, download_from_storage, delete_from_storage

Base.metadata.create_all(bind=engine)

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# NEW: single helper so every action logs with the SAME field names.
# Extra keyword args (share_token, recipient_email, etc.) are still included
# for that specific action, but every entry always has action/filename/
# performed_by/timestamp so the Activity Log page can display and filter
# them consistently.
def log_activity(action: str, filename: str, performed_by: str, **extra):
    try:
        entry = {
            "action": action,
            "filename": filename,
            "performed_by": performed_by,
            "timestamp": datetime.utcnow(),
        }
        entry.update(extra)
        activity_logs.insert_one(entry)
    except Exception as e:
        print(f"MongoDB logging failed (non-critical): {e}")


@app.get("/")
def home():
    return {"message": "TrustShare backend running"}


@app.post("/signup")
def signup(user: schemas.UserCreate, db: Session = Depends(get_db)):
    existing_user = db.query(models.User).filter(models.User.email == user.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed_pw = auth.hash_password(user.password)
    new_user = models.User(name=user.name, email=user.email, password=hashed_pw, role=user.role)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"message": "User created successfully", "email": new_user.email, "role": new_user.role}


@app.post("/login")
def login(user: schemas.UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if not db_user or not auth.verify_password(user.password, db_user.password):
        raise HTTPException(status_code=400, detail="Invalid email or password")

    token = auth.create_access_token({"sub": db_user.email})

    try:
        redis_client.incr(f"login_count:{db_user.email}")
        redis_client.set(f"session:{db_user.email}", token, ex=3600)
    except Exception as e:
        print(f"Redis caching failed (non-critical): {e}")

    return {"access_token": token, "token_type": "bearer", "role": db_user.role, "name": db_user.name}


ALLOWED_EXTENSIONS = {
    ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
    ".png", ".jpg", ".jpeg", ".txt", ".zip", ".csv",
}
MAX_FILE_SIZE_MB = 25


@app.post("/upload")
async def upload_file(file: UploadFile = File(...), owner_email: str = Form(...), db: Session = Depends(get_db)):
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"File type '{ext}' is not allowed")

    contents = await file.read()

    size_mb = len(contents) / (1024 * 1024)
    if size_mb > MAX_FILE_SIZE_MB:
        raise HTTPException(status_code=400, detail=f"File exceeds max size of {MAX_FILE_SIZE_MB}MB")

    stored_name = f"{uuid.uuid4().hex}{ext}"
    key = encryption.generate_key()
    encrypted_bytes = encryption.encrypt_file_bytes(contents, key)

    upload_to_storage(stored_name, encrypted_bytes)
    encryption.save_key(stored_name, key)

    existing = db.query(models.FileRecord).filter(
        models.FileRecord.filename == file.filename,
        models.FileRecord.owner_email == owner_email
    ).first()

    new_file = models.FileRecord(
        filename=file.filename,
        stored_name=stored_name,
        owner_email=owner_email,
        file_size=len(contents),
        is_encrypted=True,
    )
    db.add(new_file)
    db.commit()

    log_activity("file_upload", file.filename, owner_email)

    msg = "File uploaded and encrypted successfully"
    if existing:
        msg = "Uploaded, note: a file with this name already exists in your account"

    return {"message": msg, "filename": file.filename}


@app.get("/files")
def list_files(email: str, role: str, db: Session = Depends(get_db)):
    if role == "admin":
        files = db.query(models.FileRecord).all()
    else:
        files = db.query(models.FileRecord).filter(models.FileRecord.owner_email == email).all()
    return files


@app.delete("/files/{file_id}")
def delete_file(file_id: int, email: str, role: str, db: Session = Depends(get_db)):
    record = db.query(models.FileRecord).filter(models.FileRecord.id == file_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="File not found")

    if role != "admin" and record.owner_email != email:
        raise HTTPException(status_code=403, detail="You do not have permission to delete this file")

    filename = record.filename  # save before the row is deleted

    try:
        delete_from_storage(record.stored_name)
    except Exception as e:
        print(f"Storage delete failed (non-critical): {e}")
    encryption.delete_key(record.stored_name)

    db.delete(record)
    db.commit()

    # FIX: delete was never logged before — now it is, same as every other action
    log_activity("file_delete", filename, email)

    return {"message": "File deleted successfully"}


@app.get("/download/{file_id}")
def download_file(file_id: int, email: str, role: str, db: Session = Depends(get_db)):
    record = db.query(models.FileRecord).filter(models.FileRecord.id == file_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="File not found")

    if role != "admin" and record.owner_email != email:
        raise HTTPException(status_code=403, detail="You do not have permission to download this file")

    key = encryption.load_key(record.stored_name)
    if key is None:
        raise HTTPException(status_code=500, detail="Encryption key missing — cannot decrypt file")

    try:
        encrypted_bytes = download_from_storage(record.stored_name)
    except Exception:
        raise HTTPException(status_code=404, detail="File missing in cloud storage")

    try:
        decrypted_bytes = encryption.decrypt_file_bytes(encrypted_bytes, key)
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to decrypt file — data may be corrupted")

    log_activity("file_download", record.filename, email)

    return Response(
        content=decrypted_bytes,
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{record.filename}"'}
    )


# NEW: the Activity Log tab now calls this instead of reusing the /files list.
# Standard users see only activity tied to their own actions/files; admins see everything.
@app.get("/activity-log")
def get_activity_log(email: str, role: str):
    try:
        if role == "admin":
            logs_cursor = activity_logs.find().sort("timestamp", -1).limit(200)
        else:
            logs_cursor = activity_logs.find({"performed_by": email}).sort("timestamp", -1).limit(200)

        logs = []
        for log in logs_cursor:
            log["_id"] = str(log["_id"])
            if isinstance(log.get("timestamp"), datetime):
                log["timestamp"] = log["timestamp"].isoformat()
            logs.append(log)
        return logs
    except Exception as e:
        print(f"Failed to fetch activity log: {e}")
        return []


@app.post("/forgot-password")
def forgot_password(payload: dict, db: Session = Depends(get_db)):
    email = payload.get("email")
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="No account found with this email")

    token = secrets.token_hex(4)

    try:
        redis_client.set(f"reset_token:{token}", email, ex=600)
    except Exception as e:
        raise HTTPException(status_code=500, detail="Could not generate reset token, try again")

    return {
        "message": "Reset token generated (dev mode)",
        "reset_token": token,
        "expires_in": "10 minutes"
    }


@app.post("/reset-password")
def reset_password(payload: dict, db: Session = Depends(get_db)):
    token = payload.get("token")
    new_password = payload.get("new_password")

    try:
        email = redis_client.get(f"reset_token:{token}")
    except Exception:
        email = None

    if not email:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.password = auth.hash_password(new_password)
    db.commit()

    try:
        redis_client.delete(f"reset_token:{token}")
    except Exception:
        pass

    return {"message": "Password reset successful. You can now log in with your new password."}


@app.post("/share/{file_id}")
def create_share_link(file_id: int, payload: dict, db: Session = Depends(get_db)):
    """Create a secure, time-limited share link for a file, tied to a recipient email."""
    record = db.query(models.FileRecord).filter(models.FileRecord.id == file_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="File not found")

    requester_email = payload.get("email")
    requester_role = payload.get("role")
    recipient_email = payload.get("recipient_email")

    if requester_role != "admin" and record.owner_email != requester_email:
        raise HTTPException(status_code=403, detail="Only the file owner or an admin can share this file")

    if not recipient_email:
        raise HTTPException(status_code=400, detail="Recipient email is required")

    expiry_hours = payload.get("expiry_hours", 24)
    share_token = pysecrets.token_urlsafe(16)
    expires_at = datetime.utcnow() + timedelta(hours=expiry_hours)

    new_share = models.ShareLink(
        file_id=file_id,
        share_token=share_token,
        created_by=requester_email,
        recipient_email=recipient_email,
        expires_at=expires_at
    )
    db.add(new_share)
    db.commit()

    share_url = f"http://localhost:8000/shared/{share_token}"

    log_activity(
        "share_link_created",
        record.filename,
        requester_email,
        recipient_email=recipient_email,
        share_token=share_token,
    )

    return {
        "message": f"Share link generated for {recipient_email} (dev mode — email sending not yet wired up)",
        "share_token": share_token,
        "expires_at": expires_at.isoformat(),
        "share_url": share_url,
        "recipient_email": recipient_email
    }


@app.get("/shared/{share_token}")
def access_shared_file(share_token: str, db: Session = Depends(get_db)):
    """Access a file via its share link — checks expiration before allowing download."""
    share = db.query(models.ShareLink).filter(models.ShareLink.share_token == share_token).first()
    if not share:
        raise HTTPException(status_code=404, detail="Invalid share link")

    if datetime.utcnow() > share.expires_at:
        raise HTTPException(status_code=410, detail="This share link has expired")

    record = db.query(models.FileRecord).filter(models.FileRecord.id == share.file_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="File no longer exists")

    key = encryption.load_key(record.stored_name)
    if not key:
        raise HTTPException(status_code=500, detail="Encryption key missing for this file")

    try:
        encrypted_bytes = download_from_storage(record.stored_name)
    except Exception:
        raise HTTPException(status_code=404, detail="File missing in cloud storage")

    decrypted_bytes = encryption.decrypt_file_bytes(encrypted_bytes, key)

    # FIX: use the recipient's email (not the share_token) as performed_by,
    # so it lines up with every other log entry and can be filtered the same way.
    log_activity(
        "shared_file_access",
        record.filename,
        share.recipient_email,
        share_token=share_token,
    )

    return Response(
        content=decrypted_bytes,
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{record.filename}"'}
    )


@app.get("/share-info/{share_token}")
def share_link_info(share_token: str, db: Session = Depends(get_db)):
    """Check share link validity and get file info without downloading (for the frontend page)."""
    share = db.query(models.ShareLink).filter(models.ShareLink.share_token == share_token).first()
    if not share:
        raise HTTPException(status_code=404, detail="Invalid share link")

    is_expired = datetime.utcnow() > share.expires_at

    record = db.query(models.FileRecord).filter(models.FileRecord.id == share.file_id).first()

    return {
        "filename": record.filename if record else "Unknown",
        "expires_at": share.expires_at.isoformat(),
        "is_expired": is_expired,
        "shared_by": share.created_by
    }