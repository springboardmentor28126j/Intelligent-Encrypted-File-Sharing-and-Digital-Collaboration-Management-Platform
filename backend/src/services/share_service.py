import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional, AsyncGenerator, List
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status
from src.models.sql.user import User
from src.models.sql.file import File
from src.models.sql.share import ShareLink
from src.schemas.share import (
    ShareLinkCreate,
    ShareLinkResponse,
    ShareAccessRequest,
    ShareAccessResponse,
    ShareMetaResponse,
)
from src.core.security import get_password_hash, verify_password, create_access_token
from src.services.file_service import FileService

class ShareService:
    @staticmethod
    def _hash_token(raw_token: str) -> str:
        return hashlib.sha256(raw_token.encode()).hexdigest()

    @staticmethod
    async def create_share_link(db: AsyncSession, user: User, payload: ShareLinkCreate) -> ShareLinkResponse:
        file = await db.scalar(select(File).where(and_(File.id == payload.file_id, File.owner_id == user.id)))
        if not file:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

        raw_token = secrets.token_urlsafe(32)
        token_hash = ShareService._hash_token(raw_token)
        expires_at = datetime.now(timezone.utc) + timedelta(hours=payload.expires_in_hours)

        share = ShareLink(
            file_id=file.id,
            created_by=user.id,
            token_hash=token_hash,
            permission_type=payload.permission_type,
            hashed_passphrase=get_password_hash(payload.passphrase) if payload.passphrase else None,
            max_downloads=payload.max_downloads,
            expires_at=expires_at
        )
        db.add(share)
        await db.commit()
        await db.refresh(share)

        return ShareLinkResponse(
            id=share.id,
            file_id=share.file_id,
            share_url=f"/share/{raw_token}",
            token=raw_token,
            permission_type=share.permission_type,
            requires_passphrase=bool(share.hashed_passphrase),
            max_downloads=share.max_downloads,
            current_downloads=share.current_downloads,
            expires_at=share.expires_at,
            is_revoked=share.is_revoked
        )

    @staticmethod
    async def validate_and_access(db: AsyncSession, raw_token: str, payload: ShareAccessRequest) -> ShareAccessResponse:
        token_hash = ShareService._hash_token(raw_token)
        share = await db.scalar(select(ShareLink).where(ShareLink.token_hash == token_hash))
        if not share or share.is_revoked:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Share link invalid or revoked")

        if datetime.now(timezone.utc) > share.expires_at.replace(tzinfo=timezone.utc):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Share link has expired")

        if share.max_downloads is not None and share.current_downloads >= share.max_downloads:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Download limit reached")

        if share.hashed_passphrase:
            if not payload.passphrase or not verify_password(payload.passphrase, share.hashed_passphrase):
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid passphrase")

        file = await db.scalar(select(File).where(File.id == share.file_id))
        if not file:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shared file not found")

        temp_token = create_access_token(
            subject=f"share:{share.id}:{file.id}",
            role="guest",
            expires_delta=timedelta(minutes=30)
        )

        return ShareAccessResponse(
            file_id=file.id,
            file_name=file.name,
            size_bytes=file.size_bytes,
            mime_type=file.mime_type,
            permission_type=share.permission_type,
            temporary_access_token=temp_token
        )

    @staticmethod
    async def download_shared_file(db: AsyncSession, raw_token: str, payload: ShareAccessRequest) -> tuple[File, AsyncGenerator[bytes, None]]:
        token_hash = ShareService._hash_token(raw_token)
        share = await db.scalar(select(ShareLink).where(ShareLink.token_hash == token_hash))
        if not share or share.is_revoked:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Share link invalid or revoked")

        if share.permission_type == "view_only":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Download is not permitted on view-only links")

        if datetime.now(timezone.utc) > share.expires_at.replace(tzinfo=timezone.utc):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Share link has expired")

        if share.max_downloads is not None and share.current_downloads >= share.max_downloads:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Maximum download limit reached")

        if share.hashed_passphrase:
            if not payload.passphrase or not verify_password(payload.passphrase, share.hashed_passphrase):
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid passphrase")

        share.current_downloads += 1
        await db.commit()

        # Retrieve file through creator credentials
        creator = await db.scalar(select(User).where(User.id == share.created_by))
        return await FileService.get_download_stream(db, creator, share.file_id)

    @staticmethod
    async def revoke_share_link(db: AsyncSession, user: User, share_id: uuid.UUID) -> bool:
        share = await db.scalar(select(ShareLink).where(and_(ShareLink.id == share_id, ShareLink.created_by == user.id)))
        if not share:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Share link not found")
        share.is_revoked = True
        await db.commit()
        return True

    @staticmethod
    async def get_share_metadata(db: AsyncSession, raw_token: str) -> ShareMetaResponse:
        token_hash = ShareService._hash_token(raw_token)
        share = await db.scalar(select(ShareLink).where(ShareLink.token_hash == token_hash))
        if not share:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Share link not found")
        
        file = await db.scalar(select(File).where(File.id == share.file_id))
        if not file:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shared file no longer exists")

        now = datetime.now(timezone.utc)
        exp = share.expires_at.replace(tzinfo=timezone.utc) if share.expires_at.tzinfo is None else share.expires_at
        is_expired = now > exp
        has_download_limit = share.max_downloads is not None
        is_limit_reached = has_download_limit and share.current_downloads >= share.max_downloads

        return ShareMetaResponse(
            token=raw_token,
            file_id=file.id,
            file_name=file.name,
            mime_type=file.mime_type,
            size_bytes=file.size_bytes,
            permission_type=share.permission_type,
            requires_passphrase=bool(share.hashed_passphrase),
            expires_at=share.expires_at,
            is_expired=is_expired,
            is_revoked=share.is_revoked,
            has_download_limit=has_download_limit,
            is_download_limit_reached=is_limit_reached,
            is_limit_reached=is_limit_reached,
        )

    @staticmethod
    async def preview_shared_file(db: AsyncSession, raw_token: str, payload: ShareAccessRequest) -> tuple[File, AsyncGenerator[bytes, None]]:
        token_hash = ShareService._hash_token(raw_token)
        share = await db.scalar(select(ShareLink).where(ShareLink.token_hash == token_hash))
        if not share or share.is_revoked:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Share link invalid or revoked")

        now = datetime.now(timezone.utc)
        exp = share.expires_at.replace(tzinfo=timezone.utc) if share.expires_at.tzinfo is None else share.expires_at
        if now > exp:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Share link has expired")

        if share.hashed_passphrase:
            if not payload.passphrase or not verify_password(payload.passphrase, share.hashed_passphrase):
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid passphrase")

        creator = await db.scalar(select(User).where(User.id == share.created_by))
        return await FileService.get_download_stream(db, creator, share.file_id)

    @staticmethod
    async def list_user_shares(db: AsyncSession, user: User, file_id: Optional[uuid.UUID] = None) -> List[ShareLinkResponse]:
        query = select(ShareLink).where(ShareLink.created_by == user.id)
        if file_id:
            query = query.where(ShareLink.file_id == file_id)
        query = query.order_by(ShareLink.created_at.desc())
        shares = await db.scalars(query)
        res = []
        for s in shares.all():
            res.append(ShareLinkResponse(
                id=s.id,
                file_id=s.file_id,
                share_url=f"/share/{s.token_hash[:16]}",
                token=s.token_hash[:16],
                permission_type=s.permission_type,
                requires_passphrase=bool(s.hashed_passphrase),
                max_downloads=s.max_downloads,
                current_downloads=s.current_downloads,
                expires_at=s.expires_at,
                is_revoked=s.is_revoked,
            ))
        return res
