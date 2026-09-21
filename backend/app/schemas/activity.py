from datetime import datetime
from pydantic import BaseModel

class ActivityResponse(BaseModel):
    id: int
    action: str
    description: str
    file_id: int | None
    ip_address: str | None = None
    user_agent: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}