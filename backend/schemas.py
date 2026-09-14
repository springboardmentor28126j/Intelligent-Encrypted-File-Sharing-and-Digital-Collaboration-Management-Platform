from datetime import datetime

from pydantic import BaseModel, EmailStr


# ============================================================
# USER REGISTRATION
# ============================================================

class UserRegister(BaseModel):
    name: str
    email: EmailStr
    password: str


# ============================================================
# USER LOGIN
# ============================================================

class UserLogin(BaseModel):
    email: EmailStr
    password: str


# ============================================================
# USER RESPONSE
# ============================================================

class UserResponse(BaseModel):
    id: int
    name: str
    email: EmailStr

    class Config:
        from_attributes = True


# ============================================================
# JWT TOKEN RESPONSE
# ============================================================

class TokenResponse(BaseModel):
    access_token: str
    token_type: str


# ============================================================
# FILE SHARING - CREATE
# ============================================================

class FileShareCreate(BaseModel):
    file_id: int
    shared_with_user_id: int
    permission: str = "view"
    expires_at: datetime | None = None


# ============================================================
# FILE SHARING - RESPONSE
# ============================================================

class FileShareResponse(BaseModel):
    id: int
    file_id: int
    shared_with_user_id: int
    permission: str
    created_at: datetime
    expires_at: datetime | None = None

    class Config:
        from_attributes = True


# ============================================================
# SHARED FILE - DETAILED RESPONSE
# ============================================================

class SharedFileResponse(BaseModel):
    id: int
    file_id: int
    filename: str
    owner_id: int
    owner_name: str
    owner_email: EmailStr
    shared_with_user_id: int
    permission: str
    created_at: datetime
    expires_at: datetime | None = None