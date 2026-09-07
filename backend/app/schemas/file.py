from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List

# --- FOLDER SCHEMAS ---

class FolderCreate(BaseModel):
    name: str
    parent_id: Optional[int] = None

class FolderOut(BaseModel):
    id: int
    name: str
    parent_id: Optional[int] = None
    owner_id: int
    created_at: datetime

    class Config:
        from_attributes = True


# --- FILE SCHEMAS ---

class FileOut(BaseModel):
    id: int
    original_filename: str
    file_size: int
    file_type: str
    category: str
    folder_id: Optional[int] = None
    uploaded_at: datetime
    owner_id: int

    class Config:
        from_attributes = True


# --- DASHBOARD LIST RESPONSE SCHEMA ---

class ExplorerContentResponse(BaseModel):
    folders: List[FolderOut]
    files: List[FileOut]