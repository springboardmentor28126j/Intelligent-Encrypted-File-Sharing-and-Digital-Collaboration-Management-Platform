from datetime import datetime, timezone

from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey

from app.core.database import Base


class Notification(Base):
    """
    In-app notification. Covers the spec's Notification Module:
    file-sharing notifications, access alerts, security warnings,
    download notifications, expiration reminders.

    Email delivery is stubbed (logged, not actually sent) so the project
    runs without SMTP credentials - see services/notification_service.py.
    """
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # e.g. "file.shared", "share.accessed", "security.suspicious_login",
    #      "share.expiring_soon", "file.downloaded"
    type = Column(String, nullable=False)
    title = Column(String, nullable=False)
    message = Column(String, nullable=False)

    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
