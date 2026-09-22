from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class FileOut(BaseModel):
    id: UUID
    owner_id: UUID
    filename: str
    storage_path: str
    size_bytes: int
    uploaded_at: datetime | None = None

    # Frontend compatibility fields
    content_type: str | None = None
    folder: str = "/"
    version: int = 1
    created_at: datetime | None = None

    class Config:
        from_attributes = True


class ShareLinkCreate(BaseModel):
    permission: str = "view"
    max_downloads: int | None = None
    expires_in_hours: int | None = None

class ShareEmailRequest(BaseModel):
    recipient_email: str

class ShareLinkOut(BaseModel):
    id: int
    file_id: UUID
    created_by_id: UUID
    token: str
    permission: str
    max_downloads: int | None = None
    download_count: int = 0
    expires_at: datetime
    revoked: bool = False
    reminder_sent: bool = False
    created_at: datetime | None = None

    class Config:
        from_attributes = True