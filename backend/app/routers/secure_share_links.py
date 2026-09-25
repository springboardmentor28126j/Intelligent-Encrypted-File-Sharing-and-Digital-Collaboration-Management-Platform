import hashlib
import logging
import secrets
from datetime import datetime, timedelta
from pathlib import Path
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy.orm import Session
from starlette.requests import Request

from ..config import settings
from ..database import get_db
from ..models import File, SecureShareLink, User
from ..models.file import file_display_name, file_display_type, file_is_deleted
from ..schemas.secure_share_link import SecureShareLinkCreate, SecureShareLinkResponse
from ..services.activity_service import _request_ip, _request_ua, log_activity
from ..services.encryption_service import EncryptionConfigurationError
from ..services.file_delivery import (
    StorageConfigurationError,
    StorageError,
    StorageObjectNotFoundError,
    read_file_content,
)
from ..services.notification_service import create_notification
from ..services.security_service import record_failed_file_access
from ..utils.dependencies import get_current_user

router = APIRouter(tags=["Secure Share Links"])
logger = logging.getLogger(__name__)


def hash_share_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def build_share_url(token: str) -> str:
    base_url = settings.frontend_origin.rstrip("/")
    return f"{base_url}/share/{quote(token, safe='')}"


@router.post("/api/files/{file_id}/share-links", response_model=SecureShareLinkResponse, status_code=status.HTTP_201_CREATED)
def create_share_link(
    file_id: int,
    data: SecureShareLinkCreate | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    item = db.get(File, file_id)
    if not item or file_is_deleted(item):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    if item.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the file owner can create a secure link")

    expires_at = None
    exp_choice = (data.expiration or "never").lower() if data else "never"

    if exp_choice == "1h":
        expires_at = datetime.utcnow() + timedelta(hours=1)
    elif exp_choice == "1d":
        expires_at = datetime.utcnow() + timedelta(days=1)
    elif exp_choice == "7d":
        expires_at = datetime.utcnow() + timedelta(days=7)
    elif exp_choice == "1m":
        expires_at = datetime.utcnow() + timedelta(minutes=1)

    max_dl = data.max_downloads if (data and data.max_downloads and data.max_downloads > 0) else None

    token = secrets.token_urlsafe(32)
    link = SecureShareLink(
        file_id=file_id,
        created_by_user_id=current_user.id,
        token_hash=hash_share_token(token),
        expires_at=expires_at,
        max_downloads=max_dl,
        download_count=0,
    )
    db.add(link)
    db.commit()
    db.refresh(link)
    log_activity(db, current_user, "share_link_create", f"Created a secure link for {file_display_name(item)}", item.id)
    return {
        "id": link.id,
        "file_id": link.file_id,
        "share_url": build_share_url(token),
        "created_at": link.created_at,
        "expires_at": link.expires_at,
        "revoked_at": link.revoked_at,
        "max_downloads": link.max_downloads,
        "download_count": link.download_count,
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
        log_activity(db, current_user, "share_link_revoke", f"Revoked a secure link for {file_display_name(item)}", item.id)

    return {"message": "Secure link revoked"}


@router.get("/api/share-links/{token}")
def access_share_link(token: str, request: Request = None, db: Session = Depends(get_db)):
    if request is not None and (hasattr(request, "query") or not hasattr(request, "headers")):
        db = request
        request = None

    if request and hasattr(request, "headers"):
        forwarded = request.headers.get("x-forwarded-for")
        ip_address = forwarded.split(",")[0].strip() if forwarded else (request.client.host if getattr(request, "client", None) else "Unknown")
        user_agent = request.headers.get("user-agent")
    else:
        ip_address = _request_ip.get() if _request_ip else "Unknown"
        user_agent = _request_ua.get() if _request_ua else None

    token_hash = hash_share_token(token)
    link = db.query(SecureShareLink).filter(SecureShareLink.token_hash == token_hash).first()

    # 1. Non-existent or Revoked
    if not link or link.revoked_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Secure link is invalid")

    item = db.get(File, link.file_id)
    if not item or file_is_deleted(item):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Secure link is invalid")

    owner = db.get(User, item.owner_id)

    # 2. Expiration check (Log event for owner & record attempt)
    if link.expires_at is not None and link.expires_at <= datetime.utcnow():
        record_failed_file_access(db, item, ip_address=ip_address, user_agent=user_agent)
        if owner:
            log_activity(
                db, owner, "share_link_expired",
                f"Attempted access to expired secure link for '{file_display_name(item)}'",
                item.id,
                ip_address=ip_address,
                user_agent=user_agent,
            )
            create_notification(
                db=db,
                user_id=owner.id,
                type="link_expired",
                title="Link expired",
                message=f"Attempted access to expired secure link for '{file_display_name(item)}'.",
            )
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Secure link is invalid")

    # 3. Download Limit check (Log event for owner & record attempt)
    if link.max_downloads is not None and link.download_count >= link.max_downloads:
        record_failed_file_access(db, item, ip_address=ip_address, user_agent=user_agent)
        if owner:
            log_activity(
                db, owner, "download_limit_exceeded",
                f"Download limit ({link.max_downloads}) reached on secure link for '{file_display_name(item)}'",
                item.id,
                ip_address=ip_address,
                user_agent=user_agent,
            )
            create_notification(
                db=db,
                user_id=owner.id,
                type="security_alert",
                title="Download limit reached",
                message=f"Download limit ({link.max_downloads}) reached on secure link for '{file_display_name(item)}'.",
            )
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Download limit reached for this link")

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

    # 4. Increment count and log successful delivery for owner
    link.download_count += 1
    db.commit()

    if owner:
        count_display = f"({link.download_count}/{link.max_downloads})" if link.max_downloads else f"({link.download_count})"
        log_activity(
            db, owner, "share_link_download",
            f"File '{file_display_name(item)}' was downloaded via secure link {count_display}",
            item.id
        )
        create_notification(
            db=db,
            user_id=owner.id,
            type="download",
            title="File downloaded",
            message=f"'{file_display_name(item)}' was downloaded.",
        )

    filename = quote(Path(file_display_name(item)).name)
    return Response(
        content=content,
        media_type=file_display_type(item),
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{filename}"}
    )