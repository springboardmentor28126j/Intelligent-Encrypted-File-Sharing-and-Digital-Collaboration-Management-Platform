from datetime import datetime

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String
)

from database import Base


# ============================================================
# USER MODEL
# ============================================================

class User(Base):
    __tablename__ = "users"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    name = Column(
        String(100),
        nullable=False
    )

    email = Column(
        String(255),
        unique=True,
        index=True,
        nullable=False
    )

    password_hash = Column(
        String(255),
        nullable=False
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )


# ============================================================
# FILE MODEL
# ============================================================

class File(Base):
    __tablename__ = "files"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    filename = Column(
        String(255),
        nullable=False
    )

    stored_filename = Column(
        String(255),
        nullable=False
    )

    file_path = Column(
        String(500),
        nullable=False
    )

    file_size = Column(
        Integer,
        nullable=False
    )

    content_type = Column(
        String(100),
        nullable=True
    )

    owner_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
        index=True
    )

    uploaded_at = Column(
        DateTime,
        default=datetime.utcnow
    )


# ============================================================
# FILE SHARE MODEL
# ============================================================

class FileShare(Base):
    __tablename__ = "file_shares"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    file_id = Column(
        Integer,
        ForeignKey("files.id"),
        nullable=False,
        index=True
    )

    shared_with_user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
        index=True
    )

    permission = Column(
        String(20),
        default="view",
        nullable=False
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )

    expires_at = Column(
        DateTime,
        nullable=True
    )