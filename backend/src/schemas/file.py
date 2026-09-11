from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from uuid import UUID
from datetime import datetime

class FolderCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    parent_id: Optional[UUID] = None

class FolderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    owner_id: UUID
    parent_id: Optional[UUID]
    created_at: datetime
    updated_at: datetime

class FileVersionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    version_number: int
    size_bytes: int
    checksum_sha256: str
    uploaded_by: UUID
    created_at: datetime

class FileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    owner_id: UUID
    folder_id: Optional[UUID]
    mime_type: str
    size_bytes: int
    current_version: int
    category: str
    status: str
    created_at: datetime
    updated_at: datetime

class FileDetailResponse(FileResponse):
    versions: List[FileVersionResponse] = []
