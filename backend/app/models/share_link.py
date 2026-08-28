from datetime import datetime, timezone

from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from app.core.database import Base


class ShareLink(Base):
    __tablename__ = "share_links"

    id = Column(Integer, primary_key=True, index=True)
    file_id = Column(Integer, ForeignKey("files.id"), nullable=False)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    token = Column(String, unique=True, index=True, nullable=False)

    permission = Column(String, default="view")  # view | download
    max_downloads = Column(Integer, nullable=True)
    download_count = Column(Integer, default=0)

    expires_at = Column(DateTime, nullable=False)
    revoked = Column(Boolean, default=False)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    file = relationship("FileRecord", back_populates="shares")

    def is_valid(self) -> bool:
        if self.revoked:
            return False
        if datetime.now(timezone.utc) > self.expires_at.replace(tzinfo=timezone.utc):
            return False
        if self.max_downloads is not None and self.download_count >= self.max_downloads:
            return False
        return True
