from datetime import datetime, timezone

from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    DateTime,
    ForeignKey,
    BigInteger
)
from sqlalchemy.orm import relationship

from database import Base


# =========================================================
# USER TABLE
# =========================================================

class User(Base):

    __tablename__ = "users"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    # Python attribute: username
    # Database column: name
    username = Column(
        "name",
        String(100),
        nullable=False
    )

    email = Column(
        String(150),
        unique=True,
        nullable=False,
        index=True
    )

    # Python attribute: password
    # Database column: password_hash
    password = Column(
        "password_hash",
        String(255),
        nullable=False
    )

    role = Column(
        String(20),
        default="USER",
        nullable=False
    )

    # Existing column in the common Supabase database
    is_active = Column(
        Boolean,
        nullable=False,
        default=True
    )

    files = relationship(
        "File",
        back_populates="owner"
    )


# =========================================================
# FILE TABLE
# =========================================================

class File(Base):

    __tablename__ = "files"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    # Python attribute: user_id
    # Database column: owner_id
    user_id = Column(
        "owner_id",
        Integer,
        ForeignKey("users.id"),
        nullable=False
    )

    folder_id = Column(
        Integer,
        nullable=True
    )

    filename = Column(
        String(255),
        nullable=False
    )

    # Python attribute: stored_filename
    # Database column: storage_path
    stored_filename = Column(
        "storage_path",
        String(255),
        nullable=False
    )

    content_type = Column(
        String(150),
        nullable=True
    )

    size = Column(
        BigInteger,
        nullable=False
    )

    category = Column(
        String(100),
        nullable=False
    )

    is_deleted = Column(
        Boolean,
        default=False,
        nullable=False
    )

    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc)
    )

    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc)
    )

    # =====================================================
    # MILESTONE 2 ENCRYPTION
    # =====================================================

    is_encrypted = Column(
        Boolean,
        default=False,
        nullable=False
    )

    encryption_key = Column(
        String(255),
        nullable=True
    )

    encryption_nonce = Column(
        String(64),
        nullable=True
    )

    owner = relationship(
        "User",
        back_populates="files"
    )

    shares = relationship(
        "Share",
        back_populates="file",
        cascade="all, delete-orphan"
    )


# =========================================================
# SHARE TABLE
# =========================================================

class Share(Base):

    __tablename__ = "shares"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    file_id = Column(
        Integer,
        ForeignKey("files.id"),
        nullable=False
    )

    created_by = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False
    )

    token_hash = Column(
        String(64),
        unique=True,
        nullable=False,
        index=True
    )

    permission = Column(
        String(20),
        default="download",
        nullable=False
    )

    expires_at = Column(
        DateTime,
        nullable=False
    )

    max_downloads = Column(
        Integer,
        nullable=True
    )

    download_count = Column(
        Integer,
        default=0,
        nullable=False
    )

    revoked = Column(
        Boolean,
        default=False,
        nullable=False
    )

    created_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc)
    )

    file = relationship(
        "File",
        back_populates="shares"
    )
