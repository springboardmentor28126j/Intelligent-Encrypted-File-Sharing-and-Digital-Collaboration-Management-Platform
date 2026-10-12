from datetime import datetime, timezone

from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    Boolean,
)

from database import Base


# =========================================================
# User Model
# =========================================================

class User(Base):
    __tablename__ = "users"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    name = Column(
        String,
        nullable=False
    )

    email = Column(
        String,
        unique=True,
        index=True,
        nullable=False
    )

    password = Column(
        String,
        nullable=False
    )

    role = Column(
        String,
        default="user",
        nullable=False
    )

    reset_token = Column(
        String,
        nullable=True
    )

    reset_token_expires = Column(
        DateTime(timezone=True),
        nullable=True
    )


# =========================================================
# File Model
# =========================================================

class File(Base):
    __tablename__ = "files"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    filename = Column(
        String,
        nullable=False
    )

    stored_filename = Column(
        String,
        nullable=False
    )

    file_path = Column(
        String,
        nullable=False
    )

    owner_id = Column(
        Integer,
        nullable=False
    )

    # Cloudinary encrypted file ID
    cloudinary_public_id = Column(
        String,
        nullable=True
    )


# =========================================================
# File Share Model
# =========================================================

class FileShare(Base):
    __tablename__ = "file_shares"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    # ID of the file being shared
    file_id = Column(
        Integer,
        nullable=False,
        index=True
    )

    # ID of the user who owns the file
    owner_id = Column(
        Integer,
        nullable=False,
        index=True
    )

    # ID of the user receiving access
    shared_with_user_id = Column(
        Integer,
        nullable=True,
        index=True
    )

    # Examples: "view", "download"
    permission = Column(
        String,
        nullable=False,
        default="download"
    )

    # Secure unique token for sharing
    share_token = Column(
        String,
        unique=True,
        nullable=False,
        index=True
    )

    # Optional expiration time; stored as a timezone-aware UTC timestamp
    expires_at = Column(
        DateTime(timezone=True),
        nullable=True
    )

    # Time when the share was created; use timezone-aware UTC
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc)
    )


# =========================================================
# Notification Model
# =========================================================

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    # ID of the user receiving the notification
    user_id = Column(
        Integer,
        nullable=False,
        index=True
    )

    # Notification message
    message = Column(
        String,
        nullable=False
    )

    # Examples:
    # file_shared, file_expiring, security, file_downloaded
    type = Column(
        String,
        nullable=False
    )

    # False = unread, True = read
    is_read = Column(
        Boolean,
        nullable=False,
        default=False
    )

    # Notification creation time; use timezone-aware UTC
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        index=True
    )
