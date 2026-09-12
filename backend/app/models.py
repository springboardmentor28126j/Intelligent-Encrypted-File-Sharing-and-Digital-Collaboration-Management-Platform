"""
models.py – SQLAlchemy ORM models for TrustShare.

Each class maps to a database table:
  - `User`: Registered user accounts and authentication credentials.
  - `File`: Encrypted file metadata, storage references, and cryptographic parameters (AES-256-GCM).
  - `FileShare`: Secure sharing records, access permissions, and temporary links.
"""

from datetime import datetime, timezone
import enum
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship
from app.database import Base


class UserRole(str, enum.Enum):
    """Possible roles a user can have in the system."""
    admin = "admin"
    user = "user"


class SharePermission(str, enum.Enum):
    """Access permissions for shared files."""
    view_only = "view_only"
    can_download = "can_download"


class User(Base):
    """
    users table – stores registered TrustShare accounts.
    """
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    full_name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(
        SAEnum(UserRole, name="userrole"),
        default=UserRole.user,
        nullable=False,
        server_default="user",
    )
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    files = relationship("File", back_populates="owner", cascade="all, delete-orphan")
    created_shares = relationship("FileShare", foreign_keys="FileShare.owner_id", back_populates="owner")
    received_shares = relationship("FileShare", foreign_keys="FileShare.recipient_id", back_populates="recipient")

    def __repr__(self) -> str:
        return f"<User id={self.id} email={self.email!r} role={self.role}>"


class File(Base):
    """
    files table – stores encrypted file metadata and cryptographic parameters.
    Plaintext file contents are NEVER stored. Only encrypted references.
    """
    __tablename__ = "files"

    id = Column(String(36), primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    original_name = Column(String(255), nullable=False)
    storage_key = Column(String(255), nullable=False)
    storage_backend = Column(String(32), default="local", nullable=False)
    file_size = Column(Integer, nullable=False)
    content_type = Column(String(100), default="application/octet-stream", nullable=False)
    extension = Column(String(20), nullable=False)
    category = Column(String(50), default="other", nullable=False)
    sha256_hash = Column(String(64), nullable=False)

    # Encryption Metadata (AES-256-GCM)
    encryption_algorithm = Column(String(50), default="AES-256-GCM", nullable=False)
    encrypted_dek = Column(Text, nullable=False)  # Envelope-encrypted DEK using Master KEK
    nonce = Column(String(64), nullable=False)    # Hex or base64 encoded 12-byte IV

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

    # Relationships
    owner = relationship("User", back_populates="files")
    shares = relationship("FileShare", back_populates="file", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<File id={self.id!r} name={self.original_name!r} owner_id={self.owner_id}>"


class FileShare(Base):
    """
    file_shares table – stores secure sharing links and user-to-user access grants.
    """
    __tablename__ = "file_shares"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    file_id = Column(String(36), ForeignKey("files.id", ondelete="CASCADE"), nullable=False, index=True)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    recipient_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    recipient_email = Column(String(255), nullable=True, index=True)
    share_token = Column(String(64), unique=True, index=True, nullable=False)
    permission = Column(
        SAEnum(SharePermission, name="sharepermission"),
        default=SharePermission.can_download,
        nullable=False,
        server_default="can_download",
    )
    expires_at = Column(DateTime(timezone=True), nullable=True)
    max_downloads = Column(Integer, nullable=True)
    download_count = Column(Integer, default=0, nullable=False)
    is_revoked = Column(Boolean, default=False, nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    file = relationship("File", back_populates="shares")
    owner = relationship("User", foreign_keys=[owner_id], back_populates="created_shares")
    recipient = relationship("User", foreign_keys=[recipient_id], back_populates="received_shares")

    def __repr__(self) -> str:
        return f"<FileShare id={self.id} file_id={self.file_id!r} token={self.share_token[:8]}...>"
