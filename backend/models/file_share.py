from sqlalchemy import Column, Integer, String, DateTime
from datetime import datetime

from database.connection import Base


class FileShare(Base):
    __tablename__ = "file_shares"
    __table_args__ = {"schema": "public"}

    id = Column(Integer, primary_key=True, index=True)

    filename = Column(String, nullable=False)

    sender_id = Column(Integer, nullable=False)

    recipient_email = Column(String, nullable=False)

    permission = Column(
        String,
        nullable=False,
        default="read"
    )

    expires_at = Column(
        DateTime,
        nullable=True
    )
    share_token = Column(
    String,
    unique=True,
    nullable=True
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )