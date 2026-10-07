"""
routers/files.py – Secure file management API endpoints with AES-256-GCM encryption & retrieval.

Routes:
  POST   /files/upload                         – Secure file upload with AES-256 encryption & storage
  GET    /files                                – List user's files with search & category filters
  GET    /files/stats/summary                  – Aggregate storage, security, and share analytics
  GET    /files/shared-with-me                 – List files shared with the current authenticated user
  GET    /files/shared-with-me/{share_id}/download – Download a file shared with the current user
  GET    /files/{file_id}                      – Retrieve detailed file metadata (keys omitted)
  GET    /files/{file_id}/download             – Decrypt & download owned file securely
  DELETE /files/{file_id}                      – Delete file permanently from storage and databases
  POST   /files/{file_id}/share                – Generate secure share link with expiration
  POST   /files/{file_id}/share-user           – Share file directly with another registered user
  DELETE /files/{file_id}/share/{token}        – Revoke a share link
"""

from datetime import datetime, timezone
import io
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
    Response,
    UploadFile,
    status,
)
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.config import settings
from app.database import get_db
from app.models import User, UserRole, SharePermission, FileShare as SQLFileShare
from app.repositories import file_repo
from app.schemas import (
    FileCategory,
    FileMetadataOut,
    FileSummaryOut,
    MessageResponse,
    ShareLinkCreate,
    ShareLinkOut,
    SharedWithMeOut,
    StorageStatsOut,
    UserShareCreate,
)
from app.services.audit_service import get_client_ip, get_user_agent, log_audit_event
from app.services.email_service import send_file_shared_email
from app.services.file_service import (
    calculate_expiration,
    decrypt_and_retrieve_file,
    generate_share_token,
    remove_file_from_storage,
    save_uploaded_file,
    validate_file,
)
from app.services.notification_service import notify_file_downloaded, notify_file_shared
from app.services.redis_service import (
    cache_file_metadata,
    get_cached_file_metadata,
    invalidate_file_cache,
)
from app.services.security_service import check_and_record_download, record_unauthorized_access
from app.services.storage_service import storage_backend

router = APIRouter(prefix="/files", tags=["Files"])



# ─── POST /files/upload ───────────────────────────────────────────────────────

@router.post(
    "/upload",
    response_model=FileMetadataOut,
    status_code=status.HTTP_201_CREATED,
    summary="Securely upload and AES-256 encrypt a file",
    description=(
        "Validates format, enforces size limit, generates unique per-file DEK, "
        "encrypts with AES-256-GCM, protects DEK via Envelope Encryption, "
        "persists ONLY ciphertext to cloud/object storage, and records metadata."
    ),
)
async def upload_file(
    request: Request,
    file: UploadFile = File(...),
    description: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FileMetadataOut:
    # 1. Validate file format and security rules
    sanitized_name, extension, category = validate_file(file)

    # 2. Encrypt with AES-256-GCM and store ONLY ciphertext
    (
        file_id,
        storage_key,
        file_size,
        sha256_hash,
        encrypted_dek,
        nonce_hex,
    ) = await save_uploaded_file(
        file=file,
        sanitized_name=sanitized_name,
        extension=extension,
    )

    now = datetime.now(timezone.utc)
    backend_name = storage_backend.backend_name

    file_doc = {
        "id": file_id,
        "original_name": sanitized_name,
        "stored_name": storage_key,
        "storage_key": storage_key,
        "storage_backend": backend_name,
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
        "encryption_algorithm": "AES-256-GCM",
        "encrypted_dek": encrypted_dek,
        "nonce": nonce_hex,
    }

    # 3. Save metadata to PostgreSQL & MongoDB
    saved = file_repo.create_file(file_doc, db=db)

    # 4. Cache metadata in Redis (keys excluded from client models)
    cache_file_metadata(file_id, saved)

    # 5. Log audit event
    numeric_fid = int(file_id) if str(file_id).isdigit() else None
    log_audit_event(
        db=db,
        user_id=current_user.id,
        action="upload",
        file_id=numeric_fid,
        request=request,
        details=f"Uploaded & encrypted '{sanitized_name}' ({round(file_size/1024, 1)} KB) using AES-256-GCM [{backend_name}]",
        status="success",
    )

    return FileMetadataOut(
        id=saved["id"],
        original_name=saved["original_name"],
        stored_name=saved["stored_name"],
        file_size=saved["file_size"],
        content_type=saved["content_type"],
        extension=saved["extension"],
        category=FileCategory(saved["category"]),
        sha256_hash=saved["sha256_hash"],
        owner_id=saved["owner_id"],
        owner_email=saved["owner_email"],
        description=saved.get("description"),
        upload_date=datetime.fromisoformat(saved["upload_date"]) if isinstance(saved["upload_date"], str) else saved["upload_date"],
        download_count=saved.get("download_count", 0),
        shares=[],
        is_public=saved.get("is_public", False),
        is_encrypted=True,
        encryption_algorithm="AES-256-GCM",
        storage_backend=backend_name,
    )


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
    db: Session = Depends(get_db),
) -> List[FileSummaryOut]:
    is_admin = current_user.role == UserRole.admin
    docs = file_repo.list_files(
        owner_id=current_user.id,
        search=search,
        category=category,
        is_admin=is_admin,
        db=db,
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
                is_encrypted=True,
                encryption_algorithm=d.get("encryption_algorithm", "AES-256-GCM"),
                storage_backend=d.get("storage_backend", "local"),
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
def get_file_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StorageStatsOut:
    is_admin = current_user.role == UserRole.admin
    stats = file_repo.get_storage_stats(owner_id=current_user.id, is_admin=is_admin, db=db)
    return StorageStatsOut(**stats)


# ─── GET /files/shared-with-me ────────────────────────────────────────────────

@router.get(
    "/shared-with-me",
    response_model=List[SharedWithMeOut],
    summary="List files shared directly with the current user",
    description="Returns all files that other users have shared with the authenticated user.",
)
def get_shared_with_me(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[SharedWithMeOut]:
    items = file_repo.list_shared_with_user(
        user_email=current_user.email,
        user_id=current_user.id,
        db=db,
    )
    result = []
    for item in items:
        exp_dt = None
        if item.get("expires_at"):
            exp_dt = datetime.fromisoformat(item["expires_at"]) if isinstance(item["expires_at"], str) else item["expires_at"]

        result.append(
            SharedWithMeOut(
                share_id=item["share_id"],
                file_id=item["file_id"],
                original_name=item["original_name"],
                file_size=item["file_size"],
                content_type=item["content_type"],
                extension=item["extension"],
                category=FileCategory(item["category"]),
                owner_email=item["owner_email"],
                permission=SharePermission(item["permission"]),
                can_download=item["can_download"],
                expires_at=exp_dt,
                created_at=datetime.fromisoformat(item["created_at"]) if isinstance(item["created_at"], str) else item["created_at"],
                is_expired=item["is_expired"],
            )
        )
    return result


# ─── GET /files/shared-with-me/{share_id}/download ────────────────────────────

@router.get(
    "/shared-with-me/{share_id}/download",
    summary="Download a file shared directly with current user",
    description="Validates access permission and expiration, then decrypts and streams the file securely.",
)
def download_shared_with_me_file(
    share_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ip_addr = get_client_ip(request)
    ua = get_user_agent(request)
    share = db.query(SQLFileShare).filter(SQLFileShare.id == share_id).first()
    if not share or share.is_revoked:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shared file grant was not found or has been revoked.",
        )

    # Validate recipient identity
    if share.recipient_id != current_user.id and (
        not share.recipient_email or share.recipient_email.lower() != current_user.email.lower()
    ) and current_user.role != UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: You are not authorized to access this shared file.",
        )

    # Check expiration
    if share.expires_at:
        exp = share.expires_at if share.expires_at.tzinfo else share.expires_at.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) > exp:
            raise HTTPException(
                status_code=status.HTTP_410_GONE,
                detail="This share grant has expired.",
            )

    # Check permission
    if share.permission == SharePermission.view_only:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This file is shared with 'view_only' permissions. Direct downloading is restricted.",
        )

    file_obj = share.file
    if not file_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Underlying file record was not found.",
        )

    # Server-Side Decryption
    decrypted_bytes = decrypt_and_retrieve_file(
        storage_key=file_obj.storage_key,
        encrypted_dek=file_obj.encrypted_dek,
        nonce_hex=file_obj.nonce,
    )

    # Increment download count
    file_repo.increment_download_count(file_obj.id, share_token=share.share_token, db=db)

    # Audit log & notifications
    log_audit_event(
        db=db,
        user_id=current_user.id,
        action="download",
        file_id=file_obj.id,
        ip_address=ip_addr,
        user_agent=ua,
        details=f"Downloaded directly shared file '{file_obj.original_name}' (owned by {share.owner.email if share.owner else 'unknown'})",
        status="success",
    )

    if share.owner_id:
        notify_file_downloaded(
            db=db,
            owner_id=share.owner_id,
            filename=file_obj.original_name,
            downloader_info=current_user.email,
        )

    check_and_record_download(
        db=db,
        user_id=current_user.id,
        file_id=file_obj.id,
        ip_address=ip_addr,
        user_agent=ua,
    )

    return StreamingResponse(
        io.BytesIO(decrypted_bytes),
        media_type=file_obj.content_type or "application/octet-stream",
        headers={
            "Content-Disposition": f'attachment; filename="{file_obj.original_name}"',
            "Content-Length": str(len(decrypted_bytes)),
            "X-Content-Type-Options": "nosniff",
        },
    )


# ─── GET /files/{file_id} ─────────────────────────────────────────────────────

@router.get(
    "/{file_id}",
    response_model=FileMetadataOut,
    summary="Get full file metadata by ID",
    description="Returns detailed metadata including hash, size, and active share links (omits keys).",
)
def get_file_details(
    file_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FileMetadataOut:
    cached = get_cached_file_metadata(file_id)
    doc = cached or file_repo.get_file_by_id(file_id, db=db)

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

    # Format shares list
    shares_out = []
    for s in doc.get("shares", []):
        exp_dt = None
        if s.get("expires_at"):
            exp_dt = datetime.fromisoformat(s["expires_at"]) if isinstance(s["expires_at"], str) else s["expires_at"]
        created_dt = s.get("created_at")
        if isinstance(created_dt, str):
            created_dt = datetime.fromisoformat(created_dt)
        elif not created_dt:
            created_dt = datetime.now(timezone.utc)

        shares_out.append(
            ShareLinkOut(
                id=s.get("id"),
                share_token=s["share_token"],
                share_url=s.get("share_url", f"/share/{s['share_token']}"),
                permission=SharePermission(s.get("permission", "can_download")),
                recipient_email=s.get("recipient_email"),
                expires_at=exp_dt,
                max_downloads=s.get("max_downloads"),
                download_count=s.get("download_count", 0),
                created_at=created_dt,
                is_expired=s.get("is_expired", False),
                is_revoked=s.get("is_revoked", False),
            )
        )

    upload_dt = doc.get("upload_date")
    if isinstance(upload_dt, str):
        upload_dt = datetime.fromisoformat(upload_dt)

    return FileMetadataOut(
        id=doc["id"],
        original_name=doc["original_name"],
        stored_name=doc.get("stored_name", doc.get("storage_key", "")),
        file_size=doc["file_size"],
        content_type=doc.get("content_type", "application/octet-stream"),
        extension=doc["extension"],
        category=FileCategory(doc.get("category", "other")),
        sha256_hash=doc["sha256_hash"],
        owner_id=doc["owner_id"],
        owner_email=doc.get("owner_email", ""),
        description=doc.get("description"),
        upload_date=upload_dt,
        download_count=doc.get("download_count", 0),
        shares=shares_out,
        is_public=doc.get("is_public", False),
        is_encrypted=True,
        encryption_algorithm=doc.get("encryption_algorithm", "AES-256-GCM"),
        storage_backend=doc.get("storage_backend", "local"),
    )


# ─── GET /files/{file_id}/download ────────────────────────────────────────────

@router.get(
    "/{file_id}/download",
    summary="Securely decrypt and download an owned file",
    description="Verifies ownership, retrieves ciphertext from object storage, decrypts server-side with AES-256-GCM, and streams plaintext.",
)
def download_file(
    file_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ip_addr = get_client_ip(request)
    ua = get_user_agent(request)
    doc = file_repo.get_file_by_id(file_id, db=db)
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"File with ID '{file_id}' was not found.",
        )

    # Ownership check
    if doc["owner_id"] != current_user.id and current_user.role != UserRole.admin:
        numeric_fid = int(file_id) if str(file_id).isdigit() else None
        record_unauthorized_access(
            db=db,
            user_id=current_user.id,
            file_id=numeric_fid,
            ip_address=ip_addr,
            reason=f"User {current_user.email} attempted to download private file '{doc.get('original_name')}' owned by user ID {doc['owner_id']}",
            user_agent=ua,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: You do not have permission to download this file.",
        )

    storage_key = doc.get("storage_key") or doc.get("stored_name")
    encrypted_dek = doc.get("encrypted_dek")
    nonce_hex = doc.get("nonce")

    # If legacy unencrypted file exists on disk (Milestone 1 fallback)
    if not encrypted_dek or not nonce_hex:
        from app.services.file_service import get_file_storage_path
        file_path = get_file_storage_path(storage_key)
        if file_path.exists():
            file_repo.increment_download_count(file_id, db=db)
            from fastapi.responses import FileResponse
            return FileResponse(
                path=str(file_path),
                filename=doc["original_name"],
                media_type=doc.get("content_type", "application/octet-stream"),
                headers={
                    "Content-Disposition": f'attachment; filename="{doc["original_name"]}"',
                    "X-Content-Type-Options": "nosniff",
                },
            )

    # Server-Side Decryption Workflow
    decrypted_bytes = decrypt_and_retrieve_file(
        storage_key=storage_key,
        encrypted_dek=encrypted_dek,
        nonce_hex=nonce_hex,
    )

    # Increment download counter & invalidate cache
    file_repo.increment_download_count(file_id, db=db)
    invalidate_file_cache(file_id)

    # Audit log & check download burst
    numeric_fid = int(file_id) if str(file_id).isdigit() else None
    log_audit_event(
        db=db,
        user_id=current_user.id,
        action="download",
        file_id=numeric_fid,
        ip_address=ip_addr,
        user_agent=ua,
        details=f"Downloaded file '{doc['original_name']}'",
        status="success",
    )

    check_and_record_download(
        db=db,
        user_id=current_user.id,
        file_id=numeric_fid or 0,
        ip_address=ip_addr,
        user_agent=ua,
    )

    return StreamingResponse(
        io.BytesIO(decrypted_bytes),
        media_type=doc.get("content_type", "application/octet-stream"),
        headers={
            "Content-Disposition": f'attachment; filename="{doc["original_name"]}"',
            "Content-Length": str(len(decrypted_bytes)),
            "X-Content-Type-Options": "nosniff",
        },
    )


# ─── DELETE /files/{file_id} ──────────────────────────────────────────────────

@router.delete(
    "/{file_id}",
    response_model=MessageResponse,
    summary="Delete a file permanently",
    description="Deletes encrypted object from storage and removes metadata from databases.",
)
def delete_file(
    file_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageResponse:
    doc = file_repo.get_file_by_id(file_id, db=db)
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

    # Remove ciphertext from storage
    storage_key = doc.get("storage_key") or doc.get("stored_name")
    remove_file_from_storage(storage_key)

    # Remove metadata
    file_repo.delete_file(file_id, db=db)
    invalidate_file_cache(file_id)

    # Audit log deletion
    numeric_fid = int(file_id) if str(file_id).isdigit() else None
    log_audit_event(
        db=db,
        user_id=current_user.id,
        action="delete",
        file_id=numeric_fid,
        request=request,
        details=f"Permanently deleted file '{doc['original_name']}' and its ciphertext object",
        status="success",
    )

    return MessageResponse(message=f"File '{doc['original_name']}' was permanently deleted.")


# ─── POST /files/{file_id}/share ──────────────────────────────────────────────

@router.post(
    "/{file_id}/share",
    response_model=ShareLinkOut,
    status_code=status.HTTP_201_CREATED,
    summary="Generate a secure temporary share link",
    description="Creates a shareable link with configurable expiration and access permissions.",
)
def create_share_link(
    file_id: str,
    payload: ShareLinkCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ShareLinkOut:
    doc = file_repo.get_file_by_id(file_id, db=db)
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
        "recipient_email": str(payload.recipient_email) if payload.recipient_email else None,
    }

    file_repo.add_share_link(file_id, share_doc, db=db)
    invalidate_file_cache(file_id)

    # Deliver email if recipient_email was entered
    email_sent = None
    email_status = None
    if payload.recipient_email:
        rec_email_clean = str(payload.recipient_email).strip().lower()
        frontend_base = getattr(settings, "FRONTEND_URL", "http://localhost:3000").rstrip("/")
        full_share_url = f"{frontend_base}/share/{share_token}"
        
        delivery = send_file_shared_email(
            to_email=rec_email_clean,
            sender_email=current_user.email,
            filename=doc["original_name"],
            share_url=full_share_url,
            permission=payload.permission.value,
            expires_at=expires_at,
            file_size=doc.get("file_size", 0),
        )
        email_sent = delivery.success
        email_status = f"Sent via {delivery.provider}" if delivery.success else f"Delivery error: {delivery.error}"

    # Audit log share creation
    numeric_fid = int(file_id) if str(file_id).isdigit() else None
    log_audit_event(
        db=db,
        user_id=current_user.id,
        action="share",
        file_id=numeric_fid,
        request=request,
        details=f"Created share link for '{doc['original_name']}' (expires: {expires_at.strftime('%Y-%m-%d %H:%M') if expires_at else 'Never'})" + (f" | Email to: {payload.recipient_email} [{email_status}]" if payload.recipient_email else ""),
        status="success",
    )

    return ShareLinkOut(
        id=share_doc.get("id"),
        share_token=share_token,
        share_url=share_url,
        permission=payload.permission,
        recipient_email=str(payload.recipient_email) if payload.recipient_email else None,
        expires_at=expires_at,
        max_downloads=payload.max_downloads,
        download_count=0,
        created_at=now,
        is_expired=False,
        email_sent=email_sent,
        email_status=email_status,
    )


# ─── POST /files/{file_id}/share-user ─────────────────────────────────────────

@router.post(
    "/{file_id}/share-user",
    response_model=ShareLinkOut,
    status_code=status.HTTP_201_CREATED,
    summary="Share file directly with another registered user",
    description="Grants view or download access to another registered user by email address and delivers notification email.",
)
def share_file_with_user(
    file_id: str,
    payload: UserShareCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ShareLinkOut:
    doc = file_repo.get_file_by_id(file_id, db=db)
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"File with ID '{file_id}' was not found.",
        )

    if doc["owner_id"] != current_user.id and current_user.role != UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: You do not have permission to share this file.",
        )

    recipient_email = str(payload.recipient_email).lower().strip()
    if recipient_email == current_user.email.lower():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot share a file with yourself.",
        )

    share_token = generate_share_token()
    expires_at = calculate_expiration(payload.duration, payload.custom_expires_at)
    now = datetime.now(timezone.utc)

    share_doc = {
        "share_token": share_token,
        "share_url": f"/share/{share_token}",
        "permission": payload.permission.value,
        "expires_at": expires_at.isoformat() if expires_at else None,
        "max_downloads": None,
        "download_count": 0,
        "created_at": now.isoformat(),
        "created_by": current_user.id,
        "recipient_email": recipient_email,
    }

    file_repo.add_share_link(file_id, share_doc, db=db)
    invalidate_file_cache(file_id)

    # Deliver email notification to recipient
    frontend_base = getattr(settings, "FRONTEND_URL", "http://localhost:3000").rstrip("/")
    full_share_url = f"{frontend_base}/share/{share_token}"
    delivery = send_file_shared_email(
        to_email=recipient_email,
        sender_email=current_user.email,
        filename=doc["original_name"],
        share_url=full_share_url,
        permission=payload.permission.value,
        expires_at=expires_at,
        file_size=doc.get("file_size", 0),
    )

    # In-app notification if recipient is registered
    recipient_user = db.query(User).filter(User.email == recipient_email).first()
    if recipient_user:
        notify_file_shared(
            db=db,
            recipient_id=recipient_user.id,
            sender_email=current_user.email,
            filename=doc["original_name"],
            link_url=f"/share/{share_token}",
        )

    # Audit log direct share
    numeric_fid = int(file_id) if str(file_id).isdigit() else None
    log_audit_event(
        db=db,
        user_id=current_user.id,
        action="direct_share",
        file_id=numeric_fid,
        request=request,
        details=f"Shared '{doc['original_name']}' directly with user '{recipient_email}' (Email: {delivery.provider}, Success: {delivery.success})",
        status="success",
    )

    return ShareLinkOut(
        id=share_doc.get("id"),
        share_token=share_token,
        share_url=f"/share/{share_token}",
        permission=payload.permission,
        recipient_email=recipient_email,
        expires_at=expires_at,
        max_downloads=None,
        download_count=0,
        created_at=now,
        is_expired=False,
        email_sent=delivery.success,
        email_status=f"Sent via {delivery.provider}" if delivery.success else f"Delivery error: {delivery.error}",
    )



# ─── DELETE /files/{file_id}/share/{share_token} ──────────────────────────────

@router.delete(
    "/{file_id}/share/{share_token}",
    response_model=MessageResponse,
    summary="Revoke an active share link or user grant",
    description="Invalidates a shared link so it can no longer be accessed.",
)
def revoke_share(
    file_id: str,
    share_token: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageResponse:
    doc = file_repo.get_file_by_id(file_id, db=db)
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

    file_repo.revoke_share_link(file_id, share_token, db=db)
    invalidate_file_cache(file_id)

    # Audit log revoke share
    numeric_fid = int(file_id) if str(file_id).isdigit() else None
    log_audit_event(
        db=db,
        user_id=current_user.id,
        action="revoke_share",
        file_id=numeric_fid,
        request=request,
        details=f"Revoked share link {share_token[:8]}... for file '{doc['original_name']}'",
        status="success",
    )

    return MessageResponse(message="Share link successfully revoked.")

