import base64
import secrets
from datetime import datetime, timedelta, timezone
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.file_record import FileRecord
from app.models.share_link import ShareLink
from app.schemas.file import (
    ShareLinkCreate,
    ShareLinkOut,
    ShareEmailRequest,
)
from app.services.encryption_service import decrypt_bytes
from app.services.storage_service import get_storage_backend
from app.services.audit_service import log_action
from app.services.notification_service import notify, _send_email_smtp

router = APIRouter(prefix="/api", tags=["sharing"])


@router.post(
    "/files/{file_id}/share",
    response_model=ShareLinkOut,
    status_code=201,
)
def create_share_link(
    file_id: UUID,
    payload: ShareLinkCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    record = db.query(FileRecord).filter(
        FileRecord.id == file_id,
        FileRecord.owner_id == current_user.id,
    ).first()

    if not record:
        raise HTTPException(
            status_code=404,
            detail="File not found",
        )

    hours = (
        payload.expires_in_hours
        or settings.DEFAULT_SHARE_LINK_EXPIRY_HOURS
    )

    link = ShareLink(
        file_id=record.id,
        created_by_id=current_user.id,
        token=secrets.token_urlsafe(32),
        permission=payload.permission,
        max_downloads=payload.max_downloads,
        expires_at=datetime.now(timezone.utc)
        + timedelta(hours=hours),
    )

    db.add(link)
    db.commit()
    db.refresh(link)

    log_action(
        db,
        user_id=current_user.id,
        action="share.create",
        resource_type="share_link",
        resource_id=str(link.id),
        ip_address=(
            request.client.host
            if request.client
            else None
        ),
    )

    notify(
        db,
        current_user,
        type="file.shared",
        title="Share link created",
        message=(
            f'A "{payload.permission}" share link for '
            f'"{record.filename}" was created, '
            f"expiring in {hours}h."
        ),
    )

    db.commit()

    return link


@router.post("/files/{file_id}/share/email")
def share_file_via_email(
    file_id: UUID,
    payload: ShareEmailRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a download link and send it to an email address."""

    record = db.query(FileRecord).filter(
        FileRecord.id == file_id,
        FileRecord.owner_id == current_user.id,
    ).first()

    if not record:
        raise HTTPException(
            status_code=404,
            detail="File not found",
        )

    # Create a new download share link.
    link = ShareLink(
        file_id=record.id,
        created_by_id=current_user.id,
        token=secrets.token_urlsafe(32),
        permission="download",
        expires_at=datetime.now(timezone.utc)
        + timedelta(hours=24),
    )

    db.add(link)
    db.commit()
    db.refresh(link)

    # Build the share URL.
    base_url = str(request.base_url).rstrip("/")
    share_url = f"{base_url}/api/shared/{link.token}"

    subject = f"TrustShare: File shared - {record.filename}"

    body = (
        "Hello,\n\n"
        f"{current_user.email} has shared a file with you "
        "through TrustShare.\n\n"
        f"File name: {record.filename}\n"
        f"Download link: {share_url}\n\n"
        "This link will expire in 24 hours.\n\n"
        "Regards,\n"
        "TrustShare Team"
    )

    email_sent = _send_email_smtp(
        payload.recipient_email,
        subject,
        body,
    )

    if not email_sent:
        raise HTTPException(
            status_code=500,
            detail=(
                "Email could not be sent. "
                "Please check your SMTP settings."
            ),
        )

    log_action(
        db,
        user_id=current_user.id,
        action="share.email",
        resource_type="share_link",
        resource_id=str(link.id),
        ip_address=(
            request.client.host
            if request.client
            else None
        ),
        detail=(
            f"recipient_email={payload.recipient_email}"
        ),
    )

    db.commit()

    return {
        "message": "File-sharing email sent successfully",
        "recipient_email": payload.recipient_email,
    }


@router.get(
    "/files/{file_id}/shares",
    response_model=List[ShareLinkOut],
)
def list_share_links(
    file_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    record = db.query(FileRecord).filter(
        FileRecord.id == file_id,
        FileRecord.owner_id == current_user.id,
    ).first()

    if not record:
        raise HTTPException(
            status_code=404,
            detail="File not found",
        )

    return record.shares


@router.post(
    "/shares/{link_id}/revoke",
    status_code=204,
)
def revoke_share_link(
    link_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    link = db.query(ShareLink).filter(
        ShareLink.id == link_id
    ).first()

    if not link or link.created_by_id != current_user.id:
        raise HTTPException(
            status_code=404,
            detail="Share link not found",
        )

    link.revoked = True
    db.commit()

    log_action(
        db,
        user_id=current_user.id,
        action="share.revoke",
        resource_type="share_link",
        resource_id=str(link.id),
        ip_address=(
            request.client.host
            if request.client
            else None
        ),
    )

    db.commit()


# Public endpoints


@router.get("/shared/{token}/info")
def shared_file_info(
    token: str,
    db: Session = Depends(get_db),
):
    link = db.query(ShareLink).filter(
        ShareLink.token == token
    ).first()

    if not link or not link.is_valid():
        raise HTTPException(
            status_code=404,
            detail=(
                "This link is invalid, expired, or revoked"
            ),
        )

    record = link.file

    return {
        "filename": record.filename,
        "size_bytes": record.size_bytes,
        "permission": link.permission,
        "expires_at": link.expires_at,
        "downloads_used": link.download_count,
        "max_downloads": link.max_downloads,
    }


@router.get("/shared/{token}")
def access_shared_file(
    token: str,
    request: Request,
    db: Session = Depends(get_db),
):
    link = db.query(ShareLink).filter(
        ShareLink.token == token
    ).first()

    if not link or not link.is_valid():
        raise HTTPException(
            status_code=404,
            detail=(
                "This link is invalid, expired, or revoked"
            ),
        )

    if link.permission != "download":
        raise HTTPException(
            status_code=403,
            detail=(
                "This link only grants 'view' access. "
                "Use /api/shared/{token}/info to see file "
                "details, or ask the owner for a download link."
            ),
        )

    record = link.file
    storage = get_storage_backend()
    ciphertext = storage.load(record.storage_path)

    plaintext = decrypt_bytes(
        ciphertext,
        record.encrypted_key,
        base64.urlsafe_b64decode(record.file_nonce),
    )

    link.download_count += 1
    db.commit()

    ip = (
        request.client.host
        if request.client
        else None
    )

    log_action(
        db,
        user_id=None,
        action="share.access",
        resource_type="share_link",
        resource_id=str(link.id),
        ip_address=ip,
        detail=f"file_id={record.id}",
    )

    owner = db.query(User).filter(
        User.id == link.created_by_id
    ).first()

    if owner:
        notify(
            db,
            owner,
            type="share.accessed",
            title="Your shared file was downloaded",
            message=(
                f'"{record.filename}" was downloaded via '
                f"a share link ({link.download_count}"
                + (
                    f"/{link.max_downloads}"
                    if link.max_downloads
                    else ""
                )
                + f" downloads used). IP: {ip or 'unknown'}."
            ),
        )

    db.commit()

    def stream():
        yield plaintext

    return StreamingResponse(
        stream(),
        media_type="application/octet-stream",
        headers={
            "Content-Disposition": (
                f'attachment; filename="{record.filename}"'
            )
        },
    )