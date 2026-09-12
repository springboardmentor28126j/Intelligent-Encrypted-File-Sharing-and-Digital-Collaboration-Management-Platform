from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import List, Optional
import uuid
from datetime import datetime, timedelta, timezone

from app.db.database import get_db
from app.db.models import User, FileModel, SharedLink, ShareActivityLog
from app.core.deps import get_current_user
from app.schemas.share import SharedLinkCreate, SharedLinkResponse, ShareActivityLogResponse, SharedLinkUpdate, UserFileAccessUpdate

router = APIRouter(prefix="/share", tags=["Share"])

@router.post("/create", response_model=SharedLinkResponse)
def create_shared_link(
    data: SharedLinkCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify file ownership
    file_record = db.query(FileModel).filter(FileModel.id == data.file_id, FileModel.owner_id == current_user.id).first()
    if not file_record:
        raise HTTPException(status_code=404, detail="File not found")

    expires_at = None
    if data.expires_in_hours:
        expires_at = datetime.now(timezone.utc) + timedelta(hours=data.expires_in_hours)

    new_link = SharedLink(
        file_id=data.file_id,
        owner_id=current_user.id,
        token=str(uuid.uuid4()),
        permission=data.permission,
        expires_at=expires_at,
        max_downloads=data.max_downloads,
        shared_to=data.shared_to
    )
    db.add(new_link)
    db.commit()
    db.refresh(new_link)

    response = SharedLinkResponse.from_orm(new_link)
    response.file_name = file_record.original_filename
    response.shared_to = new_link.shared_to
    return response

@router.get("/list", response_model=List[SharedLinkResponse])
def list_shared_links(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    links = db.query(SharedLink).filter(SharedLink.owner_id == current_user.id).order_by(SharedLink.created_at.desc()).all()
    results = []
    for link in links:
        res = SharedLinkResponse.from_orm(link)
        res.file_name = link.file.original_filename if link.file else "Unknown"
        res.shared_to = link.shared_to
        res.user_file_access_id = link.user_file_access_id
        res.share_type = "user" if link.user_file_access_id else "public"
        results.append(res)
    return results

@router.put("/update/{link_id}", response_model=SharedLinkResponse)
def update_link(
    link_id: int,
    data: SharedLinkUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    link = db.query(SharedLink).filter(SharedLink.id == link_id, SharedLink.owner_id == current_user.id).first()
    if not link:
        raise HTTPException(status_code=404, detail="Link not found")
    
    if data.permission is not None:
        link.permission = data.permission
        # If this link is linked to a user-to-user share, keep UserFileAccess in sync
        if link.user_file_access_id:
            user_access = db.query(UserFileAccess).filter(UserFileAccess.id == link.user_file_access_id).first()
            if user_access:
                user_access.permission = data.permission
    if data.is_active is not None:
        link.is_active = data.is_active
    if data.shared_to is not None:
        link.shared_to = data.shared_to
        
    db.commit()
    db.refresh(link)
    
    res = SharedLinkResponse.from_orm(link)
    res.file_name = link.file.original_filename if link.file else "Unknown"
    res.shared_to = link.shared_to
    res.user_file_access_id = link.user_file_access_id
    res.share_type = "user" if link.user_file_access_id else "public"
    return res

@router.delete("/revoke/{link_id}")
def revoke_link(
    link_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    link = db.query(SharedLink).filter(SharedLink.id == link_id, SharedLink.owner_id == current_user.id).first()
    if not link:
        raise HTTPException(status_code=404, detail="Link not found")
    
    # If this link is linked to a user-to-user share, revoke UserFileAccess as well
    if link.user_file_access_id:
        user_access = db.query(UserFileAccess).filter(UserFileAccess.id == link.user_file_access_id).first()
        if user_access:
            db.delete(user_access)

    db.delete(link)
    db.commit()
    return {"message": "Link revoked successfully"}

@router.get("/logs/{link_id}", response_model=List[ShareActivityLogResponse])
def get_link_logs(
    link_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    link = db.query(SharedLink).filter(SharedLink.id == link_id, SharedLink.owner_id == current_user.id).first()
    if not link:
        raise HTTPException(status_code=404, detail="Link not found")
    return link.activity_logs

@router.get("/public/{token}")
def get_public_file(token: str, request: Request, db: Session = Depends(get_db)):
    link = db.query(SharedLink).filter(SharedLink.token == token, SharedLink.is_active == True).first()
    
    if not link:
        raise HTTPException(status_code=404, detail="Link invalid or revoked")
    
    # Check expiry (handle both timezone aware and naive)
    if link.expires_at:
        now = datetime.now(timezone.utc)
        link_expiry = link.expires_at
        if link_expiry.tzinfo is None:
            link_expiry = link_expiry.replace(tzinfo=timezone.utc)
        if now > link_expiry:
            raise HTTPException(status_code=403, detail="Link expired")

    # Log access
    log = ShareActivityLog(
        link_id=link.id,
        action="viewed",
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent")
    )
    db.add(log)
    db.commit()

    return {
        "file_name": link.file.original_filename,
        "file_size": link.file.file_size,
        "permission": link.permission,
        "uploaded_at": link.file.uploaded_at,
        "file_type": link.file.file_type,
        "shared_to": link.shared_to
    }

from fastapi.responses import FileResponse, RedirectResponse
import os
from app.core.supabase_client import get_signed_url

@router.get("/public/{token}/preview")
def preview_public_file(token: str, request: Request, db: Session = Depends(get_db)):
    link = db.query(SharedLink).filter(SharedLink.token == token, SharedLink.is_active == True).first()
    
    if not link:
        raise HTTPException(status_code=404, detail="Link invalid or revoked")
    
    if link.expires_at:
        now = datetime.now(timezone.utc)
        link_expiry = link.expires_at
        if link_expiry.tzinfo is None:
            link_expiry = link_expiry.replace(tzinfo=timezone.utc)
        if now > link_expiry:
            raise HTTPException(status_code=403, detail="Link expired")

    # Log access for preview
    log = ShareActivityLog(
        link_id=link.id,
        action="previewed",
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent")
    )
    db.add(log)
    db.commit()

    try:
        url = get_signed_url(link.file.file_path, expires_in=3600)
        return RedirectResponse(url)
    except Exception as e:
        if os.path.exists(link.file.file_path):
            return FileResponse(
                path=link.file.file_path, 
                filename=link.file.original_filename,
                media_type=link.file.file_type
            )
        raise HTTPException(status_code=500, detail=f"Failed to generate file preview: {str(e)}")

@router.get("/public/{token}/download")
def download_public_file(token: str, request: Request, db: Session = Depends(get_db)):
    link = db.query(SharedLink).filter(SharedLink.token == token, SharedLink.is_active == True).first()
    
    if not link:
        raise HTTPException(status_code=404, detail="Link invalid or revoked")
    
    if link.permission != "can_download":
        raise HTTPException(status_code=403, detail="You do not have permission to download this file")
        
    if link.expires_at:
        now = datetime.now(timezone.utc)
        link_expiry = link.expires_at
        if link_expiry.tzinfo is None:
            link_expiry = link_expiry.replace(tzinfo=timezone.utc)
        if now > link_expiry:
            raise HTTPException(status_code=403, detail="Link expired")

    # Log download
    log = ShareActivityLog(
        link_id=link.id,
        action="downloaded",
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent")
    )
    db.add(log)
    db.commit()

    try:
        url = get_signed_url(link.file.file_path, expires_in=3600)
        return RedirectResponse(url)
    except Exception as e:
        if os.path.exists(link.file.file_path):
            return FileResponse(path=link.file.file_path, filename=link.file.original_filename)
        raise HTTPException(status_code=500, detail=f"Failed to download file: {str(e)}")

from app.schemas.share import UserFileAccessCreate, UserFileAccessResponse
from app.db.models import UserFileAccess

@router.post("/internal/create", response_model=UserFileAccessResponse)
def create_internal_share(
    data: UserFileAccessCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # check if file is owned by user
    file_record = db.query(FileModel).filter(FileModel.id == data.file_id, FileModel.owner_id == current_user.id).first()
    if not file_record:
        raise HTTPException(status_code=404, detail="File not found")
    
    # check if target user exists
    target_user = db.query(User).filter(User.id == data.shared_with_user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Target user not found")

    if target_user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot share file with yourself")

    # check if already shared
    access = db.query(UserFileAccess).filter(
        UserFileAccess.file_id == data.file_id,
        UserFileAccess.shared_with_user_id == data.shared_with_user_id
    ).first()
    if access:
        access.permission = data.permission
    else:
        access = UserFileAccess(
            file_id=data.file_id,
            owner_id=current_user.id,
            shared_with_user_id=data.shared_with_user_id,
            permission=data.permission
        )
        db.add(access)

    db.commit()
    db.refresh(access)

    # Sync with public shared_links table so it appears in Shared Files & Links
    recipient_label = f"{target_user.name} ({target_user.email})"
    shared_link = db.query(SharedLink).filter(
        (SharedLink.user_file_access_id == access.id) |
        ((SharedLink.owner_id == current_user.id) & (SharedLink.file_id == data.file_id) & (SharedLink.shared_to == recipient_label))
    ).first()

    if shared_link:
        shared_link.permission = data.permission
        shared_link.user_file_access_id = access.id
        shared_link.shared_to = recipient_label
        shared_link.is_active = True
    else:
        shared_link = SharedLink(
            file_id=data.file_id,
            owner_id=current_user.id,
            token=str(uuid.uuid4()),
            permission=data.permission,
            shared_to=recipient_label,
            user_file_access_id=access.id,
            is_active=True
        )
        db.add(shared_link)
    db.commit()
    
    res = UserFileAccessResponse.from_orm(access)
    res.file_name = file_record.original_filename
    res.file_size = file_record.file_size
    res.file_type = file_record.file_type
    res.category = file_record.category
    res.owner_name = current_user.name
    res.owner_email = current_user.email
    res.shared_with_name = target_user.name
    res.shared_with_email = target_user.email
    return res

@router.get("/internal/file/{file_id}", response_model=List[UserFileAccessResponse])
def get_file_internal_shares(
    file_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify file ownership
    file_record = db.query(FileModel).filter(FileModel.id == file_id, FileModel.owner_id == current_user.id).first()
    if not file_record:
        raise HTTPException(status_code=404, detail="File not found or not owned by you")

    access_records = db.query(UserFileAccess).filter(UserFileAccess.file_id == file_id).all()
    results = []
    for acc in access_records:
        res = UserFileAccessResponse.from_orm(acc)
        res.file_name = file_record.original_filename
        res.file_size = file_record.file_size
        res.file_type = file_record.file_type
        res.category = file_record.category
        res.owner_name = current_user.name
        res.owner_email = current_user.email
        res.shared_with_name = acc.shared_with_user.name if acc.shared_with_user else "Unknown"
        res.shared_with_email = acc.shared_with_user.email if acc.shared_with_user else ""
        results.append(res)
    return results

@router.delete("/internal/revoke/{access_id}")
def revoke_internal_share(
    access_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    access = db.query(UserFileAccess).filter(
        UserFileAccess.id == access_id,
        UserFileAccess.owner_id == current_user.id
    ).first()
    if not access:
        raise HTTPException(status_code=404, detail="Share record not found or not authorized")
    
    # Also delete corresponding SharedLink if any
    shared_links = db.query(SharedLink).filter(SharedLink.user_file_access_id == access.id).all()
    for sl in shared_links:
        db.delete(sl)

    db.delete(access)
    db.commit()
    return {"message": "Access revoked successfully"}

@router.put("/internal/update/{access_id}", response_model=UserFileAccessResponse)
def update_internal_share(
    access_id: int,
    data: UserFileAccessUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    access = db.query(UserFileAccess).filter(
        UserFileAccess.id == access_id,
        UserFileAccess.owner_id == current_user.id
    ).first()
    if not access:
        raise HTTPException(status_code=404, detail="Share record not found or not authorized")

    if data.permission not in ["view_only", "can_download"]:
        raise HTTPException(status_code=400, detail="Invalid permission. Must be 'view_only' or 'can_download'")

    access.permission = data.permission

    # Also sync corresponding SharedLink
    shared_link = db.query(SharedLink).filter(SharedLink.user_file_access_id == access.id).first()
    if shared_link:
        shared_link.permission = data.permission

    db.commit()
    db.refresh(access)

    res = UserFileAccessResponse.from_orm(access)
    res.file_name = access.file.original_filename if access.file else "Unknown"
    res.file_size = access.file.file_size if access.file else 0
    res.file_type = access.file.file_type if access.file else "unknown"
    res.category = access.file.category if access.file else "other"
    res.owner_name = current_user.name
    res.owner_email = current_user.email
    res.shared_with_name = access.shared_with_user.name if access.shared_with_user else "Unknown"
    res.shared_with_email = access.shared_with_user.email if access.shared_with_user else ""
    return res

@router.get("/internal/shared-with-me", response_model=List[UserFileAccessResponse])
def get_shared_with_me(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    access_records = db.query(UserFileAccess).filter(UserFileAccess.shared_with_user_id == current_user.id).all()
    results = []
    for acc in access_records:
        res = UserFileAccessResponse.from_orm(acc)
        res.file_name = acc.file.original_filename if acc.file else "Deleted file"
        res.file_size = acc.file.file_size if acc.file else 0
        res.file_type = acc.file.file_type if acc.file else "unknown"
        res.category = acc.file.category if acc.file else "other"
        res.owner_name = acc.owner.name if acc.owner else "Unknown"
        res.owner_email = acc.owner.email if acc.owner else ""
        res.shared_with_name = current_user.name
        res.shared_with_email = current_user.email
        results.append(res)
    return results
