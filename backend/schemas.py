from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr


class UserRegister(BaseModel):
    name: str
    email: EmailStr
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: UUID
    name: str | None = None
    email: EmailStr

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str


class FileResponse(BaseModel):
    id: UUID
    owner_id: UUID
    filename: str
    storage_path: str
    size_bytes: int
    uploaded_at: datetime | None = None
    encryption_version: str | None = None
    key_version: str | None = None

    class Config:
        from_attributes = True


class FileShareCreate(BaseModel):
    file_id: UUID
    shared_with_email: EmailStr
    permission: str = "view"
    expires_at: datetime | None = None


class FileShareResponse(BaseModel):
    id: UUID
    file_id: UUID
    shared_with_email: EmailStr
    permission: str | None = None
    created_at: datetime | None = None
    expires_at: datetime | None = None

    class Config:
        from_attributes = True


class SharedFileResponse(BaseModel):
    id: UUID
    file_id: UUID
    filename: str
    owner_id: UUID
    shared_with_email: str
    permission: str | None = None
    created_at: datetime | None = None
    expires_at: datetime | None = None