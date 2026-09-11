import hashlib
import logging
import secrets
from datetime import datetime, timedelta
from pathlib import Path
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..models import File, SecureShareLink, User
from ..schemas.secure_share_link import SecureShareLinkCreate, SecureShareLinkResponse
from ..services.activity_service import log_activity
from ..services.encryption_service import EncryptionConfigurationError
from ..services.file_delivery import (
    StorageConfigurationError,
    StorageError,
    StorageObjectNotFoundError,
    read_file_content,
)
from ..utils.dependencies import get_current_user

router = APIRouter(tags=["Secure Share Links"])
logger = logging.getLogger(__name__)

def hash_share_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()

# In backend/app/routers/secure_share_links.py

def build_share_url(token: str) -> str:
    # Use frontend origin (e.g. http://localhost:5173) instead of direct backend API
    base_url = settings.frontend_origin.rstrip("/")
    return f"{base_url}/share/{quote(token, safe='')}"

@router.post("/api/files/{file_id}/share-links", response_model=SecureShareLinkResponse, status_code=status.HTTP_201_CREATED)
def create_share_link(
    file_id: int,
    data: SecureShareLinkCreate | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    item = db.get(File, file_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    if item.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the file owner can create a secure link")

    # 4C: Calculate expires_at
    expires_at = None
    exp_choice = (data.expiration or "never").lower() if data else "never"

    if exp_choice == "1h":
        expires_at = datetime.utcnow() + timedelta(hours=1)
    elif exp_choice == "1d":
        expires_at = datetime.utcnow() + timedelta(days=1)
    elif exp_choice == "7d":
        expires_at = datetime.utcnow() + timedelta(days=7)
    elif exp_choice == "1m":  # Handy for local testing!
        expires_at = datetime.utcnow() + timedelta(minutes=1)

    token = secrets.token_urlsafe(32)
    link = SecureShareLink(
        file_id=file_id,
        created_by_user_id=current_user.id,
        token_hash=hash_share_token(token),
        expires_at=expires_at,
    )
    db.add(link)
    db.commit()
    db.refresh(link)
    log_activity(db, current_user, "share_link_create", f"Created a secure link for {item.original_filename}", item.id)
    return {
        "id": link.id,
        "file_id": link.file_id,
        "share_url": build_share_url(token),
        "created_at": link.created_at,
        "expires_at": link.expires_at,
        "revoked_at": link.revoked_at,
    }

@router.delete("/api/files/{file_id}/share-links/{link_id}")
def revoke_share_link(file_id: int, link_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    item = db.get(File, file_id)
    if not item or item.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the file owner can revoke this link")

    link = db.query(SecureShareLink).filter(SecureShareLink.id == link_id, SecureShareLink.file_id == file_id).first()
    if not link:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Secure link not found")

    if link.revoked_at is None:
        link.revoked_at = datetime.utcnow()
        db.commit()
        log_activity(db, current_user, "share_link_revoke", f"Revoked a secure link for {item.original_filename}", item.id)

    return {"message": "Secure link revoked"}

@router.get("/api/share-links/{token}")
def access_share_link(token: str, db: Session = Depends(get_db)):
    token_hash = hash_share_token(token)
    link = db.query(SecureShareLink).filter(SecureShareLink.token_hash == token_hash).first()
    
    # 4A check: must exist and not revoked
    if not link or link.revoked_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Secure link is invalid")

    # 4C check: check expiration before loading file content
    if link.expires_at is not None and link.expires_at <= datetime.utcnow():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Secure link is invalid")

    item = db.get(File, link.file_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Secure link is invalid")

    try:
        content = read_file_content(item)
    except StorageObjectNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="The shared file is unavailable") from error
    except (StorageConfigurationError, StorageError, EncryptionConfigurationError) as error:
        logger.error("Secure share-link file retrieval failed for file_id=%s", item.id)
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="The shared file is temporarily unavailable") from error
    except ValueError as error:
        logger.error("Secure share-link file integrity failure for file_id=%s", item.id)
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="The shared file failed integrity verification") from error

    filename = quote(Path(item.original_filename).name)
    return Response(
        content=content,
        media_type=item.file_type,
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{filename}"}
    )