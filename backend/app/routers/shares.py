"""
routers/shares.py – Public share recipient endpoints with AES-256 decryption & access auditing.

Routes:
  GET /share/{token}          – View shared file information & check validity
  GET /share/{token}/download – Decrypt & download shared file securely with permission & expiry enforcement
"""

from datetime import datetime, timezone
import io
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import File, FileShare, User
from app.repositories import file_repo
from app.schemas import FileCategory, PublicShareOut, SharePermission
from app.services.audit_service import get_client_ip, get_user_agent, log_audit_event
from app.services.file_service import decrypt_and_retrieve_file
from app.services.notification_service import notify_file_downloaded
from app.services.security_service import (
    check_and_record_download,
    record_unauthorized_share_access,
)

router = APIRouter(prefix="/share", tags=["Public File Sharing"])


def is_share_expired(share_doc: dict) -> bool:
    """Check if share link has passed its expiration datetime."""
    expires_at_str = share_doc.get("expires_at")
    if not expires_at_str:
        return False
    expires_at = (
        datetime.fromisoformat(expires_at_str)
        if isinstance(expires_at_str, str)
        else expires_at_str
    )
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    return datetime.now(timezone.utc) > expires_at


def is_download_limit_reached(share_doc: dict) -> bool:
    """Check if max download quota has been exceeded."""
    max_d = share_doc.get("max_downloads")
    if max_d is not None and max_d > 0:
        curr_d = share_doc.get("download_count", 0)
        return curr_d >= max_d
    return False


@router.get(
    "/{token}",
    response_model=PublicShareOut,
    summary="Get public information for a shared file",
    description="Validates share token, checks expiration and permissions without revealing owner private data.",
)
def get_public_share(
    token: str,
    request: Request,
    db: Session = Depends(get_db),
) -> PublicShareOut:
    ip_addr = get_client_ip(request)
    ua = get_user_agent(request)
    result = file_repo.find_share_by_token(token, db=db)
    
    if not result:
        record_unauthorized_share_access(
            db=db,
            token=token,
            ip_address=ip_addr,
            user_agent=ua,
            reason="Token not found",
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shared link was not found or has expired.",
        )

    file_doc, share_doc = result
    sql_share = db.query(FileShare).filter(FileShare.share_token == token).first()

    if share_doc.get("is_revoked", False):
        record_unauthorized_share_access(
            db=db,
            token=token,
            ip_address=ip_addr,
            user_agent=ua,
            reason="Link revoked",
            share=sql_share,
        )
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="This shared link has been revoked by the owner.",
        )

    expired = is_share_expired(share_doc)
    limit_reached = is_download_limit_reached(share_doc)

    if expired or limit_reached:
        reason = "link has expired" if expired else "download limit has been reached"
        record_unauthorized_share_access(
            db=db,
            token=token,
            ip_address=ip_addr,
            user_agent=ua,
            reason=reason,
            share=sql_share,
        )
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail=f"This shared link is no longer accessible because the {reason}.",
        )

    expires_at = None
    if share_doc.get("expires_at"):
        exp_str = share_doc["expires_at"]
        expires_at = datetime.fromisoformat(exp_str) if isinstance(exp_str, str) else exp_str

    permission = SharePermission(share_doc.get("permission", SharePermission.can_download))
    can_download = permission == SharePermission.can_download

    upload_dt = file_doc.get("upload_date")
    if isinstance(upload_dt, str):
        upload_dt = datetime.fromisoformat(upload_dt)

    return PublicShareOut(
        file_id=file_doc["id"],
        original_name=file_doc["original_name"],
        file_size=file_doc["file_size"],
        content_type=file_doc.get("content_type", "application/octet-stream"),
        extension=file_doc["extension"],
        category=FileCategory(file_doc.get("category", "other")),
        upload_date=upload_dt,
        share_token=token,
        permission=permission,
        can_download=can_download,
        is_encrypted=True,
        encryption_algorithm="AES-256-GCM",
        expires_at=expires_at,
        is_expired=False,
    )


@router.get(
    "/{token}/download",
    summary="Download a shared file via public link with server-side decryption",
    description="Streams the file if valid, not expired, and permissions allow downloads.",
)
def download_shared_file(
    token: str,
    request: Request,
    db: Session = Depends(get_db),
):
    ip_addr = get_client_ip(request)
    ua = get_user_agent(request)
    result = file_repo.find_share_by_token(token, db=db)

    
    if not result:
        record_unauthorized_share_access(
            db=db,
            token=token,
            ip_address=ip_addr,
            user_agent=ua,
            reason="Download attempted on invalid token",
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shared link was not found or has expired.",
        )

    file_doc, share_doc = result
    sql_share = db.query(FileShare).filter(FileShare.share_token == token).first()

    # 1. Revocation check
    if share_doc.get("is_revoked", False):
        record_unauthorized_share_access(
            db=db,
            token=token,
            ip_address=ip_addr,
            user_agent=ua,
            reason="Download attempted on revoked token",
            share=sql_share,
        )
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="This shared link has been revoked.",
        )

    # 2. Expiration check
    if is_share_expired(share_doc):
        record_unauthorized_share_access(
            db=db,
            token=token,
            ip_address=ip_addr,
            user_agent=ua,
            reason="Download attempted on expired token",
            share=sql_share,
        )
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="This shared link has expired.",
        )

    # 3. Limit check
    if is_download_limit_reached(share_doc):
        record_unauthorized_share_access(
            db=db,
            token=token,
            ip_address=ip_addr,
            user_agent=ua,
            reason="Download limit reached",
            share=sql_share,
        )
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="The download limit for this link has been exceeded.",
        )

    # 4. Permission check
    permission = share_doc.get("permission")
    if permission == SharePermission.view_only.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This link has view-only permission; direct downloading is restricted.",
        )

    storage_key = file_doc.get("storage_key") or file_doc.get("stored_name")
    encrypted_dek = file_doc.get("encrypted_dek")
    nonce_hex = file_doc.get("nonce")

    # Legacy fallback
    if not encrypted_dek or not nonce_hex:
        from app.services.file_service import get_file_storage_path
        from fastapi.responses import FileResponse
        file_path = get_file_storage_path(storage_key)
        if not file_path.exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="File content not found in storage.",
            )
        file_repo.increment_download_count(file_doc["id"], share_token=token, db=db)
        return FileResponse(
            path=str(file_path),
            filename=file_doc["original_name"],
            media_type=file_doc.get("content_type", "application/octet-stream"),
            headers={
                "Content-Disposition": f'attachment; filename="{file_doc["original_name"]}"',
                "X-Content-Type-Options": "nosniff",
            },
        )

    # Server-side AES-256-GCM decryption
    decrypted_bytes = decrypt_and_retrieve_file(
        storage_key=storage_key,
        encrypted_dek=encrypted_dek,
        nonce_hex=nonce_hex,
    )

    # 5. Increment counter
    file_repo.increment_download_count(file_doc["id"], share_token=token, db=db)

    # 6. Audit log download
    numeric_fid = int(file_doc["id"]) if str(file_doc["id"]).isdigit() else None
    owner_id = file_doc.get("owner_id")
    log_audit_event(
        db=db,
        user_id=owner_id,
        action="public_download",
        file_id=numeric_fid,
        ip_address=ip_addr,
        user_agent=ua,
        details=f"Shared file '{file_doc['original_name']}' downloaded via token {token[:8]}...",
        status="success",
    )

    # 7. Notify file owner
    if owner_id:
        notify_file_downloaded(
            db=db,
            owner_id=owner_id,
            filename=file_doc["original_name"],
            downloader_info=f"Anonymous user (IP {ip_addr})",
        )

    # 8. Check download velocity
    check_and_record_download(
        db=db,
        user_id=owner_id,
        file_id=numeric_fid or 0,
        ip_address=ip_addr,
        user_agent=ua,
    )

    return StreamingResponse(
        io.BytesIO(decrypted_bytes),
        media_type=file_doc.get("content_type", "application/octet-stream"),
        headers={
            "Content-Disposition": f'attachment; filename="{file_doc["original_name"]}"',
            "Content-Length": str(len(decrypted_bytes)),
            "X-Content-Type-Options": "nosniff",
        },
    )
