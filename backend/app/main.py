
from fastapi import FastAPI, Depends, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.database import Base, engine, SessionLocal
from app.models import User, SharedFile

from app.security import (
    create_access_token,
    create_password_reset_token,
    verify_password_reset_token
)

from app.auth import get_current_user, get_current_admin
from app.password import hash_password, verify_password

import os
import shutil


# =========================================================
# FastAPI Application
# =========================================================

app = FastAPI(title="TrustShare API")


# =========================================================
# CORS
# =========================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================================
# Create Database Tables
# =========================================================

Base.metadata.create_all(bind=engine)


# =========================================================
# Database Session
# =========================================================

def get_db():

    db = SessionLocal()

    try:
        yield db

    finally:
        db.close()


# =========================================================
# Upload Folder
# =========================================================

UPLOAD_FOLDER = "uploads"

os.makedirs(
    UPLOAD_FOLDER,
    exist_ok=True
)


# =========================================================
# Home
# =========================================================

@app.get("/")
def home():

    return {
        "message": "TrustShare API is running"
    }


# =========================================================
# Register
# =========================================================

@app.post("/register")
def register(
    name: str,
    email: str,
    password: str,
    db: Session = Depends(get_db)
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

    hashed_password = hash_password(password)

    new_user = User(
        name=name,
        email=email,
        password=hashed_password,
        role="user"
    )

    db.add(new_user)

    db.commit()

    db.refresh(new_user)

    return {
        "message": "Registration successful",
        "user_id": new_user.id,
        "name": new_user.name,
        "email": new_user.email,
        "role": new_user.role
    }


# =========================================================
# Login
# =========================================================

@app.post("/login")
def login(
    email: str,
    password: str,
    db: Session = Depends(get_db)
):

    user = (
        db.query(User)
        .filter(User.email == email)
        .first()
    )

    if not user:

        return {
            "message": "Invalid email or password"
        }

    try:

        password_correct = verify_password(
            password,
            user.password
        )

    except Exception:

        return {
            "message": "Password data is invalid. Please register this account again."
        }

    if not password_correct:

        return {
            "message": "Invalid email or password"
        }

    # JWT contains user ID, email and role
    access_token = create_access_token(
        data={
            "user_id": user.id,
            "email": user.email,
            "role": user.role
        }
    )

    return {
        "message": "Login successful",
        "user_id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "access_token": access_token,
        "token_type": "bearer"
    }


# =========================================================
# Forgot Password
# =========================================================

@app.post("/forgot-password")
def forgot_password(
    email: str,
    db: Session = Depends(get_db)
):

    user = (
        db.query(User)
        .filter(User.email == email)
        .first()
    )

    # Do not reveal whether an email exists
    if not user:

        return {
            "message": "If the email is registered, a password reset link has been generated."
        }

    # Create temporary reset token
    reset_token = create_password_reset_token(
        user.id
    )

    # Development/testing response
    return {
        "message": "Password reset token generated successfully.",
        "reset_token": reset_token
    }


# =========================================================
# Reset Password
# =========================================================

@app.post("/reset-password")
def reset_password(
    token: str,
    new_password: str,
    db: Session = Depends(get_db)
):

    # Verify reset token
    user_id = verify_password_reset_token(
        token
    )

    if user_id is None:

        raise HTTPException(
            status_code=400,
            detail="Invalid or expired password reset token."
        )

    # Find user
    user = (
        db.query(User)
        .filter(User.id == user_id)
        .first()
    )

    if not user:

        raise HTTPException(
            status_code=404,
            detail="User not found."
        )

    # Hash new password
    user.password = hash_password(
        new_password
    )

    # Save to PostgreSQL
    db.commit()

    return {
        "message": "Password reset successful. You can now login with your new password."
    }


# =========================================================
# Protected Route
# =========================================================

@app.get("/protected")
def protected_route(
    current_user: dict = Depends(get_current_user)
):

    return {
        "message": "You have accessed a protected route!",
        "user": current_user
    }


# =========================================================
# Profile
# =========================================================

@app.get("/profile")
def profile(
    current_user: dict = Depends(get_current_user)
):

    return {
        "message": "Welcome to your TrustShare profile",
        "user": current_user
    }


# =========================================================
# Upload File
# =========================================================

@app.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):

    if not file.filename:

        raise HTTPException(
            status_code=400,
            detail="No file selected"
        )

    user_id = current_user["user_id"]

    user_folder = os.path.join(
        UPLOAD_FOLDER,
        str(user_id)
    )

    os.makedirs(
        user_folder,
        exist_ok=True
    )

    filename = os.path.basename(
        file.filename
    )

    file_path = os.path.join(
        user_folder,
        filename
    )

    with open(
        file_path,
        "wb"
    ) as buffer:

        shutil.copyfileobj(
            file.file,
            buffer
        )

    return {
        "message": "File uploaded successfully",
        "filename": filename,
        "user_id": user_id
    }


# =========================================================
# Get Uploaded Files
# =========================================================

@app.get("/files")
def get_files(
    current_user: dict = Depends(get_current_user)
):

    user_id = current_user["user_id"]

    user_folder = os.path.join(
        UPLOAD_FOLDER,
        str(user_id)
    )

    if not os.path.exists(user_folder):

        return {
            "files": []
        }

    files = os.listdir(
        user_folder
    )

    return {
        "files": files
    }


# =========================================================
# Share File
# =========================================================

@app.post("/share")
def share_file(
    filename: str,
    recipient_email: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    sender_id = current_user["user_id"]

    recipient = (
        db.query(User)
        .filter(User.email == recipient_email)
        .first()
    )

    if not recipient:

        raise HTTPException(
            status_code=404,
            detail="Recipient user not found"
        )

    sender_folder = os.path.join(
        UPLOAD_FOLDER,
        str(sender_id)
    )

    file_path = os.path.join(
        sender_folder,
        filename
    )

    if not os.path.exists(file_path):

        raise HTTPException(
            status_code=404,
            detail="File not found"
        )

    shared_file = SharedFile(
        filename=filename,
        owner_id=sender_id,
        sender_id=sender_id,
        recipient_id=recipient.id
    )

    db.add(shared_file)

    db.commit()

    db.refresh(shared_file)

    return {
        "message": "File shared successfully",
        "filename": filename,
        "sender_id": sender_id,
        "recipient_id": recipient.id,
        "recipient_email": recipient.email
    }


# =========================================================
# Shared With Me
# =========================================================

@app.get("/shared-with-me")
def shared_with_me(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    user_id = current_user["user_id"]

    shared_files = (
        db.query(SharedFile)
        .filter(
            SharedFile.recipient_id == user_id
        )
        .all()
    )

    result = []

    for shared_file in shared_files:

        sender = (
            db.query(User)
            .filter(
                User.id == shared_file.sender_id
            )
            .first()
        )

        sender_name = "Unknown"

        if sender:
            sender_name = sender.name

        result.append({

            "id": shared_file.id,

            "filename": shared_file.filename,

            "sender_id": shared_file.sender_id,

            "sender_name": sender_name,

            "recipient_id": shared_file.recipient_id

        })

    return {
        "shared_files": result
    }


# =========================================================
# ADMIN / RBAC SECTION
# =========================================================


# =========================================================
# View All Users
# ADMIN ONLY
# =========================================================

@app.get("/admin/users")
def get_all_users(
    current_admin: dict = Depends(get_current_admin),
    db: Session = Depends(get_db)
):

    users = db.query(User).all()

    result = []

    for user in users:

        result.append({
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role
        })

    return {
        "message": "Admin access granted",
        "users": result
    }


# =========================================================
# Change User Role
# ADMIN ONLY
# =========================================================

@app.put("/admin/users/{user_id}/role")
def change_user_role(
    user_id: int,
    role: str,
    current_admin: dict = Depends(get_current_admin),
    db: Session = Depends(get_db)
):

    if role not in ["user", "admin"]:

        raise HTTPException(
            status_code=400,
            detail="Role must be either 'user' or 'admin'"
        )

    user = (
        db.query(User)
        .filter(User.id == user_id)
        .first()
    )

    if not user:

        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    user.role = role

    db.commit()

    db.refresh(user)

    return {
        "message": "User role updated successfully",
        "user_id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role
    }


# =========================================================
# Delete User
# ADMIN ONLY
# =========================================================

@app.delete("/admin/users/{user_id}")
def delete_user(
    user_id: int,
    current_admin: dict = Depends(get_current_admin),
    db: Session = Depends(get_db)
):

    user = (
        db.query(User)
        .filter(User.id == user_id)
        .first()
    )

    if not user:

        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    # Admin cannot delete their own account
    if user.id == current_admin["user_id"]:

        raise HTTPException(
            status_code=400,
            detail="Admin cannot delete their own account"
        )

    db.delete(user)

    db.commit()

    return {
        "message": "User deleted successfully",
        "user_id": user_id
    }
