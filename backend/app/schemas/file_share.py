from datetime import datetime
from pydantic import BaseModel, EmailStr, Field


class FileShareCreate(BaseModel):
    email: str | None = None
    emails: list[str] | None = None
    permission: str = Field(default="VIEWER")


class FileShareUpdate(BaseModel):
    permission: str = Field(default="VIEWER")


class FileShareResponse(BaseModel):
    id: int
    file_id: int
    shared_with_user_id: int
    permission: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SharedFileResponse(BaseModel):
    id: int
    original_filename: str
    file_size: int
    file_type: str
    category: str
    version: int
    file_id: int
    owner_id: int
    owner_name: str
    permission: str
    shared_by: str
    created_at: datetime

    model_config = {"from_attributes": True}
