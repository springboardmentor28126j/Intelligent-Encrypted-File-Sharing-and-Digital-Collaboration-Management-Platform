from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class SharedLinkCreate(BaseModel):
    file_id: int
    permission: str = "view_only"
    expires_in_hours: Optional[int] = None
    max_downloads: Optional[int] = None
    shared_to: Optional[str] = None

class SharedLinkUpdate(BaseModel):
    permission: Optional[str] = None
    is_active: Optional[bool] = None
    shared_to: Optional[str] = None

class SharedLinkResponse(BaseModel):
    id: int
    file_id: int
    owner_id: int
    token: str
    permission: str
    expires_at: Optional[datetime]
    max_downloads: Optional[int]
    current_downloads: int
    shared_to: Optional[str] = None
    user_file_access_id: Optional[int] = None
    share_type: Optional[str] = None
    is_active: bool
    created_at: datetime
    
    file_name: Optional[str] = None # Added for convenience

    class Config:
        from_attributes = True

class ShareActivityLogResponse(BaseModel):
    id: int
    action: str
    ip_address: Optional[str]
    user_agent: Optional[str]
    timestamp: datetime

    class Config:
        from_attributes = True

class UserFileAccessCreate(BaseModel):
    file_id: int
    shared_with_user_id: int
    permission: str = "view_only"

class UserFileAccessUpdate(BaseModel):
    permission: str

class UserFileAccessResponse(BaseModel):
    id: int
    file_id: int
    owner_id: int
    shared_with_user_id: int
    permission: str
    created_at: datetime
    
    file_name: Optional[str] = None
    file_size: Optional[int] = None
    file_type: Optional[str] = None
    category: Optional[str] = None
    owner_name: Optional[str] = None
    owner_email: Optional[str] = None
    shared_with_name: Optional[str] = None
    shared_with_email: Optional[str] = None

    class Config:
        from_attributes = True
