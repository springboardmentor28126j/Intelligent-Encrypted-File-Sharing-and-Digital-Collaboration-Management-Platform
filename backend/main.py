from redis_client import redis_client
from mongo import activity_logs
from datetime import datetime, timedelta
from fastapi import UploadFile, File, Form
from fastapi.responses import FileResponse, Response
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
import encryption
from storage_client import upload_to_storage, download_from_storage, delete_from_storage
from email_service import send_email

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
        try:
            fail_key = f"failed_login:{user.email}"
            fail_count = redis_client.incr(fail_key)
            redis_client.expire(fail_key, 900)

            if fail_count >= 3:
                log_activity(
                    "suspicious_activity",
                    "N/A",
                    user.email,
                    reason=f"{fail_count} failed login attempts within 15 minutes"
                )
                send_email(
                    user.email,
                    "TrustShare — Security Alert",
                    f"We detected {fail_count} failed login attempts on your account within the last 15 minutes. "
                    f"If this wasn't you, consider resetting your password immediately."
                )
        except Exception as e:
            print(f"Redis failed-login tracking error (non-critical): {e}")

        raise HTTPException(status_code=400, detail="Invalid email or password")

    token = auth.create_access_token({"sub": db_user.email})
    if db_user.mfa_enabled:
        otp_code = secrets.token_hex(3)
        try:
            redis_client.set(f"mfa_login:{db_user.email}", otp_code, ex=300)
        except Exception:
            pass
        send_email(db_user.email, "TrustShare — Login Verification Code",
                   f"Your login verification code is: {otp_code}\nThis code expires in 5 minutes.")
        return {"mfa_required": True, "email": db_user.email, "message": "Verification code sent to your email"}

    try:
        redis_client.delete(f"failed_login:{user.email}")
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

    filename = record.filename

    try:
        delete_from_storage(record.stored_name)
    except Exception as e:
        print(f"Storage delete failed (non-critical): {e}")
    encryption.delete_key(record.stored_name)

    db.delete(record)
    db.commit()

    try:
        delete_key = f"delete_count:{email}"
        delete_count = redis_client.incr(delete_key)
        redis_client.expire(delete_key, 120)

        if delete_count == 5:
            log_activity(
                "suspicious_activity",
                "N/A",
                email,
                reason=f"{delete_count} files deleted within 2 minutes — possible malicious activity"
            )
            send_email(
                email,
                "TrustShare — Security Alert",
                f"We detected {delete_count} file deletions on your account within 2 minutes. "
                f"If this wasn't you, please review your account activity immediately."
            )
    except Exception as e:
        print(f"Redis delete tracking error (non-critical): {e}")

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

    try:
        download_key = f"download_count:{email}"
        download_count = redis_client.incr(download_key)
        redis_client.expire(download_key, 120)

        if download_count == 3:
            log_activity(
                "suspicious_activity",
                "N/A",
                email,
                reason=f"{download_count} file downloads within 2 minutes — possible data exfiltration"
            )
            send_email(
                email,
                "TrustShare — Security Alert",
                f"We detected {download_count} file downloads on your account within 2 minutes. "
                f"If this wasn't you, please review your account activity immediately."
            )
    except Exception as e:
        print(f"Redis download tracking error (non-critical): {e}")

    log_activity("file_download", record.filename, email)

    if record.owner_email != email:
        send_email(
            record.owner_email,
            "TrustShare — Your file was accessed",
            f"Your file '{record.filename}' was downloaded by {email} (role: {role}) "
            f"on {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}.\n\n"
            f"If you don't recognize this activity, please review your account."
        )

    return Response(
        content=decrypted_bytes,
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{record.filename}"'}
    )


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
        redis_client.set(f"reset_token:{token}", email, ex=300)
    except Exception as e:
        raise HTTPException(status_code=500, detail="Could not generate reset token, try again")

    reset_link_text = f"Your TrustShare password reset code is: {token}\nThis code expires in 5 minutes."
    send_email(email, "TrustShare — Password Reset Code", reset_link_text)

    return {
        "message": "Reset code sent to your email",
        "reset_token": token,
        "expires_in": "5 minutes"
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


# NEW: list + revoke share links (used by the Settings page)
@app.get("/share-links")
def list_share_links(email: str, role: str, db: Session = Depends(get_db)):
    """List active (non-expired) share links owned by this user, or all if admin."""
    now = datetime.utcnow()
    if role == "admin":
        shares = db.query(models.ShareLink).filter(models.ShareLink.expires_at > now).all()
    else:
        shares = db.query(models.ShareLink).filter(
            models.ShareLink.created_by == email,
            models.ShareLink.expires_at > now
        ).all()

    result = []
    for s in shares:
        record = db.query(models.FileRecord).filter(models.FileRecord.id == s.file_id).first()
        result.append({
            "share_token": s.share_token,
            "filename": record.filename if record else "Unknown",
            "recipient_email": s.recipient_email,
            "expires_at": s.expires_at.isoformat(),
            "created_by": s.created_by,
        })
    return result


@app.delete("/share-links/{share_token}")
def revoke_share_link(share_token: str, email: str, role: str, db: Session = Depends(get_db)):
    """Revoke (delete) a share link before it expires."""
    share = db.query(models.ShareLink).filter(models.ShareLink.share_token == share_token).first()
    if not share:
        raise HTTPException(status_code=404, detail="Share link not found")

    if role != "admin" and share.created_by != email:
        raise HTTPException(status_code=403, detail="You do not have permission to revoke this link")

    db.delete(share)
    db.commit()

    log_activity("share_link_revoked", "N/A", email)
    return {"message": "Share link revoked successfully"}


@app.get("/analytics")
def get_analytics(email: str, role: str, db: Session = Depends(get_db)):
    if role == "admin":
        files = db.query(models.FileRecord).all()
    else:
        files = db.query(models.FileRecord).filter(models.FileRecord.owner_email == email).all()

    total_files = len(files)
    total_storage_bytes = sum(f.file_size or 0 for f in files)

    type_breakdown = {}
    for f in files:
        ext = os.path.splitext(f.filename)[1].lower().replace(".", "") or "other"
        type_breakdown[ext] = type_breakdown.get(ext, 0) + 1

    uploader_breakdown = {}
    for f in files:
        uploader_breakdown[f.owner_email] = uploader_breakdown.get(f.owner_email, 0) + 1
    top_uploaders = sorted(uploader_breakdown.items(), key=lambda x: x[1], reverse=True)[:5]

    try:
        total_uploads = activity_logs.count_documents({"action": "file_upload"})
        total_downloads = activity_logs.count_documents({"action": "file_download"})
        total_shares = activity_logs.count_documents({"action": "share_link_created"})
        suspicious_count = activity_logs.count_documents({"action": "suspicious_activity"})
    except Exception:
        total_uploads = total_downloads = total_shares = suspicious_count = 0

    return {
        "total_files": total_files,
        "total_storage_bytes": total_storage_bytes,
        "type_breakdown": type_breakdown,
        "top_uploaders": [{"email": e, "count": c} for e, c in top_uploaders],
        "total_uploads": total_uploads,
        "total_downloads": total_downloads,
        "total_shares": total_shares,
        "suspicious_count": suspicious_count,
    }


@app.post("/mfa/enable-request")
def mfa_enable_request(payload: dict, db: Session = Depends(get_db)):
    email = payload.get("email")
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    code = secrets.token_hex(3)
    try:
        redis_client.set(f"mfa_setup:{email}", code, ex=600)
    except Exception:
        raise HTTPException(status_code=500, detail="Could not generate code, try again")

    send_email(email, "TrustShare — Enable Two-Factor Authentication",
               f"Your verification code to enable 2FA is: {code}\nThis code expires in 10 minutes.")

    return {"message": "Verification code sent to your email"}


@app.post("/mfa/enable-confirm")
def mfa_enable_confirm(payload: dict, db: Session = Depends(get_db)):
    email = payload.get("email")
    code = payload.get("code")

    try:
        stored_code = redis_client.get(f"mfa_setup:{email}")
    except Exception:
        stored_code = None

    if not stored_code or stored_code != code:
        raise HTTPException(status_code=400, detail="Invalid or expired code")

    user = db.query(models.User).filter(models.User.email == email).first()
    user.mfa_enabled = True
    db.commit()

    try:
        redis_client.delete(f"mfa_setup:{email}")
    except Exception:
        pass

    log_activity("mfa_enabled", "N/A", email)
    return {"message": "Two-factor authentication enabled successfully"}


@app.post("/mfa/disable")
def mfa_disable(payload: dict, db: Session = Depends(get_db)):
    email = payload.get("email")
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.mfa_enabled = False
    db.commit()

    log_activity("mfa_disabled", "N/A", email)
    return {"message": "Two-factor authentication disabled"}


@app.post("/verify-mfa")
def verify_mfa(payload: dict, db: Session = Depends(get_db)):
    email = payload.get("email")
    code = payload.get("code")

    try:
        stored_code = redis_client.get(f"mfa_login:{email}")
    except Exception:
        stored_code = None

    if not stored_code or stored_code != code:
        raise HTTPException(status_code=400, detail="Invalid or expired code")

    db_user = db.query(models.User).filter(models.User.email == email).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    token = auth.create_access_token({"sub": db_user.email})

    try:
        redis_client.delete(f"mfa_login:{email}")
        redis_client.incr(f"login_count:{db_user.email}")
        redis_client.set(f"session:{db_user.email}", token, ex=3600)
    except Exception as e:
        print(f"Redis caching failed (non-critical): {e}")

    return {"access_token": token, "token_type": "bearer", "role": db_user.role, "name": db_user.name}


@app.get("/report")
def get_report(email: str, role: str, days: int = 7):
    since = datetime.utcnow() - timedelta(days=days)

    try:
        query = {"timestamp": {"$gte": since}}
        if role != "admin":
            query["performed_by"] = email

        logs = list(activity_logs.find(query).sort("timestamp", -1))

        summary = {
            "file_upload": 0,
            "file_download": 0,
            "file_delete": 0,
            "share_link_created": 0,
            "shared_file_access": 0,
            "suspicious_activity": 0,
        }
        suspicious_details = []

        for log in logs:
            action = log.get("action", "other")
            if action in summary:
                summary[action] += 1
            if action == "suspicious_activity":
                suspicious_details.append({
                    "performed_by": log.get("performed_by"),
                    "reason": log.get("reason", ""),
                    "timestamp": log.get("timestamp").isoformat() if log.get("timestamp") else "",
                })

        return {
            "period_days": days,
            "generated_at": datetime.utcnow().isoformat(),
            "generated_by": email,
            "total_events": len(logs),
            "summary": summary,
            "suspicious_details": suspicious_details,
        }
    except Exception as e:
        print(f"Report generation failed: {e}")
        raise HTTPException(status_code=500, detail="Could not generate report")