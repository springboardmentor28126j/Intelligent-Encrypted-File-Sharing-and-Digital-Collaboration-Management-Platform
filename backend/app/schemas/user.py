from pydantic import BaseModel, Field


class ProfileUpdate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
