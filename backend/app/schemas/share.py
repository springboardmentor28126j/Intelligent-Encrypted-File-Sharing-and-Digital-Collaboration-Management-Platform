from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator


class DirectShareCreate(BaseModel):
    file_id:int; 
    email:EmailStr; 
    permission:str=Field(
        default="READ",
        pattern="^(READ|WRITE)$"); 
    can_download:bool=True; 
    expires_at:datetime|None=None; 
    max_downloads:int|None=Field(default=None,ge=1)

class ShareResponse(BaseModel):
    id:int; 
    file_id:int; 
    owner_id:int; 
    shared_with_id:int; 
    permission:str; 
    can_download:bool; 
    expires_at:datetime|None; 
    max_downloads:int|None; 
    download_count:int; 
    is_revoked:bool; 
    created_at:datetime; 
    updated_at:datetime

    model_config=ConfigDict(from_attributes=True)

class ShareLinkCreate(BaseModel):
    file_id:int; 
    permission:str=Field(
        default="READ",
        pattern="^(READ|WRITE)$"); 
    can_download:bool=True; 
    expires_at:datetime; 
    max_downloads:int|None=Field(default=None,ge=1)

class ShareLinkResponse(BaseModel):
    id:int; 
    file_id:int; 
    permission:str; 
    can_download:bool; 
    max_downloads:int|None; 
    download_count:int; 
    expires_at:datetime; 
    is_revoked:bool; 
    created_at:datetime

    model_config=ConfigDict(from_attributes=True)

class ShareLinkCreatedResponse(BaseModel): 
    message:str; 
    share_link:ShareLinkResponse; 
    access_token:str; 
    access_url:str

class PublicShareResponse(BaseModel): 
    file_id:int; 
    filename:str; 
    content_type:str|None; 
    size:int; 
    permission:str; 
    can_download:bool; 
    expires_at:datetime
