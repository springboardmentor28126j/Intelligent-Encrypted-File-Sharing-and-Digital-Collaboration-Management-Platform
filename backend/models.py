from sqlalchemy import Column, Integer, String, DateTime, Boolean
from database import Base
from datetime import datetime

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, default="")
    email = Column(String, unique=True, index=True)
    password = Column(String)
    role = Column(String, default="user")
from sqlalchemy import DateTime
from datetime import datetime

class FileRecord(Base):
    __tablename__ = "files"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String)
    stored_name = Column(String)
    owner_email = Column(String)
    file_size = Column(Integer, default=0)
    is_encrypted = Column(Boolean, default=True)
    upload_time = Column(DateTime, default=datetime.utcnow)
import secrets as pysecrets

class ShareLink(Base):
    __tablename__ = "share_links"

    id = Column(Integer, primary_key=True, index=True)
    file_id = Column(Integer)
    share_token = Column(String, unique=True, index=True)
    created_by = Column(String)
    recipient_email = Column(String, nullable=True)   # NEW
    expires_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)