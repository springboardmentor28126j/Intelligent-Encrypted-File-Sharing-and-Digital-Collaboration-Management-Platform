"""
schemas.py – Pydantic v2 request/response schemas for TrustShare.

Validates all incoming payloads and structures API responses for:
  - User registration, login, and profile
  - File uploads, metadata, listing, and storage metrics
  - Share link generation, permissions, and public recipient view
  - System health checks for PostgreSQL, MongoDB, and Redis
"""

from datetime import datetime
import enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, EmailStr, Field, ConfigDict
from app.models import UserRole


# ─── Enums ────────────────────────────────────────────────────────────────────

class FileCategory(str, enum.Enum):
    document = "document"
    pdf = "pdf"
    image = "image"
    spreadsheet = "spreadsheet"
    presentation = "presentation"
    archive = "archive"
    other = "other"


class SharePermission(str, enum.Enum):
    view_only = "view_only"
    can_download = "can_download"


class ShareDuration(str, enum.Enum):
    one_hour = "1h"
    twenty_four_hours = "24h"
    seven_days = "7d"
    thirty_days = "30d"
    never = "never"
    custom = "custom"


# ─── Auth Schemas ─────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    """Input schema for POST /register."""
    full_name: str = Field(
        ...,
        min_length=2,
        max_length=255,
        examples=["Alice Smith"],
        description="User's full display name",
    )
    email: EmailStr = Field(
        ...,
        examples=["alice@example.com"],
        description="Unique email address used as login identifier",
    )
    password: str = Field(
        ...,
        min_length=6,
        examples=["securepassword123"],
        description="Plain-text password (will be bcrypt-hashed before storage)",
    )


class UserLogin(BaseModel):
    """Input schema for POST /login."""
    email: EmailStr
    password: str


class UserOut(BaseModel):
    """Public user representation returned by the API."""
    id: int
    full_name: str
    email: EmailStr
    role: UserRole
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class Token(BaseModel):
    """Response schema for POST /login."""
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    """Decoded JWT payload – used internally by the auth dependency."""
    email: Optional[str] = None


class MessageResponse(BaseModel):
    """Standard generic API response message."""
    message: str
    success: bool = True


# ─── File Sharing Schemas ─────────────────────────────────────────────────────

class ShareLinkCreate(BaseModel):
    """Payload for POST /files/{file_id}/share."""
    duration: ShareDuration = Field(
        default=ShareDuration.twenty_four_hours,
        description="Preset expiration duration (1h, 24h, 7d, 30d, never, custom)",
    )
    custom_expires_at: Optional[datetime] = Field(
        default=None,
        description="Required if duration is 'custom'",
    )
    permission: SharePermission = Field(
        default=SharePermission.can_download,
        description="Permission level granted to link holder",
    )
    max_downloads: Optional[int] = Field(
        default=None,
        ge=1,
        description="Optional maximum number of downloads permitted before link expires",
    )


class ShareLinkOut(BaseModel):
    """Public details of an active share link."""
    share_token: str
    share_url: str
    permission: SharePermission
    expires_at: Optional[datetime] = None
    max_downloads: Optional[int] = None
    download_count: int = 0
    created_at: datetime
    is_expired: bool = False


class PublicShareOut(BaseModel):
    """Public metadata delivered to recipient visiting /share/{token}."""
    file_id: str
    original_name: str
    file_size: int
    content_type: str
    extension: str
    category: FileCategory
    upload_date: datetime
    share_token: str
    permission: SharePermission
    can_download: bool
    expires_at: Optional[datetime] = None
    is_expired: bool = False


# ─── File Metadata Schemas ────────────────────────────────────────────────────

class FileMetadataOut(BaseModel):
    """Full metadata for a file stored in MongoDB."""
    id: str
    original_name: str
    stored_name: str
    file_size: int
    content_type: str
    extension: str
    category: FileCategory
    sha256_hash: str
    owner_id: int
    owner_email: str
    description: Optional[str] = None
    upload_date: datetime
    download_count: int = 0
    shares: List[ShareLinkOut] = []
    is_public: bool = False


class FileSummaryOut(BaseModel):
    """Lightweight file listing representation."""
    id: str
    original_name: str
    file_size: int
    content_type: str
    extension: str
    category: FileCategory
    upload_date: datetime
    download_count: int = 0
    shares_count: int = 0
    owner_email: str
    description: Optional[str] = None


class StorageStatsOut(BaseModel):
    """Summary dashboard storage statistics."""
    total_files: int
    total_bytes: int
    total_storage_mb: float
    active_shares: int
    categories_count: Dict[str, int]


# ─── Health Schemas ───────────────────────────────────────────────────────────

class MongoHealthOut(BaseModel):
    status: str
    connected: bool
    latency_ms: float
    database: str
    file_count: int
    mode: str
    detail: Optional[str] = None


class RedisHealthOut(BaseModel):
    status: str
    connected: bool
    latency_ms: float
    mode: str
    version: Optional[str] = None
    used_memory: Optional[str] = None
    detail: Optional[str] = None


class HealthStatusOut(BaseModel):
    status: str
    timestamp: datetime
    postgres: Dict[str, Any]
    mongodb: MongoHealthOut
    redis: RedisHealthOut
