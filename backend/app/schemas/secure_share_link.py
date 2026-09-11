from datetime import datetime

from pydantic import BaseModel

class SecureShareLinkCreate(BaseModel):
    expiration: str | None = "never"  # Options: "never", "1h", "1d", "7d"

class SecureShareLinkResponse(BaseModel):
    id: int
    file_id: int
    share_url: str
    created_at: datetime
    expires_at: datetime | None = None
    revoked_at: datetime | None = None

    model_config = {"from_attributes": True}
