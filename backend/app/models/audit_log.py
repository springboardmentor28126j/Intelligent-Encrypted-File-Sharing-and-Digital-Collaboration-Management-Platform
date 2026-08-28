from datetime import datetime, timezone

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey

from app.core.database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String, nullable=False)       # e.g. "file.upload", "file.download", "share.create"
    resource_type = Column(String, nullable=True)  # "file" | "share_link" | "user"
    resource_id = Column(String, nullable=True)
    ip_address = Column(String, nullable=True)
    detail = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
