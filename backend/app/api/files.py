from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile, status
from fastapi import File as FastAPIFile
from fastapi.responses import Response
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_active_user
from app.core.config import settings
from app.core.database import get_db
from app.models.collaboration import FileShare
from app.models.file import File as FileModel
from app.models.file import FileVersion, Folder
from app.models.user import User
from app.schemas.file import FileResponse, FileUploadResponse, FileVersionResponse
from app.services.audit import log_activity
from app.services.file_utils import *

logger=logging.getLogger(__name__)
router=APIRouter(prefix="/files",tags=["Files"])

def _folder(db,user_id,folder_id):
    if folder_id is None:return None
    f=db.scalar(select(Folder).where(Folder.id==folder_id,Folder.owner_id==user_id))
    if not f: raise HTTPException(404,"Folder not found")
    return f

def _read_upload(file:UploadFile)->tuple[str,bytes]:
    if not file.filename: raise HTTPException(400,"Filename is required")
    name=sanitize_filename(file.filename)
    if not name or not validate_file_type(name): raise HTTPException(400,"File type is not allowed")
    content=file.file.read()
    if not is_file_size_allowed(len(content)): raise HTTPException(413,f"Maximum file size is {settings.MAX_UPLOAD_SIZE} bytes")
    return name,content

@router.post("/upload",response_model=FileUploadResponse)
def upload_file(file:Annotated[UploadFile,FastAPIFile(...)],folder_id:Annotated[int|None,Form()]=None,current_user:User=Depends(get_current_active_user),db:Session=Depends(get_db)):
    _folder(db,current_user.id,folder_id); filename,content=_read_upload(file); size=len(content)
    if current_user.used_storage+size>current_user.storage_quota: raise HTTPException(413,"Storage quota exceeded")
    storage_filename=generate_storage_filename(filename)
    storage_path=None
    try:
        storage_path,wrapped_key=save_encrypted_file(content,storage_filename)
        record=FileModel(owner_id=current_user.id,folder_id=folder_id,filename=filename,storage_path=storage_path,wrapped_key=wrapped_key,encryption_version=2,content_type=file.content_type,size=size,category=get_file_category(filename,file.content_type),is_deleted=False)
        db.add(record); db.flush()
        db.add(FileVersion(file_id=record.id,version_number=1,filename=filename,storage_path=storage_path,wrapped_key=wrapped_key,encryption_version=2,content_type=file.content_type,size=size))
        current_user.used_storage+=size; db.commit(); db.refresh(record)
        log_activity("UPLOAD",current_user.id,details={"file_id":record.id,"version":1})
        return FileUploadResponse(message="File uploaded and encrypted successfully",file=FileResponse.model_validate(record))
    except Exception as exc:
        db.rollback()
        if storage_path:
            try: delete_stored_file(storage_path)
            except Exception: pass
        if isinstance(exc,HTTPException): raise
        logger.exception("Upload failed"); raise HTTPException(500,"File upload failed") from exc

@router.post("/{file_id}/versions",response_model=FileVersionResponse)
def upload_new_version(file_id:int,file:Annotated[UploadFile,FastAPIFile(...)],current_user:User=Depends(get_current_active_user),db:Session=Depends(get_db)):
    record=db.scalar(select(FileModel).where(FileModel.id==file_id,FileModel.owner_id==current_user.id,FileModel.is_deleted.is_(False)))
    if not record: raise HTTPException(404,"File not found")
    filename,content=_read_upload(file); size=len(content)
    if current_user.used_storage+size>current_user.storage_quota: raise HTTPException(413,"Storage quota exceeded")
    storage_filename=generate_storage_filename(filename); new_path,new_key=save_encrypted_file(content,storage_filename)
    latest=db.scalar(select(func.max(FileVersion.version_number)).where(FileVersion.file_id==file_id)) or 0
    version=FileVersion(file_id=file_id,version_number=latest+1,filename=filename,storage_path=new_path,wrapped_key=new_key,encryption_version=2,content_type=file.content_type,size=size)
    db.add(version); current_user.used_storage+=size
    record.filename=filename; record.storage_path=new_path; record.wrapped_key=new_key; record.encryption_version=2; record.content_type=file.content_type; record.size=size; record.category=get_file_category(filename,file.content_type)
    db.commit(); db.refresh(version); log_activity("VERSION_UPLOAD",current_user.id,details={"file_id":file_id,"version":version.version_number}); return version

@router.get("/{file_id}/versions",response_model=list[FileVersionResponse])
def list_versions(file_id:int,current_user:User=Depends(get_current_active_user),db:Session=Depends(get_db)):
    record=db.scalar(select(FileModel.id).where(FileModel.id==file_id,FileModel.owner_id==current_user.id))
    if not record: raise HTTPException(404,"File not found")
    return list(db.scalars(select(FileVersion).where(FileVersion.file_id==file_id).order_by(FileVersion.version_number.desc())).all())

@router.get("/search",response_model=list[FileResponse])
def search_files(q:str|None=None,category:str|None=None,folder_id:int|None=None,current_user:User=Depends(get_current_active_user),db:Session=Depends(get_db)):
    stmt=select(FileModel).where(FileModel.owner_id==current_user.id,FileModel.is_deleted.is_(False))
    if q: stmt=stmt.where(or_(FileModel.filename.ilike(f"%{q}%"),FileModel.content_type.ilike(f"%{q}%")))
    if category: stmt=stmt.where(FileModel.category==category.upper())
    if folder_id is not None: stmt=stmt.where(FileModel.folder_id==folder_id)
    return list(db.scalars(stmt.order_by(FileModel.created_at.desc())).all())

@router.get("",response_model=list[FileResponse])
@router.get("/list",response_model=list[FileResponse])
def list_files(category:str|None=None,folder_id:int|None=None,current_user:User=Depends(get_current_active_user),db:Session=Depends(get_db)):
    return search_files(category=category,folder_id=folder_id,current_user=current_user,db=db)

@router.get("/shared",response_model=list[FileResponse])
def list_shared_files(current_user:User=Depends(get_current_active_user),db:Session=Depends(get_db)):
    return list(db.scalars(select(FileModel).join(FileShare,FileShare.file_id==FileModel.id).where(FileShare.shared_with_id==current_user.id,FileShare.is_revoked.is_(False),FileModel.is_deleted.is_(False))).all())

def _access(db,file_id,user_id):
    record=db.scalar(select(FileModel).where(FileModel.id==file_id,FileModel.is_deleted.is_(False)))
    if not record: raise HTTPException(404,"File not found")
    if record.owner_id==user_id:return record,None
    share=db.scalar(select(FileShare).where(FileShare.file_id==file_id,FileShare.shared_with_id==user_id,FileShare.is_revoked.is_(False)))
    if not share: raise HTTPException(403,"You do not have access to this file")
    now=datetime.now(timezone.utc)
    if share.expires_at and (share.expires_at.replace(tzinfo=timezone.utc) <= now): raise HTTPException(410,"File share has expired")
    return record,share

@router.get("/{file_id}/versions/{version_id}/download")
def download_version(file_id:int,version_id:int,current_user:User=Depends(get_current_active_user),db:Session=Depends(get_db)):
    record=db.scalar(select(FileModel).where(FileModel.id==file_id,FileModel.owner_id==current_user.id))
    if not record: raise HTTPException(404,"File not found")
    version=db.scalar(select(FileVersion).where(FileVersion.id==version_id,FileVersion.file_id==file_id))
    if not version: raise HTTPException(404,"Version not found")
    try: data=read_decrypted_file(version.storage_path,version.wrapped_key)
    except Exception as exc: raise HTTPException(500,"Unable to decrypt file version") from exc
    return Response(content=data,media_type=version.content_type or "application/octet-stream",headers={"Content-Disposition":f'attachment; filename="{version.filename}"'})

@router.get("/{file_id}/download")
def download_file(file_id:int,current_user:User=Depends(get_current_active_user),db:Session=Depends(get_db)):
    record,share=_access(db,file_id,current_user.id)
    if share:
        if not share.can_download: raise HTTPException(403,"Download is disabled for this share")
        if share.max_downloads and share.download_count>=share.max_downloads: raise HTTPException(429,"Download limit reached")
        share.download_count+=1; db.commit()
    try: data=read_decrypted_file(record.storage_path,record.wrapped_key)
    except Exception as exc: raise HTTPException(500,"Unable to decrypt file") from exc
    log_activity("DOWNLOAD",current_user.id,details={"file_id":file_id}); return Response(content=data,media_type=record.content_type or "application/octet-stream",headers={"Content-Disposition":f'attachment; filename="{record.filename}"'})

@router.delete("/{file_id}")
def delete_file(file_id:int,current_user:User=Depends(get_current_active_user),db:Session=Depends(get_db)):
    record=db.scalar(select(FileModel).where(FileModel.id==file_id,FileModel.owner_id==current_user.id,FileModel.is_deleted.is_(False)))
    if not record: raise HTTPException(404,"File not found")
    record.is_deleted=True; db.commit(); log_activity("TRASH",current_user.id,details={"file_id":file_id}); return {"message":"File moved to trash"}

@router.get("/trash",response_model=list[FileResponse])
def trash(current_user:User=Depends(get_current_active_user),db:Session=Depends(get_db)):
    return list(db.scalars(select(FileModel).where(FileModel.owner_id==current_user.id,FileModel.is_deleted.is_(True)).order_by(FileModel.updated_at.desc())).all())

@router.post("/{file_id}/restore")
def restore(file_id:int,current_user:User=Depends(get_current_active_user),db:Session=Depends(get_db)):
    record=db.scalar(select(FileModel).where(FileModel.id==file_id,FileModel.owner_id==current_user.id,FileModel.is_deleted.is_(True)))
    if not record: raise HTTPException(404,"File not found in trash")
    record.is_deleted=False; db.commit(); return {"message":"File restored"}

@router.delete("/{file_id}/permanent")
def permanent_delete(file_id:int,current_user:User=Depends(get_current_active_user),db:Session=Depends(get_db)):
    record=db.scalar(select(FileModel).where(FileModel.id==file_id,FileModel.owner_id==current_user.id))
    if not record: raise HTTPException(404,"File not found")
    versions=db.scalars(select(FileVersion).where(FileVersion.file_id==file_id)).all()
    paths={v.storage_path for v in versions}; paths.add(record.storage_path)
    for p in paths:
        try: delete_stored_file(p)
        except Exception: pass
    current_user.used_storage=max(0,current_user.used_storage-sum(v.size for v in versions))
    db.delete(record); db.commit(); return {"message":"File permanently deleted"}

@router.post("/{file_id}/rotate-key")
def rotate_key(file_id:int,current_user:User=Depends(get_current_active_user),db:Session=Depends(get_db)):
    record=db.scalar(select(FileModel).where(FileModel.id==file_id,FileModel.owner_id==current_user.id,FileModel.is_deleted.is_(False)))
    if not record: raise HTTPException(404,"File not found")
    record.wrapped_key=rotate_encrypted_file(record.storage_path,record.wrapped_key); record.encryption_version=2; db.commit(); log_activity("KEY_ROTATION",current_user.id,details={"file_id":file_id}); return {"message":"Encryption key rotated"}
