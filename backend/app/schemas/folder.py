from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class FolderCreate(BaseModel):

    name: str = Field(
        min_length=1,
        max_length=255,
    )

    parent_id: int | None = None
  
class FolderResponse(BaseModel):

    id: int
    name: str
    parent_id: int | None
    owner_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        from_attributes = True
    )



class FolderRename(BaseModel):
    name: str = Field(min_length=1, max_length=255)
