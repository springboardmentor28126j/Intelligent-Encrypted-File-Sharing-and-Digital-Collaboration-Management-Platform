"""
routers/files.py – Secure file management API endpoints.

Routes:
  POST   /files/upload                     – Secure file upload with validation & hashing
  GET    /files                            – List user's files with search & category filters
  GET    /files/stats/summary              – Aggregate storage and share analytics
  GET    /files/{file_id}                  – Retrieve detailed file metadata
  GET    /files/{file_id}/download         – Download file with ownership check
  DELETE /files/{file_id}                  – Delete file and clean up storage/metadata
  POST   /files/{file_id}/share            – Generate secure share link with expiration
  DELETE /files/{file_id}/share/{token}    – Revoke a share link
"""

from datetime import datetime, timezone
import os
from typing import List, Optional

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    Request,
    UploadFile,
    status,
)
from fastapi.responses import FileResponse

from app.auth import get_current_user
from app.models import User, UserRole
from app.repositories import file_repo
from app.schemas import (
    FileCategory,
    FileMetadataOut,
    FileSummaryOut,
    MessageResponse,
    ShareLinkCreate,
    ShareLinkOut,
    StorageStatsOut,
)
from app.services.file_service import (
    calculate_expiration,
    generate_share_token,
    get_file_storage_path,
    remove_file_from_storage,
    save_uploaded_file,
    validate_file,
)
from app.services.redis_service import (
    cache_file_metadata,
    get_cached_file_metadata,
    invalidate_file_cache,
)

router = APIRouter(prefix="/files", tags=["Files"])


# ─── POST /files/upload ───────────────────────────────────────────────────────

@router.post(
    "/upload",
    response_model=FileMetadataOut,
    status_code=status.HTTP_201_CREATED,
    summary="Securely upload a file",
    description=(
        "Validates file format, restricts dangerous extensions, enforces size limit, "
        "calculates SHA-256 integrity hash, stores file securely, and records metadata in MongoDB."
    ),
)
async def upload_file(
    file: UploadFile = File(...),
    description: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
) -> FileMetadataOut:
    # 1. Validate file extension and security policies
    sanitized_name, extension, category = validate_file(file)

    # 2. Stream to disk, calculate hash, enforce max size
    file_id, stored_filename, file_size, sha256_hash = await save_uploaded_file(
        file=file,
        sanitized_name=sanitized_name,
        extension=extension,
    )

    # 3. Construct MongoDB file metadata document
    now = datetime.now(timezone.utc)
    file_doc = {
        "id": file_id,
        "original_name": sanitized_name,
        "stored_name": stored_filename,
        "file_size": file_size,
        "content_type": file.content_type or "application/octet-stream",
        "extension": extension,
        "category": category.value,
        "sha256_hash": sha256_hash,
        "owner_id": current_user.id,
        "owner_email": current_user.email,
        "description": description.strip() if description else None,
        "upload_date": now.isoformat(),
        "download_count": 0,
        "shares": [],
        "is_public": False,
    }

    # 4. Save metadata to MongoDB
    saved = file_repo.create_file(file_doc)

    # 5. Cache in Redis
    cache_file_metadata(file_id, saved)

    return FileMetadataOut(**saved)


# ─── GET /files ───────────────────────────────────────────────────────────────

@router.get(
    "",
    response_model=List[FileSummaryOut],
    summary="List uploaded files with search & category filtering",
    description="Returns files owned by the authenticated user (or all files if admin).",
)
def list_files(
    search: Optional[str] = Query(None, description="Search term for filename or description"),
    category: Optional[str] = Query(None, description="Filter by category (document, image, pdf, etc.)"),
    current_user: User = Depends(get_current_user),
) -> List[FileSummaryOut]:
    is_admin = current_user.role == UserRole.admin
    docs = file_repo.list_files(
        owner_id=current_user.id,
        search=search,
        category=category,
        is_admin=is_admin,
    )

    summaries = []
    for d in docs:
        shares = d.get("shares", [])
        summaries.append(
            FileSummaryOut(
                id=d["id"],
                original_name=d["original_name"],
                file_size=d["file_size"],
                content_type=d.get("content_type", "application/octet-stream"),
                extension=d["extension"],
                category=FileCategory(d.get("category", "other")),
                upload_date=datetime.fromisoformat(d["upload_date"]) if isinstance(d["upload_date"], str) else d["upload_date"],
                download_count=d.get("download_count", 0),
                shares_count=len(shares),
                owner_email=d["owner_email"],
                description=d.get("description"),
            )
        )
    return summaries


# ─── GET /files/stats/summary ─────────────────────────────────────────────────

@router.get(
    "/stats/summary",
    response_model=StorageStatsOut,
    summary="Get user storage metrics and share summary",
    description="Returns aggregate file counts, storage consumption, and active links.",
)
def get_file_stats(current_user: User = Depends(get_current_user)) -> StorageStatsOut:
    is_admin = current_user.role == UserRole.admin
    stats = file_repo.get_storage_stats(owner_id=current_user.id, is_admin=is_admin)
    return StorageStatsOut(**stats)


# ─── GET /files/{file_id} ─────────────────────────────────────────────────────

@router.get(
    "/{file_id}",
    response_model=FileMetadataOut,
    summary="Get full file metadata by ID",
    description="Returns detailed metadata including hash, size, and active share links.",
)
def get_file_details(
    file_id: str,
    current_user: User = Depends(get_current_user),
) -> FileMetadataOut:
    # Check cache first
    cached = get_cached_file_metadata(file_id)
    doc = cached or file_repo.get_file_by_id(file_id)

    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"File with ID '{file_id}' was not found.",
        )

    # Ownership check (unless admin)
    if doc["owner_id"] != current_user.id and current_user.role != UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: You do not have permission to view this file.",
        )

    if not cached:
        cache_file_metadata(file_id, doc)

    return FileMetadataOut(**doc)


# ─── GET /files/{file_id}/download ────────────────────────────────────────────

@router.get(
    "/{file_id}/download",
    summary="Securely download an owned file",
    description="Streams the file securely with appropriate headers and ownership verification.",
)
def download_file(
    file_id: str,
    current_user: User = Depends(get_current_user),
):
    doc = file_repo.get_file_by_id(file_id)
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"File with ID '{file_id}' was not found.",
        )

    # Ownership check
    if doc["owner_id"] != current_user.id and current_user.role != UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: You do not have permission to download this file.",
        )

    file_path = get_file_storage_path(doc["stored_name"])
    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Physical file was not found in storage.",
        )

    # Increment download count
    file_repo.increment_download_count(file_id)
    invalidate_file_cache(file_id)

    return FileResponse(
        path=str(file_path),
        filename=doc["original_name"],
        media_type=doc.get("content_type", "application/octet-stream"),
        headers={
            "Content-Disposition": f'attachment; filename="{doc["original_name"]}"',
            "X-Content-Type-Options": "nosniff",
        },
    )


# ─── DELETE /files/{file_id} ──────────────────────────────────────────────────

@router.delete(
    "/{file_id}",
    response_model=MessageResponse,
    summary="Delete a file permanently",
    description="Deletes file from storage disk and removes metadata from MongoDB.",
)
def delete_file(
    file_id: str,
    current_user: User = Depends(get_current_user),
) -> MessageResponse:
    doc = file_repo.get_file_by_id(file_id)
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"File with ID '{file_id}' was not found.",
        )

    # Ownership check
    if doc["owner_id"] != current_user.id and current_user.role != UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: You do not have permission to delete this file.",
        )

    # Remove from physical disk
    remove_file_from_storage(doc["stored_name"])

    # Remove from MongoDB
    file_repo.delete_file(file_id)

    # Invalidate Redis cache
    invalidate_file_cache(file_id)

    return MessageResponse(message=f"File '{doc['original_name']}' was permanently deleted.")


# ─── POST /files/{file_id}/share ──────────────────────────────────────────────

@router.post(
    "/{file_id}/share",
    response_model=ShareLinkOut,
    status_code=status.HTTP_201_CREATED,
    summary="Generate a secure share link",
    description="Creates a shareable link with configurable expiration and access permissions.",
)
def create_share_link(
    file_id: str,
    payload: ShareLinkCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
) -> ShareLinkOut:
    doc = file_repo.get_file_by_id(file_id)
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"File with ID '{file_id}' was not found.",
        )

    # Ownership check
    if doc["owner_id"] != current_user.id and current_user.role != UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: You do not have permission to share this file.",
        )

    share_token = generate_share_token()
    expires_at = calculate_expiration(payload.duration, payload.custom_expires_at)
    now = datetime.now(timezone.utc)

    share_url = f"/share/{share_token}"

    share_doc = {
        "share_token": share_token,
        "share_url": share_url,
        "permission": payload.permission.value,
        "expires_at": expires_at.isoformat() if expires_at else None,
        "max_downloads": payload.max_downloads,
        "download_count": 0,
        "created_at": now.isoformat(),
        "created_by": current_user.id,
    }

    file_repo.add_share_link(file_id, share_doc)
    invalidate_file_cache(file_id)

    return ShareLinkOut(
        share_token=share_token,
        share_url=share_url,
        permission=payload.permission,
        expires_at=expires_at,
        max_downloads=payload.max_downloads,
        download_count=0,
        created_at=now,
        is_expired=False,
    )


# ─── DELETE /files/{file_id}/share/{share_token} ──────────────────────────────

@router.delete(
    "/{file_id}/share/{share_token}",
    response_model=MessageResponse,
    summary="Revoke an active share link",
    description="Invalidates a shared link so it can no longer be accessed.",
)
def revoke_share(
    file_id: str,
    share_token: str,
    current_user: User = Depends(get_current_user),
) -> MessageResponse:
    doc = file_repo.get_file_by_id(file_id)
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"File with ID '{file_id}' was not found.",
        )

    # Ownership check
    if doc["owner_id"] != current_user.id and current_user.role != UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: You do not have permission to manage shares for this file.",
        )

    success = file_repo.revoke_share_link(file_id, share_token)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Share link was not found or has already been revoked.",
        )

    invalidate_file_cache(file_id)
    return MessageResponse(message="Share link successfully revoked.")
