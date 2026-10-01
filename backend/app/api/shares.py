import hashlib
import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_active_user
from app.core.database import get_db
from app.models.collaboration import FileShare, ShareLink
from app.models.file import File as FileModel
from app.models.user import User
from app.schemas.share import *
from app.services.audit import log_activity
from app.services.file_utils import read_decrypted_file
from app.services.notifications import push_notification

router=APIRouter(prefix="/shares",tags=["Sharing"])
def hash_share_token(token:str)->str:return hashlib.sha256(token.encode()).hexdigest()
def _expiry(value): return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value

def _validate_expiry(expires_at):
    if _expiry(expires_at)<=datetime.now(timezone.utc): raise HTTPException(400,"Expiration must be in the future")

@router.get("",response_model=list[ShareResponse])
def list_shares(current_user:User=Depends(get_current_active_user),db:Session=Depends(get_db)):
    return list(db.scalars(select(FileShare).where(FileShare.shared_with_id==current_user.id,FileShare.is_revoked.is_(False)).order_by(FileShare.created_at.desc())).all())

@router.post("/user",response_model=ShareResponse)
def share_with_user(data:DirectShareCreate,current_user:User=Depends(get_current_active_user),db:Session=Depends(get_db)):
    file=db.scalar(select(FileModel).where(FileModel.id==data.file_id,FileModel.owner_id==current_user.id,FileModel.is_deleted.is_(False)))
    if not file: raise HTTPException(404,"File not found")
    target=db.scalar(select(User).where(User.email==data.email.lower()))
    if not target: raise HTTPException(404,"Recipient user not found")
    if target.id==current_user.id: raise HTTPException(400,"You cannot share a file with yourself")
    if data.expires_at:_validate_expiry(data.expires_at)
    share=db.scalar(select(FileShare).where(FileShare.file_id==data.file_id,FileShare.shared_with_id==target.id))
    if share:
        share.permission=data.permission; share.can_download=data.can_download; share.expires_at=data.expires_at; share.max_downloads=data.max_downloads; share.download_count=0; share.is_revoked=False
    else:
        share=FileShare(file_id=data.file_id,owner_id=current_user.id,shared_with_id=target.id,permission=data.permission,can_download=data.can_download,expires_at=data.expires_at,max_downloads=data.max_downloads,is_revoked=False); db.add(share)
    db.commit(); db.refresh(share); log_activity("SHARE",current_user.id,details={"file_id":data.file_id,"recipient_id":target.id,"permission":data.permission,"can_download":data.can_download}); push_notification(target.id,f"A file was shared with you by {current_user.name}.","SHARE"); return share

@router.get("/sent",response_model=list[ShareResponse])
def sent(current_user:User=Depends(get_current_active_user),db:Session=Depends(get_db)): return list(db.scalars(select(FileShare).where(FileShare.owner_id==current_user.id).order_by(FileShare.created_at.desc())).all())
@router.get("/received",response_model=list[ShareResponse])
def received(current_user:User=Depends(get_current_active_user),db:Session=Depends(get_db)): return list(db.scalars(select(FileShare).where(FileShare.shared_with_id==current_user.id,FileShare.is_revoked.is_(False)).order_by(FileShare.created_at.desc())).all())
@router.delete("/user/{share_id}")
def revoke_user_share(share_id:int,current_user:User=Depends(get_current_active_user),db:Session=Depends(get_db)):
    share=db.scalar(select(FileShare).where(FileShare.id==share_id,FileShare.owner_id==current_user.id))
    if not share: raise HTTPException(404,"Share not found")
    share.is_revoked=True; db.commit(); return {"message":"Share revoked successfully"}

@router.post("/link",response_model=ShareLinkCreatedResponse)
def create_share_link(
    data:ShareLinkCreate,
    current_user:User=Depends(get_current_active_user),
    db:Session=Depends(get_db),
    ):
    file=db.scalar(select(FileModel).where(FileModel.id==data.file_id,FileModel.owner_id==current_user.id,FileModel.is_deleted.is_(False)))
    if not file: 
        raise HTTPException(404,"File not found")
    _validate_expiry(data.expires_at)
    raw=secrets.token_urlsafe(48); 
    link=ShareLink(
        file_id=file.id,
        owner_id=current_user.id,
        token_hash=hash_share_token(raw),
        permission=data.permission,
        can_download=data.can_download,
        max_downloads=data.max_downloads,
        expires_at=data.expires_at,
        is_revoked=False
        )
    db.add(link); 
    db.commit(); 
    db.refresh(link); 
    log_activity("SHARE_LINK_CREATE",current_user.id,details={"file_id":file.id,"share_link_id":link.id})
    return ShareLinkCreatedResponse(
        message="Secure share link created",
        share_link=ShareLinkResponse.model_validate(link),
        access_token=raw,
        access_url=f"{__import__('app.core.config',fromlist=['settings']).settings.FRONTEND_URL}/share/{raw}")

@router.get("/links",response_model=list[ShareLinkResponse])
def list_links(current_user:User=Depends(get_current_active_user),db:Session=Depends(get_db)): return list(db.scalars(select(ShareLink).where(ShareLink.owner_id==current_user.id).order_by(ShareLink.created_at.desc())).all())
@router.delete("/link/{link_id}")
def revoke_link(link_id:int,current_user:User=Depends(get_current_active_user),db:Session=Depends(get_db)):
    link=db.scalar(select(ShareLink).where(ShareLink.id==link_id,ShareLink.owner_id==current_user.id))
    if not link: raise HTTPException(404,"Share link not found")
    link.is_revoked=True; db.commit(); return {"message":"Share link revoked"}

def _public_link(token,db):
    link=db.scalar(select(ShareLink).where(ShareLink.token_hash==hash_share_token(token),ShareLink.is_revoked.is_(False)))
    if not link: raise HTTPException(404,"Invalid or revoked share link")
    if _expiry(link.expires_at)<=datetime.now(timezone.utc): raise HTTPException(410,"Share link has expired")
    file=db.scalar(select(FileModel).where(FileModel.id==link.file_id,FileModel.is_deleted.is_(False)))
    if not file: raise HTTPException(404,"File no longer exists")
    return link,file

@router.get("/link/{token}",response_model=PublicShareResponse)
def access_share_link(token:str,db:Session=Depends(get_db)):
    link,file=_public_link(token,db); return PublicShareResponse(file_id=file.id,filename=file.filename,content_type=file.content_type,size=file.size,permission=link.permission,can_download=link.can_download,expires_at=link.expires_at)

@router.get("/link/{token}/download")
def public_download(token:str,db:Session=Depends(get_db)):
    link,file=_public_link(token,db)
    if not link.can_download: raise HTTPException(403,"Download is disabled for this link")
    if link.max_downloads and link.download_count>=link.max_downloads: raise HTTPException(429,"Download limit reached")
    data=read_decrypted_file(file.storage_path,file.wrapped_key); link.download_count+=1; db.commit(); log_activity("SHARE_LINK_DOWNLOAD",None,details={"file_id":file.id,"share_link_id":link.id}); return Response(content=data,media_type=file.content_type or "application/octet-stream",headers={"Content-Disposition":f'attachment; filename="{file.filename}"'})
