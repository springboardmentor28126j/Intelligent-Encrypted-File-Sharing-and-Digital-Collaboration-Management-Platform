from fastapi import UploadFile, File
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
    new_user = models.User(email=user.email, password=hashed_pw)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"message": "User created successfully", "email": new_user.email}

@app.post("/login")
def login(user: schemas.UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if not db_user or not auth.verify_password(user.password, db_user.password):
        raise HTTPException(status_code=400, detail="Invalid email or password")

    token = auth.create_access_token({"sub": db_user.email})
    return {"access_token": token, "token_type": "bearer"}
UPLOAD_DIR = "uploads"

@app.post("/upload")
async def upload_file(file: UploadFile = File(...), db: Session = Depends(get_db)):
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    new_file = models.FileRecord(filename=file.filename, owner_email="test@example.com")
    db.add(new_file)
    db.commit()

    return {"message": "File uploaded successfully", "filename": file.filename}

@app.get("/files")
def list_files(db: Session = Depends(get_db)):
    files = db.query(models.FileRecord).all()
    return files