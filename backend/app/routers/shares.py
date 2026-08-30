"""
routers/shares.py – Public share recipient endpoints.

Routes:
  GET /share/{token}          – View shared file information & check validity
  GET /share/{token}/download – Download shared file securely with permission & expiry enforcement
"""

from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import FileResponse

from app.repositories import file_repo
from app.schemas import FileCategory, PublicShareOut, SharePermission
from app.services.file_service import get_file_storage_path

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
def get_public_share(token: str) -> PublicShareOut:
    result = file_repo.find_share_by_token(token)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shared link was not found or has expired.",
        )

    file_doc, share_doc = result

    expired = is_share_expired(share_doc)
    limit_reached = is_download_limit_reached(share_doc)

    if expired or limit_reached:
        reason = "link has expired" if expired else "download limit has been reached"
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
        expires_at=expires_at,
        is_expired=False,
    )


@router.get(
    "/{token}/download",
    summary="Download a shared file via public link",
    description="Streams the file if valid, not expired, and permissions allow downloads.",
)
def download_shared_file(token: str):
    result = file_repo.find_share_by_token(token)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shared link was not found or has expired.",
        )

    file_doc, share_doc = result

    # 1. Expiration check
    if is_share_expired(share_doc):
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="This shared link has expired.",
        )

    # 2. Limit check
    if is_download_limit_reached(share_doc):
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="The download limit for this link has been exceeded.",
        )

    # 3. Permission check
    permission = share_doc.get("permission")
    if permission == SharePermission.view_only.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This link has view-only permission; direct downloading is restricted.",
        )

    # 4. Storage check
    file_path = get_file_storage_path(file_doc["stored_name"])
    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File content not found in storage.",
        )

    # 5. Increment counter
    file_repo.increment_download_count(file_doc["id"], share_token=token)

    return FileResponse(
        path=str(file_path),
        filename=file_doc["original_name"],
        media_type=file_doc.get("content_type", "application/octet-stream"),
        headers={
            "Content-Disposition": f'attachment; filename="{file_doc["original_name"]}"',
            "X-Content-Type-Options": "nosniff",
        },
    )
