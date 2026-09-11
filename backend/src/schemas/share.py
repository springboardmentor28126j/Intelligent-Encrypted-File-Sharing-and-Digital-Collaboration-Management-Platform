from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from uuid import UUID
from datetime import datetime

class ShareLinkCreate(BaseModel):
    file_id: UUID
    permission_type: str = Field(default="view_only", pattern="^(view_only|download_allowed)$")
    passphrase: Optional[str] = None
    max_downloads: Optional[int] = Field(default=None, ge=1)
    expires_in_hours: int = Field(default=24, ge=1, le=720)

class ShareLinkResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    file_id: UUID
    share_url: str
    token: str
    permission_type: str
    requires_passphrase: bool
    max_downloads: Optional[int]
    current_downloads: int
    expires_at: datetime
    is_revoked: bool

class ShareAccessRequest(BaseModel):
    passphrase: Optional[str] = None

class ShareAccessResponse(BaseModel):
    file_id: UUID
    file_name: str
    size_bytes: int
    mime_type: str
    permission_type: str
    temporary_access_token: str

class ShareMetaResponse(BaseModel):
    token: str
    file_id: UUID
    file_name: str
    mime_type: str
    size_bytes: int
    permission_type: str
    requires_passphrase: bool
    expires_at: datetime
    is_expired: bool
    is_revoked: bool
    has_download_limit: bool = False
    is_download_limit_reached: bool = False
    is_limit_reached: bool = False


