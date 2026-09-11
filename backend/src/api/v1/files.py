import uuid
from typing import Optional, List
from fastapi import APIRouter, Depends, UploadFile, File as FormFile, Form, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from src.models.sql.database import get_db
from src.models.sql.user import User
from src.schemas.file import (
    FileResponse,
    FolderCreate,
    FolderResponse,
    FileVersionResponse,
)
from src.services.file_service import FileService
from src.api.deps import get_current_user

router = APIRouter(tags=["Files & Folders"])

@router.post("/folders", response_model=FolderResponse, status_code=status.HTTP_201_CREATED)
async def create_folder(payload: FolderCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await FileService.create_folder(db, user, payload)

@router.get("/folders", response_model=List[FolderResponse])
async def list_folders(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await FileService.list_folders(db, user)

@router.delete("/folders/{folder_id}")
async def delete_folder(folder_id: uuid.UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    success = await FileService.delete_folder(db, user, folder_id)
    return {"deleted": success}

@router.post("/files/upload", response_model=FileResponse, status_code=status.HTTP_201_CREATED)
async def upload_file(
    file: UploadFile = FormFile(...),
    folder_id: Optional[uuid.UUID] = Form(None),
    category: str = Form("general"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    return await FileService.upload_file(db, user, file, folder_id, category)

@router.post("/files/{file_id}/versions", response_model=FileResponse, status_code=status.HTTP_201_CREATED)
async def upload_new_version(
    file_id: uuid.UUID,
    file: UploadFile = FormFile(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    return await FileService.add_version(db, user, file_id, file)

@router.get("/files/{file_id}/versions", response_model=List[FileVersionResponse])
async def list_file_versions(
    file_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    return await FileService.list_versions(db, user, file_id)

@router.get("/files", response_model=List[FileResponse])
async def list_files(
    folder_id: Optional[uuid.UUID] = None,
    search: Optional[str] = None,
    category: Optional[str] = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    return await FileService.list_files(db, user, folder_id, search, category)

@router.get("/files/{file_id}/download")
async def download_file(
    file_id: uuid.UUID,
    version: Optional[int] = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    file_record, stream = await FileService.get_download_stream(db, user, file_id, version)
    return StreamingResponse(
        stream,
        media_type=file_record.mime_type,
        headers={"Content-Disposition": f'attachment; filename="{file_record.name}"'}
    )

@router.delete("/files/{file_id}")
async def delete_file(
    file_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    success = await FileService.delete_file(db, user, file_id)
    return {"deleted": success}

