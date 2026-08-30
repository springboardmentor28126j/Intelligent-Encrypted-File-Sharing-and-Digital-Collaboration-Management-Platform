import os
import uuid

from fastapi import (
    FastAPI,
    Depends,
    Form,
    UploadFile,
    File as FastAPIFile,
    HTTPException,
    Header
)

from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from sqlalchemy.orm import Session

from database import Base, engine, get_db
from models import User, File as DBFile

from auth import (
    hash_password,
    verify_password,
    create_access_token,
    verify_token
)


# =========================================================
# CREATE APPLICATION
# =========================================================

app = FastAPI(
    title="TrustShare API",
    description="Secure File Sharing and Collaboration Platform",
    version="1.0"
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


# =========================================================
# UPLOAD DIRECTORY
# =========================================================

UPLOAD_DIR = "uploads"

os.makedirs(
    UPLOAD_DIR,
    exist_ok=True
)


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
    db: Session = Depends(get_db)
):

    # Clean input
    username = username.strip()
    email = email.strip().lower()

    # Check username
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

    # Check email
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

    # Basic password validation
    if len(password) < 6:

        return {
            "success": False,
            "message": "Password must contain at least 6 characters."
        }

    # Hash password
    hashed_password = hash_password(password)

    # Create user
    new_user = User(
        username=username,
        email=email,
        password=hashed_password,
        role="user"
    )

    db.add(new_user)

    db.commit()

    db.refresh(new_user)

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

    # Verify password
    if not verify_password(
        password,
        user.password
    ):

        return {
            "success": False,
            "message": "Invalid email or password."
        }

    # Create JWT token
    token = create_access_token(
        user.id,
        user.username,
        user.role
    )

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
# SIMPLE RESET PASSWORD
# =========================================================
#
# NOTE:
# This is a simple version for the current milestone.
# It does NOT use email verification or OTP.
#
# The user provides:
#   email
#   new_password
#
# The password is directly updated.
#
# =========================================================

@app.post("/reset-password")
def reset_password(
    email: str = Form(...),
    new_password: str = Form(...),
    db: Session = Depends(get_db)
):

    email = email.strip().lower()

    # Find user
    user = (
        db.query(User)
        .filter(User.email == email)
        .first()
    )

    # User does not exist
    if not user:

        return {
            "success": False,
            "message": "No account found with this email address."
        }

    # Password validation
    if len(new_password) < 6:

        return {
            "success": False,
            "message": "Password must contain at least 6 characters."
        }

    # Hash new password
    user.password = hash_password(new_password)

    # Save changes
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
    authorization: str = Header(None),
    db: Session = Depends(get_db)
):

    if not authorization:

        raise HTTPException(
            status_code=401,
            detail="Authorization token required."
        )

    if not authorization.startswith("Bearer "):

        raise HTTPException(
            status_code=401,
            detail="Invalid authorization format."
        )

    token = authorization.split(
        " ",
        1
    )[1]

    user_data = verify_token(token)

    if not user_data:

        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token."
        )

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
    authorization: str = Header(None),
    db: Session = Depends(get_db)
):

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

    token = authorization.split(
        " ",
        1
    )[1]

    user_data = verify_token(token)

    if not user_data:

        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token."
        )

    # User can access only their own files
    if user_data["user_id"] != user_id:

        raise HTTPException(
            status_code=403,
            detail="Access denied."
        )

    files = (
        db.query(DBFile)
        .filter(DBFile.user_id == user_id)
        .all()
    )

    return [
        {
            "id": file.id,
            "filename": file.filename
        }
        for file in files
    ]


# =========================================================
# UPLOAD FILE
# =========================================================

@app.post("/upload")
async def upload_file(
    user_id: int = Form(...),
    file: UploadFile = FastAPIFile(...),
    authorization: str = Header(None),
    db: Session = Depends(get_db)
):

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

    token = authorization.split(
        " ",
        1
    )[1]

    user_data = verify_token(token)

    if not user_data:

        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token."
        )

    # Check user
    if user_data["user_id"] != user_id:

        raise HTTPException(
            status_code=403,
            detail="Access denied."
        )

    # Check filename
    if not file.filename:

        raise HTTPException(
            status_code=400,
            detail="Please select a file."
        )

    # Get extension
    extension = ""

    if "." in file.filename:

        extension = "." + file.filename.split(".")[-1]

    # Generate unique filename
    stored_filename = (
        str(uuid.uuid4())
        + extension
    )

    # File path
    file_path = os.path.join(
        UPLOAD_DIR,
        stored_filename
    )

    # Save file
    with open(
        file_path,
        "wb"
    ) as buffer:

        content = await file.read()

        buffer.write(content)

    # Save file information in database
    new_file = DBFile(
        filename=file.filename,
        stored_filename=stored_filename,
        user_id=user_id
    )

    db.add(new_file)

    db.commit()

    db.refresh(new_file)

    return {
        "success": True,
        "message": "File uploaded successfully.",
        "file_id": new_file.id,
        "filename": new_file.filename
    }


# =========================================================
# DOWNLOAD FILE
# =========================================================

@app.get("/download/{file_id}")
def download_file(
    file_id: int,
    authorization: str = Header(None),
    db: Session = Depends(get_db)
):

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

    token = authorization.split(
        " ",
        1
    )[1]

    user_data = verify_token(token)

    if not user_data:

        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token."
        )

    # Find file
    file = (
        db.query(DBFile)
        .filter(DBFile.id == file_id)
        .first()
    )

    if not file:

        raise HTTPException(
            status_code=404,
            detail="File not found."
        )

    # Check ownership
    if file.user_id != user_data["user_id"]:

        raise HTTPException(
            status_code=403,
            detail="Access denied."
        )

    # File path
    file_path = os.path.join(
        UPLOAD_DIR,
        file.stored_filename
    )

    if not os.path.exists(file_path):

        raise HTTPException(
            status_code=404,
            detail="Stored file not found."
        )

    return FileResponse(
        path=file_path,
        filename=file.filename
    )


# =========================================================
# DELETE FILE
# =========================================================

@app.delete("/files/{file_id}")
def delete_file(
    file_id: int,
    authorization: str = Header(None),
    db: Session = Depends(get_db)
):

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

    token = authorization.split(
        " ",
        1
    )[1]

    user_data = verify_token(token)

    if not user_data:

        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token."
        )

    # Find file
    file = (
        db.query(DBFile)
        .filter(DBFile.id == file_id)
        .first()
    )

    if not file:

        raise HTTPException(
            status_code=404,
            detail="File not found."
        )

    # Check ownership
    if file.user_id != user_data["user_id"]:

        raise HTTPException(
            status_code=403,
            detail="Access denied."
        )

    # Physical file path
    file_path = os.path.join(
        UPLOAD_DIR,
        file.stored_filename
    )

    # Delete physical file
    if os.path.exists(file_path):

        os.remove(file_path)

    # Delete database record
    db.delete(file)

    db.commit()

    return {
        "success": True,
        "message": "File deleted successfully."
    }