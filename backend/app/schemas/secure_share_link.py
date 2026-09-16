from datetime import datetime
from pydantic import BaseModel, Field

class SecureShareLinkCreate(BaseModel):
    expiration: str | None = "never"  # "never", "1m", "1h", "1d", "7d"
    max_downloads: int | None = Field(default=None, ge=1)  # None = Unlimited

class SecureShareLinkResponse(BaseModel):
    id: int
    file_id: int
    share_url: str
    created_at: datetime
    expires_at: datetime | None = None
    revoked_at: datetime | None = None
    max_downloads: int | None = None
    download_count: int = 0

    model_config = {"from_attributes": True}