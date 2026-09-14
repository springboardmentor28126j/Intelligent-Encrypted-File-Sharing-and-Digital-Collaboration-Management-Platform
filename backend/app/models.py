"""
models.py – SQLAlchemy ORM models for TrustShare.

Unified canonical schema aligned with the team's common Supabase PostgreSQL database:
  - `User`: Registered user accounts and authentication credentials.
  - `Folder`: Optional directory hierarchy for file organization.
  - `File`: Encrypted file metadata, storage references, and cryptographic parameters (AES-256-GCM).
  - `FileShare`: Secure sharing records, user-to-user grants, and token-based links.
  - `ShareLink` & `Share`: Legacy/alternate share structures preserved for full team interoperability.
"""

from datetime import datetime, timezone
import enum
from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship, synonym
from app.database import Base


class UserRole(str, enum.Enum):
    """Possible roles a user can have in the system."""
    admin = "admin"
    user = "user"

    @classmethod
    def _missing_(cls, value):
        if isinstance(value, str):
            val_lower = value.lower()
            for member in cls:
                if member.value == val_lower:
                    return member
        return cls.user


class SharePermission(str, enum.Enum):
    """Access permissions for shared files."""
    view_only = "view_only"
    can_download = "can_download"

    @classmethod
    def _missing_(cls, value):
        if isinstance(value, str):
            val_lower = value.lower()
            if val_lower in ("read", "view", "view_only"):
                return cls.view_only
            if val_lower in ("write", "download", "can_download"):
                return cls.can_download
        return cls.can_download


class User(Base):
    """
    users table – stores registered TrustShare accounts.
    """
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), default="user", nullable=False, server_default="user")
    is_active = Column(Boolean, default=True, nullable=False, server_default="true")
    mfa_secret = Column(String(64), nullable=True)
    mfa_enabled = Column(Boolean, default=False, nullable=False, server_default="false")
    storage_quota = Column(BigInteger, default=5368709120, nullable=False, server_default="5368709120")
    used_storage = Column(BigInteger, default=0, nullable=False, server_default="0")
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Synonyms for backwards compatibility across branches
    full_name = synonym("name")
    hashed_password = synonym("password_hash")

    # Relationships
    files = relationship("File", back_populates="owner", cascade="all, delete-orphan")
    folders = relationship("Folder", back_populates="owner", cascade="all, delete-orphan")
    created_shares = relationship("FileShare", foreign_keys="FileShare.owner_id", back_populates="owner")
    received_shares = relationship("FileShare", foreign_keys="FileShare.shared_with_id", back_populates="recipient")

    def __repr__(self) -> str:
        return f"<User id={self.id} email={self.email!r} role={self.role}>"


class Folder(Base):
    """
    folders table – stores folder structure for files.
    """
    __tablename__ = "folders"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    parent_id = Column(Integer, ForeignKey("folders.id", ondelete="CASCADE"), nullable=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    owner = relationship("User", back_populates="folders")
    files = relationship("File", back_populates="folder")


class File(Base):
    """
    files table – stores encrypted file metadata and cryptographic parameters.
    Plaintext file contents are NEVER stored. Only encrypted references.
    """
    __tablename__ = "files"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    folder_id = Column(Integer, ForeignKey("folders.id", ondelete="CASCADE"), nullable=True, index=True)
    filename = Column(String(255), nullable=False)
    storage_path = Column(String(500), nullable=False)
    content_type = Column(String(100), default="application/octet-stream", nullable=True)
    size = Column(BigInteger, nullable=False, default=0)
    category = Column(String(50), default="other", nullable=False)
    is_deleted = Column(Boolean, default=False, nullable=False)
    is_encrypted = Column(Boolean, default=True, nullable=False)

    # Encryption Metadata (AES-256-GCM)
    encryption_key = Column(Text, nullable=False)    # Envelope-encrypted DEK using Master KEK
    encryption_nonce = Column(String(64), nullable=False)  # Hex or base64 encoded 12-byte IV

    # Milestone 2 Extended Metadata
    storage_backend = Column(String(32), default="local", nullable=False)
    extension = Column(String(20), default="", nullable=False)
    sha256_hash = Column(String(64), default="", nullable=False)
    encryption_algorithm = Column(String(50), default="AES-256-GCM", nullable=False)
    description = Column(Text, nullable=True)
    download_count = Column(Integer, default=0, nullable=False)
    is_public = Column(Boolean, default=False, nullable=False)

    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Synonyms for seamless compatibility
    original_name = synonym("filename")
    storage_key = synonym("storage_path")
    file_size = synonym("size")
    encrypted_dek = synonym("encryption_key")
    nonce = synonym("encryption_nonce")

    # Relationships
    owner = relationship("User", back_populates="files")
    folder = relationship("Folder", back_populates="files")
    shares = relationship("FileShare", back_populates="file", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<File id={self.id} name={self.filename!r} owner_id={self.owner_id}>"


class FileShare(Base):
    """
    file_shares table – stores secure sharing links and user-to-user access grants.
    """
    __tablename__ = "file_shares"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    file_id = Column(Integer, ForeignKey("files.id", ondelete="CASCADE"), nullable=False, index=True)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    shared_with_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    permission = Column(String(20), default="can_download", nullable=False)
    is_revoked = Column(Boolean, default=False, nullable=False)

    # Milestone 2 Extended Share Fields
    recipient_email = Column(String(255), nullable=True, index=True)
    share_token = Column(String(64), unique=True, index=True, nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    max_downloads = Column(Integer, nullable=True)
    download_count = Column(Integer, default=0, nullable=False)

    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Synonyms
    recipient_id = synonym("shared_with_id")

    # Relationships
    file = relationship("File", back_populates="shares")
    owner = relationship("User", foreign_keys=[owner_id], back_populates="created_shares")
    recipient = relationship("User", foreign_keys=[shared_with_id], back_populates="received_shares")

    def __repr__(self) -> str:
        return f"<FileShare id={self.id} file_id={self.file_id} token={self.share_token}>"


class ShareLink(Base):
    """
    share_links table – legacy share link table preserved for team compatibility.
    """
    __tablename__ = "share_links"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    file_id = Column(Integer, ForeignKey("files.id", ondelete="CASCADE"), nullable=False, index=True)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash = Column(String(128), unique=True, index=True, nullable=False)
    permission = Column(String(20), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    is_revoked = Column(Boolean, default=False, nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class Share(Base):
    """
    shares table – legacy shares table preserved for team compatibility.
    """
    __tablename__ = "shares"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    file_id = Column(Integer, ForeignKey("files.id"), nullable=False, index=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    token_hash = Column(String(64), unique=True, index=True, nullable=False)
    permission = Column(String(20), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    max_downloads = Column(Integer, nullable=True)
    download_count = Column(Integer, default=0, nullable=False)
    revoked = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=True)
