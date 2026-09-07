from sqlalchemy import Column, Integer, String, BigInteger, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(20), default="user")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)

    reset_otp = Column(String(6), nullable=True)
    otp_expiry = Column(DateTime, nullable=True)

    # Relationships
    files = relationship("FileModel", back_populates="owner")
    folders = relationship("FolderModel", back_populates="owner")


class FolderModel(Base):
    __tablename__ = "folders"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    
    # Sub-folder support (Folder ke andar Folder)
    parent_id = Column(Integer, ForeignKey("folders.id"), nullable=True)
    
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    owner = relationship("User", back_populates="folders")
    files = relationship("FileModel", back_populates="folder")
    subfolders = relationship("FolderModel")


class FileModel(Base):
    __tablename__ = "files"

    id = Column(Integer, primary_key=True, index=True)
    original_filename = Column(String(255), nullable=False)
    stored_filename = Column(String(255), nullable=False, unique=True)
    file_path = Column(String(500), nullable=False)
    file_size = Column(BigInteger, nullable=False)
    file_type = Column(String(100), nullable=False)
    
    # New Column for Categorization (image, pdf, document, etc.)
    category = Column(String(50), default="other")
    
    # New Column for Folder Linking (Kis folder me hai)
    folder_id = Column(Integer, ForeignKey("folders.id"), nullable=True)

    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    owner = relationship("User", back_populates="files")
    folder = relationship("FolderModel", back_populates="files")