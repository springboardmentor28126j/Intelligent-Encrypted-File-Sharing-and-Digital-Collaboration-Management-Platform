from sqlalchemy import Column, Integer, String, DateTime
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
    owner_email = Column(String)
    file_size = Column(Integer, default=0)
    upload_time = Column(DateTime, default=datetime.utcnow)