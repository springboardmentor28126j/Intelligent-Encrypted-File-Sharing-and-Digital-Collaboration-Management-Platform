from sqlalchemy import Column, Integer, String, Boolean, DateTime
from database.connection import Base
from datetime import datetime


class File(Base):
    __tablename__ = "files"
    __table_args__ = {"schema": "public"}

    id = Column(Integer, primary_key=True, index=True)

    filename = Column(String, nullable=False)

    owner_id = Column(Integer, nullable=False)

    stored_name = Column(String, nullable=True)

    owner_email = Column(String, nullable=True)

    file_size = Column(Integer, nullable=True)

    is_encrypted = Column(Boolean, default=False)

    upload_time = Column(
        DateTime,
        default=datetime.utcnow
    )