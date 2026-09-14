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
    Header
)

from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

from sqlalchemy.orm import Session

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

    if not user.is_active:
        return {
            "success": False,
            "message": "This account is inactive."
        }

    if not verify_password(password, user.password):
        return {
            "success": False,
            "message": "Invalid email or password."
        }

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
# RESET PASSWORD
# =========================================================

@app.post("/reset-password")
def reset_password(
    email: str = Form(...),
    new_password: str = Form(...),
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
    db.delete(file)
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

    return {
        "success": True,
        "message": "Share link revoked."
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
