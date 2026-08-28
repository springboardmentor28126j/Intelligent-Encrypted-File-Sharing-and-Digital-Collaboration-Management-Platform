from datetime import datetime
from pydantic import BaseModel


class FileRename(BaseModel):
    original_filename: str


class FileResponse(BaseModel):
    id: int
    original_filename: str
    file_size: int
    file_type: str
    category: str
    version: int
    folder_id: int | None
    folder_name: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
