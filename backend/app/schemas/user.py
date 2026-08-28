from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime

class SendRegisterOTPRequest(BaseModel):
    email: EmailStr

class VerifyRegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    otp: str

class UserOut(BaseModel):
    id: int
    name: str
    email: EmailStr
    role: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordOTPRequest(BaseModel):
    email: EmailStr
    otp: str
    new_password: str