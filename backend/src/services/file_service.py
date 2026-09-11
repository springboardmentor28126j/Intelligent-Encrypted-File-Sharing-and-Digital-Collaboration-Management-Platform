import hashlib
import uuid
from typing import AsyncGenerator, Optional, List
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, UploadFile, status
from src.models.sql.user import User
from src.models.sql.file import File, Folder, FileVersion
from src.schemas.file import (
    FileResponse,
    FileDetailResponse,
    FolderCreate,
    FolderResponse,
    FileVersionResponse,
)
from src.crypto.cipher import AESGCMCipher
from src.crypto.key_manager import key_manager
from src.storage.s3_adapter import get_storage_adapter

class FileService:
    @staticmethod
    async def create_folder(db: AsyncSession, user: User, payload: FolderCreate) -> FolderResponse:
        folder = Folder(
            name=payload.name,
            owner_id=user.id,
            parent_id=payload.parent_id
        )
        db.add(folder)
        await db.commit()
        await db.refresh(folder)
        return FolderResponse.model_validate(folder)

    @staticmethod
    async def list_folders(db: AsyncSession, user: User) -> List[FolderResponse]:
        query = select(Folder).where(Folder.owner_id == user.id)
        result = await db.scalars(query)
        return [FolderResponse.model_validate(f) for f in result.all()]

    @staticmethod
    async def upload_file(
        db: AsyncSession,
        user: User,
        upload_file: UploadFile,
        folder_id: Optional[uuid.UUID] = None,
        category: str = "general"
    ) -> FileResponse:
        raw_dek, encrypted_dek = key_manager.create_file_key()
        file_id = uuid.uuid4()
        storage_key = f"encrypted/{user.id}/{file_id}/v1.enc"
        
        sha256 = hashlib.sha256()
        total_size = 0

        async def plaintext_stream() -> AsyncGenerator[bytes, None]:
            nonlocal total_size
            while True:
                chunk = await upload_file.read(65536)
                if not chunk:
                    break
                sha256.update(chunk)
                total_size += len(chunk)
                yield chunk

        # Encrypt stream with AES-256-GCM
        enc_stream = AESGCMCipher.encrypt_stream(raw_dek, plaintext_stream())
        
        storage = get_storage_adapter()
        await storage.upload_stream(storage_key, enc_stream)

        # Check quota
        if user.storage_used_bytes + total_size > user.storage_quota_bytes:
            await storage.delete(storage_key)
            raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Storage quota exceeded")

        user.storage_used_bytes += total_size

        new_file = File(
            id=file_id,
            name=upload_file.filename or "untitled",
            owner_id=user.id,
            folder_id=folder_id,
            mime_type=upload_file.content_type or "application/octet-stream",
            size_bytes=total_size,
            current_version=1,
            category=category
        )
        db.add(new_file)

        version = FileVersion(
            file_id=file_id,
            version_number=1,
            size_bytes=total_size,
            storage_path=storage_key,
            encrypted_dek=encrypted_dek,
            checksum_sha256=sha256.hexdigest(),
            uploaded_by=user.id
        )
        db.add(version)

        await db.commit()
        await db.refresh(new_file)
        return FileResponse.model_validate(new_file)

    @staticmethod
    async def add_version(
        db: AsyncSession,
        user: User,
        file_id: uuid.UUID,
        upload_file: UploadFile
    ) -> FileResponse:
        file_record = await db.scalar(select(File).where(and_(File.id == file_id, File.owner_id == user.id)))
        if not file_record:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

        next_version = file_record.current_version + 1
        raw_dek, encrypted_dek = key_manager.create_file_key()
        storage_key = f"encrypted/{user.id}/{file_id}/v{next_version}.enc"
        
        sha256 = hashlib.sha256()
        total_size = 0

        async def plaintext_stream() -> AsyncGenerator[bytes, None]:
            nonlocal total_size
            while True:
                chunk = await upload_file.read(65536)
                if not chunk:
                    break
                sha256.update(chunk)
                total_size += len(chunk)
                yield chunk

        enc_stream = AESGCMCipher.encrypt_stream(raw_dek, plaintext_stream())
        storage = get_storage_adapter()
        await storage.upload_stream(storage_key, enc_stream)

        user.storage_used_bytes += total_size
        file_record.current_version = next_version
        file_record.size_bytes = total_size

        version = FileVersion(
            file_id=file_id,
            version_number=next_version,
            size_bytes=total_size,
            storage_path=storage_key,
            encrypted_dek=encrypted_dek,
            checksum_sha256=sha256.hexdigest(),
            uploaded_by=user.id
        )
        db.add(version)
        await db.commit()
        await db.refresh(file_record)
        return FileResponse.model_validate(file_record)

    @staticmethod
    async def get_download_stream(
        db: AsyncSession,
        user: User,
        file_id: uuid.UUID,
        version_number: Optional[int] = None
    ) -> tuple[File, AsyncGenerator[bytes, None]]:
        file_record = await db.scalar(select(File).where(and_(File.id == file_id, File.owner_id == user.id)))
        if not file_record:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

        v_num = version_number or file_record.current_version
        version = await db.scalar(select(FileVersion).where(and_(FileVersion.file_id == file_id, FileVersion.version_number == v_num)))
        if not version:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Version {v_num} not found")

        raw_dek = key_manager.unwrap_file_key(version.encrypted_dek)
        storage = get_storage_adapter()
        encrypted_stream = storage.download_stream(version.storage_path)
        
        decrypted_stream = AESGCMCipher.decrypt_stream(raw_dek, encrypted_stream)
        return file_record, decrypted_stream

    @staticmethod
    async def list_files(
        db: AsyncSession,
        user: User,
        folder_id: Optional[uuid.UUID] = None,
        search: Optional[str] = None,
        category: Optional[str] = None
    ) -> List[FileResponse]:
        query = select(File).where(and_(File.owner_id == user.id, File.status == "active"))
        if folder_id:
            query = query.where(File.folder_id == folder_id)
        if category:
            query = query.where(File.category == category)
        if search:
            query = query.where(File.name.ilike(f"%{search}%"))
            
        result = await db.scalars(query)
        return [FileResponse.model_validate(f) for f in result.all()]

    @staticmethod
    async def list_versions(db: AsyncSession, user: User, file_id: uuid.UUID) -> List[FileVersionResponse]:
        file_record = await db.scalar(select(File).where(and_(File.id == file_id, File.owner_id == user.id)))
        if not file_record:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
        versions = await db.scalars(
            select(FileVersion).where(FileVersion.file_id == file_id).order_by(FileVersion.version_number.desc())
        )
        return [FileVersionResponse.model_validate(v) for v in versions.all()]

    @staticmethod
    async def delete_file(db: AsyncSession, user: User, file_id: uuid.UUID) -> bool:
        file_record = await db.scalar(select(File).where(and_(File.id == file_id, File.owner_id == user.id)))
        if not file_record:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

        # Deduct used quota
        user.storage_used_bytes = max(0, user.storage_used_bytes - file_record.size_bytes)

        # Delete physical version files from object storage
        versions = await db.scalars(select(FileVersion).where(FileVersion.file_id == file_id))
        storage = get_storage_adapter()
        for v in versions.all():
            try:
                await storage.delete(v.storage_path)
            except Exception:
                pass

        # Delete related share links
        from src.models.sql.share import ShareLink
        share_links = await db.scalars(select(ShareLink).where(ShareLink.file_id == file_id))
        for sl in share_links.all():
            await db.delete(sl)

        await db.delete(file_record)
        await db.commit()
        return True

    @staticmethod
    async def delete_folder(db: AsyncSession, user: User, folder_id: uuid.UUID) -> bool:
        folder = await db.scalar(select(Folder).where(and_(Folder.id == folder_id, Folder.owner_id == user.id)))
        if not folder:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Folder not found")
        await db.delete(folder)
        await db.commit()
        return True

