from sqlalchemy import Column, Integer, String, DateTime, Text
from datetime import datetime

from database.connection import Base


class ActivityLog(Base):
    __tablename__ = "activity_logs"
    __table_args__ = {"schema": "public"}

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    user_id = Column(
        Integer,
        nullable=True
    )

    user_email = Column(
        String,
        nullable=True
    )

    action = Column(
        String,
        nullable=False
    )

    filename = Column(
        String,
        nullable=True
    )

    details = Column(
        Text,
        nullable=True
    )

    ip_address = Column(
        String,
        nullable=True
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )