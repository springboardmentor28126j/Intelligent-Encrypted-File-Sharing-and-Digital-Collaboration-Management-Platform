from redis_client import redis_client
from mongo import activity_logs
from datetime import datetime
from fastapi import UploadFile, File,Form
from fastapi.responses import FileResponse
import shutil
import os
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from database import engine, Base, SessionLocal
import models
import schemas
import auth

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

@app.post("/upload")
async def upload_file(file: UploadFile = File(...), owner_email: str = Form(...), db: Session = Depends(get_db)):
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    contents = await file.read()
    with open(file_path, "wb") as buffer:
        buffer.write(contents)

    existing = db.query(models.FileRecord).filter(
        models.FileRecord.filename == file.filename,
        models.FileRecord.owner_email == owner_email
    ).first()

    new_file = models.FileRecord(
        filename=file.filename,
        owner_email=owner_email,
        file_size=len(contents)
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

    msg = "File uploaded successfully"
    if existing:
        msg = "Uploaded — note: a file with this name already exists in your account"

    return {"message": msg, "filename": file.filename}

@app.get("/files")
def list_files(db: Session = Depends(get_db)):
    files = db.query(models.FileRecord).all()
    return files
@app.delete("/files/{file_id}")
def delete_file(file_id: int, db: Session = Depends(get_db)):
    record = db.query(models.FileRecord).filter(models.FileRecord.id == file_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="File not found")

    file_path = os.path.join(UPLOAD_DIR, record.filename)
    if os.path.exists(file_path):
        os.remove(file_path)

    db.delete(record)
    db.commit()
    return {"message": "File deleted successfully"}


@app.get("/download/{file_id}")
def download_file(file_id: int, db: Session = Depends(get_db)):
    record = db.query(models.FileRecord).filter(models.FileRecord.id == file_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="File not found")

    file_path = os.path.join(UPLOAD_DIR, record.filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File missing on server")

    return FileResponse(
        file_path,
        filename=record.filename,
        media_type="application/octet-stream",
        headers={"Content-Disposition": f"attachment; filename={record.filename}"}
    )