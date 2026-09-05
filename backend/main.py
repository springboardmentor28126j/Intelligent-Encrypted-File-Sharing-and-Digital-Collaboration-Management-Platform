from redis_client import redis_client
from mongo import activity_logs
from datetime import datetime
from fastapi import UploadFile, File, Form
from fastapi.responses import Response
import os
import secrets
import uuid
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from database import engine, Base, SessionLocal
import models
import schemas
import auth
import encryption  # NEW: AES-256-GCM encrypt/decrypt helpers (Milestone 2)

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


UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

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

    # NEW (Milestone 2 — encryption): give the file-on-disk a unique, unguessable
    # name (separate from the original filename) and encrypt the bytes with a
    # fresh AES-256 key generated just for this file, before writing anything
    # to disk. The key is stored server-side only — never sent to the client.
    stored_name = f"{uuid.uuid4().hex}{ext}"
    key = encryption.generate_key()
    encrypted_bytes = encryption.encrypt_file_bytes(contents, key)

    file_path = os.path.join(UPLOAD_DIR, stored_name)
    with open(file_path, "wb") as buffer:
        buffer.write(encrypted_bytes)

    encryption.save_key(stored_name, key)

    existing = db.query(models.FileRecord).filter(
        models.FileRecord.filename == file.filename,
        models.FileRecord.owner_email == owner_email
    ).first()

    new_file = models.FileRecord(
        filename=file.filename,
        stored_name=stored_name,
        owner_email=owner_email,
        file_size=len(contents),      # original size, shown to the user
        is_encrypted=True,
    )
    db.add(new_file)
    db.commit()

    try:
        activity_logs.insert_one({
            "action": "file_upload",
            "filename": file.filename,
            "owner_email": owner_email,
            "timestamp": datetime.utcnow()
        })
    except Exception as e:
        print(f"MongoDB logging failed (non-critical): {e}")

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

    file_path = os.path.join(UPLOAD_DIR, record.stored_name)
    if os.path.exists(file_path):
        os.remove(file_path)
    encryption.delete_key(record.stored_name)  # NEW: remove the file's encryption key too

    db.delete(record)
    db.commit()
    return {"message": "File deleted successfully"}


@app.get("/download/{file_id}")
def download_file(file_id: int, email: str, role: str, db: Session = Depends(get_db)):
    record = db.query(models.FileRecord).filter(models.FileRecord.id == file_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="File not found")

    if role != "admin" and record.owner_email != email:
        raise HTTPException(status_code=403, detail="You do not have permission to download this file")

    file_path = os.path.join(UPLOAD_DIR, record.stored_name)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File missing on server")

    # NEW (Milestone 2 — decryption workflow): read the encrypted bytes, load
    # this file's unique key, decrypt in memory, and stream the *original*
    # bytes back to the user. The plaintext is never written to disk.
    key = encryption.load_key(record.stored_name)
    if key is None:
        raise HTTPException(status_code=500, detail="Encryption key missing — cannot decrypt file")

    with open(file_path, "rb") as f:
        encrypted_bytes = f.read()

    try:
        decrypted_bytes = encryption.decrypt_file_bytes(encrypted_bytes, key)
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to decrypt file — data may be corrupted")

    try:
        activity_logs.insert_one({
            "action": "file_download",
            "filename": record.filename,
            "owner_email": email,
            "timestamp": datetime.utcnow()
        })
    except Exception as e:
        print(f"MongoDB logging failed (non-critical): {e}")

    return Response(
        content=decrypted_bytes,
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{record.filename}"'}
    )


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