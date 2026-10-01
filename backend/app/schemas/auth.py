from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)

class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    mfa_code: str | None = None

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int

class MFARequiredResponse(BaseModel):
    mfa_required: bool = True
    message: str = "MFA code required to complete authentication"
    
class MFASetupResponse(BaseModel):
    secret: str
    provisioning_uri: str

class MFAEnableRequest(BaseModel):
    code: str

class UserResponse(BaseModel):
    id: int
    name: str
    email: EmailStr
    role: str
    is_active: bool
    mfa_enabled: bool
    storage_quota: int
    used_storage: int
    oauth_provider: str | None = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=8, max_length=128)

class GoogleCallbackRequest(BaseModel):
    code: str
    state: str | None = None

class SessionResponse(BaseModel):
    id: int
    user_agent: str | None
    ip_address: str | None
    created_at: datetime
    expires_at: datetime
    revoked_at: datetime | None
    current: bool = False
    model_config = ConfigDict(from_attributes=True)
