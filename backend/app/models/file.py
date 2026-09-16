from datetime import datetime
from pathlib import Path

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Integer, String, Text, event
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base


class File(Base):
    __tablename__ = "files"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    folder_id: Mapped[int | None] = mapped_column(ForeignKey("folders.id"), nullable=True)
    original_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    filename: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    stored_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    file_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    storage_path: Mapped[str] = mapped_column(String(500), nullable=False, default="")
    storage_backend: Mapped[str] = mapped_column(String(32), nullable=False, default="local")
    storage_key: Mapped[str | None] = mapped_column(String(500), nullable=True, index=True)
    file_size: Mapped[int | None] = mapped_column(Integer, nullable=True)
    size: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    file_type: Mapped[str | None] = mapped_column(String(120), default="application/octet-stream")
    content_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    category: Mapped[str] = mapped_column(String(40), default="Other", nullable=False)
    version: Mapped[int | None] = mapped_column(Integer, default=1)
    extension: Mapped[str] = mapped_column(String(20), default="", nullable=False)
    sha256_hash: Mapped[str] = mapped_column(String(64), default="", nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    download_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_encrypted: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_public: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    encryption_key: Mapped[str | None] = mapped_column(String(255), nullable=True)
    encryption_nonce: Mapped[str | None] = mapped_column(String(64), nullable=True)
    encryption_algorithm: Mapped[str] = mapped_column(String(50), default="AES-256-GCM", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    owner = relationship("User", back_populates="files")
    folder = relationship("Folder", back_populates="files")
    shares = relationship("FileShare", back_populates="file", cascade="all, delete-orphan")
    encryption = relationship("FileEncryption", back_populates="file", uselist=False, cascade="all, delete-orphan")
    secure_share_links = relationship("SecureShareLink", back_populates="file", cascade="all, delete-orphan")


def file_display_name(item) -> str:
    return getattr(item, "original_filename", None) or getattr(item, "filename", None) or "file"


def file_display_size(item) -> int:
    size = getattr(item, "file_size", None)
    if size is None:
        size = getattr(item, "size", 0)
    return int(size or 0)


def file_display_type(item) -> str:
    return getattr(item, "file_type", None) or getattr(item, "content_type", None) or "application/octet-stream"


def file_is_deleted(item) -> bool:
    return bool(getattr(item, "is_deleted", False))


@event.listens_for(File, "before_insert")
@event.listens_for(File, "before_update")
def sync_legacy_file_columns(mapper, connection, target):
    display_name = file_display_name(target)
    if not target.original_filename:
        target.original_filename = display_name
    if not target.filename:
        target.filename = display_name
    storage = target.storage_key or target.storage_path or target.file_path or target.stored_filename or ""
    if not target.storage_path:
        target.storage_path = storage
    if not target.file_path:
        target.file_path = storage
    if not target.stored_filename:
        target.stored_filename = target.storage_key or storage
    size_value = file_display_size(target)
    target.file_size = size_value
    target.size = size_value
    media_type = file_display_type(target)
    target.file_type = media_type
    if not target.content_type:
        target.content_type = media_type[:100]
    if target.is_deleted is None:
        target.is_deleted = False
    if target.is_encrypted is None:
        target.is_encrypted = True
    if target.is_public is None:
        target.is_public = False
    if target.download_count is None:
        target.download_count = 0
    if target.version is None:
        target.version = 1
    if not target.category:
        target.category = "Other"
    if not target.storage_backend:
        target.storage_backend = "local"
    if not target.encryption_algorithm:
        target.encryption_algorithm = "AES-256-GCM"
    if target.sha256_hash is None:
        target.sha256_hash = ""
    if not target.extension:
        target.extension = Path(display_name).suffix[:20]
