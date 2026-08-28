from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class FileOut(BaseModel):
    id: int
    filename: str
    content_type: Optional[str]
    size_bytes: int
    folder: str
    version: int
    created_at: datetime

    class Config:
        from_attributes = True


class ShareLinkCreate(BaseModel):
    permission: str = Field(default="view", pattern="^(view|download)$")
    expires_in_hours: Optional[int] = None
    max_downloads: Optional[int] = None


class ShareLinkOut(BaseModel):
    id: int
    token: str
    permission: str
    max_downloads: Optional[int]
    download_count: int
    expires_at: datetime
    revoked: bool

    class Config:
        from_attributes = True
