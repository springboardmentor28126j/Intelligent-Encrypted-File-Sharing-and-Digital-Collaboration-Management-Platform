from typing import List, Optional
import uuid
from fastapi import APIRouter, Depends, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from src.models.sql.database import get_db
from src.models.sql.user import User
from src.schemas.share import (
    ShareLinkCreate,
    ShareLinkResponse,
    ShareAccessRequest,
    ShareAccessResponse,
    ShareMetaResponse,
)
from src.services.share_service import ShareService
from src.api.deps import get_current_user

router = APIRouter(prefix="/shares", tags=["Secure Sharing"])

@router.post("", response_model=ShareLinkResponse, status_code=status.HTTP_201_CREATED)
async def create_share_link(payload: ShareLinkCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await ShareService.create_share_link(db, user, payload)

@router.get("", response_model=List[ShareLinkResponse])
async def list_user_shares(file_id: Optional[uuid.UUID] = None, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await ShareService.list_user_shares(db, user, file_id)

@router.get("/{token}/meta", response_model=ShareMetaResponse)
async def get_share_metadata(token: str, db: AsyncSession = Depends(get_db)):
    return await ShareService.get_share_metadata(db, token)

@router.post("/{token}/access", response_model=ShareAccessResponse)
async def access_shared_file(token: str, payload: ShareAccessRequest, db: AsyncSession = Depends(get_db)):
    return await ShareService.validate_and_access(db, token, payload)

@router.post("/{token}/download")
async def download_shared_file(token: str, payload: ShareAccessRequest, db: AsyncSession = Depends(get_db)):
    file_record, stream = await ShareService.download_shared_file(db, token, payload)
    return StreamingResponse(
        stream,
        media_type=file_record.mime_type,
        headers={"Content-Disposition": f'attachment; filename="{file_record.name}"'}
    )

@router.post("/{token}/preview")
async def preview_shared_file(token: str, payload: ShareAccessRequest, db: AsyncSession = Depends(get_db)):
    file_record, stream = await ShareService.preview_shared_file(db, token, payload)
    return StreamingResponse(
        stream,
        media_type=file_record.mime_type,
        headers={
            "Content-Disposition": f'inline; filename="{file_record.name}"',
            "X-Content-Type-Options": "nosniff"
        }
    )

@router.delete("/{share_id}/revoke")
async def revoke_share_link(share_id: uuid.UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    success = await ShareService.revoke_share_link(db, user, share_id)
    return {"revoked": success}

