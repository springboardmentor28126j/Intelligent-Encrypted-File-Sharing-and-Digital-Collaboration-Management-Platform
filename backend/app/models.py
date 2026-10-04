from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    Boolean,
    BigInteger,
    ForeignKey,
)

from .database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)

    name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)

    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, server_default="now()")
    role = Column(String(20), nullable=False, default="USER")

    mfa_secret = Column(String(64), nullable=True)
    mfa_enabled = Column(Boolean, nullable=False, default=False)

    storage_quota = Column(
        BigInteger,
        nullable=False,
        default=5368709120
    )

    used_storage = Column(
        BigInteger,
        nullable=False,
        default=0
    )

    updated_at = Column(
        DateTime,
        nullable=False,
        server_default="now()"
    )


class Folder(Base):
    __tablename__ = "folders"

    id = Column(Integer, primary_key=True, index=True)


class File(Base):
    __tablename__ = "files"

    id = Column(Integer, primary_key=True, index=True)

    owner_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False
    )

    folder_id = Column(
        Integer,
        ForeignKey("folders.id"),
        nullable=True
    )

    filename = Column(String(255), nullable=True)
    storage_path = Column(String(500), nullable=True)
    content_type = Column(String(100), nullable=True)
    size = Column(BigInteger, nullable=True)
    category = Column(String(20), nullable=True)

    is_deleted = Column(Boolean, nullable=False, default=False)

    created_at = Column(
        DateTime,
        nullable=False,
        server_default="now()"
    )

    updated_at = Column(
        DateTime,
        nullable=True
    )

    is_encrypted = Column(
        Boolean,
        nullable=False,
        default=False
    )

    encryption_key = Column(String(255), nullable=True)
    encryption_nonce = Column(String(64), nullable=True)
    storage_backend = Column(String(32), nullable=True)
    extension = Column(String(20), nullable=True)
    sha256_hash = Column(String(64), nullable=True)
    encryption_algorithm = Column(String(50), nullable=True)
    description = Column(String, nullable=True)

    download_count = Column(
        Integer,
        nullable=True,
        default=0
    )

    is_public = Column(
        Boolean,
        nullable=True,
        default=False
    )

    storage_key = Column(String(500), nullable=True)
    original_filename = Column(String(255), nullable=True)
    stored_filename = Column(String(255), nullable=True)
    file_path = Column(String(500), nullable=True)

    file_size = Column(Integer, nullable=True)
    file_type = Column(String(120), nullable=True)

    version = Column(
        Integer,
        nullable=True,
        default=1
    )


class FileEncryption(Base):
    __tablename__ = "file_encryptions"

    id = Column(Integer, primary_key=True, index=True)

    file_id = Column(
        Integer,
        ForeignKey("files.id"),
        nullable=False
    )

    algorithm = Column(String(40), nullable=False)
    key_version = Column(String(20), nullable=True)
    wrapped_key = Column(String(512), nullable=True)
    key_nonce = Column(String(64), nullable=True)

    file_nonce = Column(
        String(64),
        nullable=False
    )

    created_at = Column(
        DateTime,
        nullable=False,
        server_default="now()"
    )


class FileShare(Base):
    __tablename__ = "file_shares"

    id = Column(Integer, primary_key=True, index=True)

    file_id = Column(
        Integer,
        ForeignKey("files.id"),
        nullable=False
    )

    owner_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False
    )

    shared_with_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=True
    )

    permission = Column(
        String,
        nullable=False
    )

    can_download = Column(
    Boolean,
    nullable=False,
    default=False
    )

    is_revoked = Column(
        Boolean,
        nullable=False,
        default=False
    )

    created_at = Column(
        DateTime,
        nullable=False,
        server_default="now()"
    )

    updated_at = Column(
        DateTime,
        nullable=True
    )

   
    
    expires_at = Column(
        DateTime,
        nullable=True
    )

    max_downloads = Column(
        Integer,
        nullable=True
    )

    download_count = Column(
        Integer,
        nullable=True,
        default=0
    )

   

class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False
    )

    token_hash = Column(
        String(128),
        nullable=False
    )

    expires_at = Column(
        DateTime,
        nullable=False
    )

    used_at = Column(
        DateTime,
        nullable=True
    )


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=True
    )

    action = Column(
        String(100),
        nullable=False
    )

    file_id = Column(
        Integer,
        ForeignKey("files.id"),
        nullable=True
    )

    ip_address = Column(
        String(45),
        nullable=True
    )

    timestamp = Column(
        DateTime,
        nullable=False
    )

    details = Column(
        String,
        nullable=True
    )

    status = Column(
        String(50),
        nullable=False
    )

    user_agent = Column(
        String(255),
        nullable=True
    )


class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False
    )

    action = Column(
        String(40),
        nullable=False
    )

    file_id = Column(
        Integer,
        ForeignKey("files.id"),
        nullable=True
    )

    description = Column(
        String,
        nullable=False
    )

    created_at = Column(
        DateTime,
        nullable=False
    )

    ip_address = Column(
        String(45),
        nullable=True
    )

    user_agent = Column(
        String(255),
        nullable=True
    )


class SecurityAlert(Base):
    __tablename__ = "security_alerts"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=True
    )

    alert_type = Column(
        String(100),
        nullable=False
    )

    severity = Column(
        String(20),
        nullable=True
    )

    description = Column(
        String,
        nullable=False
    )

    created_at = Column(
        DateTime,
        nullable=True
    )

    resolved = Column(
        Boolean,
        nullable=True
    )


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False
    )

    title = Column(
        String(200),
        nullable=False
    )

    message = Column(
        String,
        nullable=False
    )

    notification_type = Column(
        String(50),
        nullable=True
    )

    is_read = Column(
        Boolean,
        nullable=True
    )

    created_at = Column(
        DateTime,
        nullable=True
    )

    type = Column(
        String(50),
        nullable=False
    )