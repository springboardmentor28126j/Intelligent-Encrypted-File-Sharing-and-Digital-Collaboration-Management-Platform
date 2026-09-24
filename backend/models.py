import uuid
from datetime import datetime

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    String,
    BigInteger,
    Integer,
)
from sqlalchemy.dialects.postgresql import UUID

from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    email = Column(
        String,
        unique=True,
        nullable=False,
        index=True
    )

    name = Column(
        String,
        nullable=True
    )

    password_hash = Column(
        String,
        nullable=False
    )

    role = Column(
        String,
        default="user"
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )


class File(Base):
    __tablename__ = "files"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    owner_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
        index=True
    )

    filename = Column(
        String,
        nullable=False
    )

    storage_path = Column(
        String,
        nullable=False
    )

    size_bytes = Column(
        BigInteger,
        nullable=False
    )

    uploaded_at = Column(
        DateTime,
        default=datetime.utcnow
    )

    encrypted_key = Column(
        String,
        nullable=False
    )

    key_nonce = Column(
        String,
        nullable=False
    )

    file_nonce = Column(
        String,
        nullable=False
    )

    encryption_version = Column(
        String,
        nullable=False,
        default="aes-256-gcm-v1"
    )

    key_version = Column(
        String,
        nullable=False,
        default="v1"
    )


class FileShare(Base):
    __tablename__ = "file_shares"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    file_id = Column(
        UUID(as_uuid=True),
        ForeignKey("files.id"),
        nullable=False,
        index=True
    )

    shared_with_email = Column(
        String,
        nullable=False,
        index=True
    )

    permission = Column(
        String,
        nullable=True
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )

    expires_at = Column(
        DateTime,
        nullable=True
    )


class TemporaryLink(Base):
    __tablename__ = "temporary_links"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    file_id = Column(
        UUID(as_uuid=True),
        ForeignKey("files.id"),
        nullable=False,
        index=True
    )

    owner_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
        index=True
    )

    token_hash = Column(
        String,
        unique=True,
        nullable=False,
        index=True
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    expires_at = Column(
        DateTime,
        nullable=False
    )


class ActivityLog(Base):
    """
    Milestone 3 activity/audit log.

    Records API activity without storing sensitive
    Authorization headers or temporary-link tokens.
    """

    __tablename__ = "activity_logs"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=True,
        index=True
    )

    user_email = Column(
        String,
        nullable=True,
        index=True
    )

    action = Column(
        String,
        nullable=False,
        index=True
    )

    method = Column(
        String,
        nullable=False
    )

    path = Column(
        String,
        nullable=False
    )

    status_code = Column(
        Integer,
        nullable=False,
        index=True
    )

    ip_address = Column(
        String,
        nullable=True,
        index=True
    )

    response_time_ms = Column(
        Integer,
        nullable=True
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
        index=True
    )