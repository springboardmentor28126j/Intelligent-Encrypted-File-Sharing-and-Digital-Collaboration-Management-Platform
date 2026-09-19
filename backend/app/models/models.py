import uuid
from datetime import datetime

from sqlalchemy import Column, String, BigInteger, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, nullable=False, index=True)
    name = Column(String, nullable=True)
    password_hash = Column(String, nullable=False)
    role = Column(String, default="user")
    created_at = Column(DateTime, default=datetime.utcnow)


class File(Base):
    __tablename__ = "files"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id = Column(UUID(as_uuid=True), ForeignKey(
        "users.id"), nullable=False)
    filename = Column(String, nullable=False)
    storage_path = Column(String, nullable=False)
    size_bytes = Column(BigInteger, nullable=False)
    uploaded_at = Column(DateTime, default=datetime.utcnow)

    # Envelope encryption metadata (all base64-encoded).
    # encrypted_key: the per-file AES key, itself encrypted with the master key.
    # key_nonce: the nonce used to encrypt that per-file key.
    # file_nonce: the nonce used to encrypt the file's actual bytes.
    # The raw per-file key is never stored — only its encrypted form.
    encrypted_key = Column(String, nullable=False)
    key_nonce = Column(String, nullable=False)
    file_nonce = Column(String, nullable=False)


class FileShare(Base):
    """A durable grant of access to a file for a specific email address.

    Distinct from the Redis-backed expiring share links: this represents
    "this person has standing access", not "this link works for 24 hours".
    """

    __tablename__ = "file_shares"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    file_id = Column(UUID(as_uuid=True), ForeignKey(
        "files.id"), nullable=False)
    shared_with_email = Column(String, nullable=False)
    permission = Column(String, default="read")  # "read" or "write"
    created_at = Column(DateTime, default=datetime.utcnow)


class Notification(Base):
    """An in-app alert for a user: someone shared a file with them, someone
    downloaded their file, a security event on their own account, etc.

    Named app_notifications (not notifications) because a teammate's own
    code already created a differently-shaped "notifications" table on the
    shared database (int4 id instead of UUID, different columns) — rather
    than fight over one table name, this uses its own."""

    __tablename__ = "app_notifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey(
        "users.id"), nullable=False)
    type = Column(String, nullable=False)  # "share" | "download" | "security"
    message = Column(String, nullable=False)
    resource_id = Column(String, nullable=True)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
