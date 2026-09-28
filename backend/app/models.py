import uuid

from sqlalchemy import (
    Column,
    String,
    Integer,
    BigInteger,
    Boolean,
    DateTime,
    ForeignKey,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.database import Base


# =========================================================
# 1. Users
# =========================================================

class User(Base):

    __tablename__ = "users"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    full_name = Column(
        String(150),
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

    role = Column(
        String(20),
        nullable=False,
        default="user"
    )

    account_status = Column(
        String(20),
        nullable=False,
        default="active"
    )

    created_at = Column(
        DateTime,
        nullable=False,
        server_default=func.now()
    )

    updated_at = Column(
        DateTime,
        nullable=False,
        server_default=func.now(),
        onupdate=func.now()
    )


# =========================================================
# 2. Folders
# =========================================================

class Folder(Base):

    __tablename__ = "folders"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    owner_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False
    )

    parent_folder_id = Column(
        UUID(as_uuid=True),
        ForeignKey("folders.id"),
        nullable=True
    )

    name = Column(
        String(255),
        nullable=False
    )

    created_at = Column(
        DateTime,
        nullable=False,
        server_default=func.now()
    )

    updated_at = Column(
        DateTime,
        nullable=False,
        server_default=func.now(),
        onupdate=func.now()
    )


# =========================================================
# 3. Files
# =========================================================

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
        nullable=False
    )

    folder_id = Column(
        UUID(as_uuid=True),
        ForeignKey("folders.id"),
        nullable=True
    )

    original_name = Column(
        String(255),
        nullable=False
    )

    # Cloud/object storage reference
    storage_key = Column(
        String(500),
        unique=True,
        nullable=False
    )

    content_type = Column(
        String(100),
        nullable=False
    )

    size_bytes = Column(
        BigInteger,
        nullable=False
    )

    # SHA-256 checksum
    checksum = Column(
        String(64),
        nullable=True
    )

    # Reference to the encryption key.
    # Actual encryption key is NOT stored here.
    encryption_key_reference = Column(
        String(255),
        nullable=True
    )

    created_at = Column(
        DateTime,
        nullable=False,
        server_default=func.now()
    )

    updated_at = Column(
        DateTime,
        nullable=False,
        server_default=func.now(),
        onupdate=func.now()
    )

    # Soft delete
    deleted_at = Column(
        DateTime,
        nullable=True
    )


# =========================================================
# 4. File Versions
# =========================================================

class FileVersion(Base):

    __tablename__ = "file_versions"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    file_id = Column(
        UUID(as_uuid=True),
        ForeignKey("files.id"),
        nullable=False
    )

    version_number = Column(
        Integer,
        nullable=False
    )

    storage_key = Column(
        String(500),
        unique=True,
        nullable=False
    )

    size_bytes = Column(
        BigInteger,
        nullable=False
    )

    checksum = Column(
        String(64),
        nullable=True
    )

    encryption_key_reference = Column(
        String(255),
        nullable=True
    )

    uploaded_by = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False
    )

    created_at = Column(
        DateTime,
        nullable=False,
        server_default=func.now()
    )


# =========================================================
# 5. File Permissions
# =========================================================

class FilePermission(Base):

    __tablename__ = "file_permissions"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    file_id = Column(
        UUID(as_uuid=True),
        ForeignKey("files.id"),
        nullable=False
    )

    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False
    )

    access_level = Column(
        String(20),
        nullable=False
    )

    granted_by = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False
    )

    expires_at = Column(
        DateTime,
        nullable=True
    )

    created_at = Column(
        DateTime,
        nullable=False,
        server_default=func.now()
    )

    # One permission per user for each file
    __table_args__ = (
        UniqueConstraint(
            "file_id",
            "user_id",
            name="uq_file_permission_user"
        ),
    )


# =========================================================
# 6. Share Links
# =========================================================

class ShareLink(Base):

    __tablename__ = "share_links"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    file_id = Column(
        UUID(as_uuid=True),
        ForeignKey("files.id"),
        nullable=False
    )

    created_by = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False
    )

    # Only the hash of the raw token is stored
    token_hash = Column(
        String(255),
        unique=True,
        nullable=False
    )

    access_level = Column(
        String(20),
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
        nullable=False,
        default=0
    )

    is_active = Column(
        Boolean,
        nullable=False,
        default=True
    )

    created_at = Column(
        DateTime,
        nullable=False,
        server_default=func.now()
    )

    revoked_at = Column(
        DateTime,
        nullable=True
    )


# =========================================================
# 7. Activity Logs
# =========================================================

class ActivityLog(Base):

    __tablename__ = "activity_logs"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=True
    )

    action = Column(
        String(50),
        nullable=False
    )

    file_id = Column(
        UUID(as_uuid=True),
        ForeignKey("files.id"),
        nullable=True
    )

    details = Column(
        Text,
        nullable=True
    )

    ip_address = Column(
        String(45),
        nullable=True
    )

    user_agent = Column(
        Text,
        nullable=True
    )

    created_at = Column(
        DateTime,
        nullable=False,
        server_default=func.now()
    )


# =========================================================
# 8. Notifications
# =========================================================

class Notification(Base):

    __tablename__ = "notifications"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False
    )

    notification_type = Column(
        String(30),
        nullable=False
    )

    title = Column(
        String(150),
        nullable=False
    )

    message = Column(
        Text,
        nullable=False
    )

    related_file_id = Column(
        UUID(as_uuid=True),
        ForeignKey("files.id"),
        nullable=True
    )

    is_read = Column(
        Boolean,
        nullable=False,
        default=False
    )

    created_at = Column(
        DateTime,
        nullable=False,
        server_default=func.now()
    )


# =========================================================
# 9. Downloads
# =========================================================

class Download(Base):

    __tablename__ = "downloads"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    file_id = Column(
        UUID(as_uuid=True),
        ForeignKey("files.id"),
        nullable=False
    )

    share_link_id = Column(
        UUID(as_uuid=True),
        ForeignKey("share_links.id"),
        nullable=True
    )

    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=True
    )

    ip_address = Column(
        String(45),
        nullable=True
    )

    user_agent = Column(
        Text,
        nullable=True
    )

    downloaded_at = Column(
        DateTime,
        nullable=False,
        server_default=func.now()
    )