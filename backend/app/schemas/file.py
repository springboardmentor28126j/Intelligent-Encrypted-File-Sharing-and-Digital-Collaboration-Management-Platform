from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class FileResponse(BaseModel):
    id:int; 
    owner_id:int; 
    folder_id:int|None; 
    filename:str; 
    content_type:str|None; 
    size:int; 
    category:str; 
    is_deleted:bool; 
    created_at:datetime; 
    updated_at:datetime
    model_config=ConfigDict(from_attributes=True)

class FileUploadResponse(BaseModel): 
    message:str; 
    file:FileResponse

class FileVersionResponse(BaseModel):
    id:int; 
    file_id:int; 
    version_number:int; 
    filename:str; 
    content_type:str|None; 
    size:int; 
    encryption_version:int; 
    created_at:datetime
    model_config=ConfigDict(from_attributes=True)
    
class FileMetadataResponse(FileResponse): 
    encryption_status:str
