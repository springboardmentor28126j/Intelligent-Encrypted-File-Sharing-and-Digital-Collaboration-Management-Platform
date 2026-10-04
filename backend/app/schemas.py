"""
schemas.py – Pydantic v2 request/response schemas for TrustShare.

Validates all incoming payloads and structures API responses for:
  - User registration, login, and profile
  - File uploads, metadata, listing, and storage metrics with AES-256 encryption status
  - Share link generation, user-to-user sharing, permissions, and public recipient view
  - System health checks for PostgreSQL, MongoDB, and Redis
"""

from datetime import datetime
import enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, EmailStr, Field, ConfigDict
from app.models import UserRole, SharePermission


# ─── Enums ────────────────────────────────────────────────────────────────────

class FileCategory(str, enum.Enum):
    document = "document"
    pdf = "pdf"
    image = "image"
    spreadsheet = "spreadsheet"
    presentation = "presentation"
    archive = "archive"
    other = "other"


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


class ForgotPasswordRequest(BaseModel):
    """Payload for POST /forgot-password."""
    email: EmailStr = Field(
        ...,
        examples=["alice@example.com"],
        description="Registered email address to send password reset instructions",
    )


class ResetPasswordRequest(BaseModel):
    """Payload for POST /reset-password."""
    token: str = Field(
        ...,
        min_length=16,
        description="One-time secure password reset token from email link",
    )
    new_password: str = Field(
        ...,
        min_length=6,
        max_length=128,
        examples=["NewSecurePassword123!"],
        description="New plain-text password to replace previous credentials",
    )


class ForgotPasswordResponse(BaseModel):
    """Response returned when password reset email is initiated."""
    message: str
    email_sent: bool = True
    delivery_status: str = "sent"


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
    recipient_email: Optional[EmailStr] = Field(
        default=None,
        description="Optional recipient email for direct user sharing",
    )


class UserShareCreate(BaseModel):
    """Payload for sharing directly with another registered user."""
    recipient_email: EmailStr = Field(
        ...,
        description="Email address of the registered recipient",
    )
    permission: SharePermission = Field(
        default=SharePermission.can_download,
        description="Permission level granted (view_only, can_download)",
    )
    duration: ShareDuration = Field(
        default=ShareDuration.seven_days,
        description="Preset expiration duration",
    )
    custom_expires_at: Optional[datetime] = None


class ShareLinkOut(BaseModel):
    """Public details of an active share link or user grant."""
    id: Optional[int] = None
    share_token: str
    share_url: str
    permission: SharePermission
    recipient_email: Optional[str] = None
    expires_at: Optional[datetime] = None
    max_downloads: Optional[int] = None
    download_count: int = 0
    created_at: datetime
    is_expired: bool = False
    is_revoked: bool = False
    email_sent: Optional[bool] = None
    email_status: Optional[str] = None



class SharedWithMeOut(BaseModel):
    """File shared directly with the authenticated user."""
    share_id: int
    file_id: str
    original_name: str
    file_size: int
    content_type: str
    extension: str
    category: FileCategory
    owner_email: str
    permission: SharePermission
    can_download: bool
    expires_at: Optional[datetime] = None
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
    is_encrypted: bool = True
    encryption_algorithm: str = "AES-256-GCM"
    expires_at: Optional[datetime] = None
    is_expired: bool = False


# ─── File Metadata Schemas ────────────────────────────────────────────────────

class FileMetadataOut(BaseModel):
    """
    Full metadata for a file.
    CRITICAL: Encryption keys and secret materials are STRICTLY OMITTED.
    """
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
    is_encrypted: bool = True
    encryption_algorithm: str = "AES-256-GCM"
    storage_backend: str = "local"


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
    is_encrypted: bool = True
    encryption_algorithm: str = "AES-256-GCM"
    storage_backend: str = "local"


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


# ─── Audit & Activity Schemas ──────────────────────────────────────────────────

class AuditLogOut(BaseModel):
    id: int
    user_id: Optional[int] = None
    user_email: Optional[str] = None
    action: str
    file_id: Optional[int] = None
    filename: Optional[str] = None
    ip_address: Optional[str] = None
    timestamp: datetime
    details: Optional[str] = None
    status: str = "success"
    user_agent: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class AuditStatsOut(BaseModel):
    total_events: int
    login_events: int
    failed_logins: int
    file_operations: int
    security_alerts: int
    unique_users: int
    actions_breakdown: Dict[str, int]


# ─── Notification Schemas ─────────────────────────────────────────────────────

class NotificationOut(BaseModel):
    id: int
    user_id: int
    message: str
    type: str
    is_read: bool
    created_at: datetime
    link_url: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class UnreadCountOut(BaseModel):
    unread_count: int


# ─── Analytics Dashboard Schemas ──────────────────────────────────────────────

class RecentActivityItem(BaseModel):
    id: int
    action: str
    user_email: Optional[str] = None
    filename: Optional[str] = None
    ip_address: Optional[str] = None
    timestamp: datetime
    status: str = "success"


class TrendPoint(BaseModel):
    date: str
    uploads: int = 0
    downloads: int = 0
    shares: int = 0


class StorageCategoryItem(BaseModel):
    category: str
    count: int
    bytes: int
    percentage: float


class AnalyticsDashboardOut(BaseModel):
    total_files: int
    total_storage_bytes: int
    total_storage_mb: float
    total_downloads: int
    total_shares: int
    active_links: int
    security_incidents: int
    recent_activity: List[RecentActivityItem] = []
    upload_trends: List[TrendPoint] = []
    category_distribution: List[StorageCategoryItem] = []

