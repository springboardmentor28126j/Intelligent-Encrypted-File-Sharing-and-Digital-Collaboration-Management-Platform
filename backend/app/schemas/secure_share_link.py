from datetime import datetime

from pydantic import BaseModel


class SecureShareLinkResponse(BaseModel):
    id: int
    file_id: int
    share_url: str
    created_at: datetime
    revoked_at: datetime | None = None

    model_config = {"from_attributes": True}
