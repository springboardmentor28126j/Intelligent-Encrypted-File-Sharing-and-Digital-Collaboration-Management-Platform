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
    shared_links = relationship("SharedLink", back_populates="file", cascade="all, delete-orphan")


class SharedLink(Base):
    __tablename__ = "shared_links"

    id = Column(Integer, primary_key=True, index=True)
    file_id = Column(Integer, ForeignKey("files.id", ondelete="CASCADE"), nullable=False)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token = Column(String(100), unique=True, index=True, nullable=False)
    permission = Column(String(20), default="view_only") # view_only, can_download
    expires_at = Column(DateTime(timezone=True), nullable=True)
    max_downloads = Column(Integer, nullable=True)
    current_downloads = Column(Integer, default=0)
    shared_to = Column(String(255), nullable=True)
    user_file_access_id = Column(Integer, ForeignKey("user_file_access.id", ondelete="CASCADE"), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    file = relationship("FileModel", back_populates="shared_links")
    owner = relationship("User")
    activity_logs = relationship("ShareActivityLog", back_populates="shared_link", cascade="all, delete-orphan")
    user_file_access = relationship("UserFileAccess")


class ShareActivityLog(Base):
    __tablename__ = "share_activity_logs"

    id = Column(Integer, primary_key=True, index=True)
    link_id = Column(Integer, ForeignKey("shared_links.id", ondelete="CASCADE"), nullable=False)
    action = Column(String(50), nullable=False) # e.g., viewed, downloaded
    ip_address = Column(String(50), nullable=True)
    user_agent = Column(String(255), nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    shared_link = relationship("SharedLink", back_populates="activity_logs")


class UserFileAccess(Base):
    __tablename__ = "user_file_access"

    id = Column(Integer, primary_key=True, index=True)
    file_id = Column(Integer, ForeignKey("files.id", ondelete="CASCADE"), nullable=False)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    shared_with_user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    permission = Column(String(20), default="view_only") # view_only, can_download, can_edit
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    file = relationship("FileModel")
    owner = relationship("User", foreign_keys=[owner_id])
    shared_with_user = relationship("User", foreign_keys=[shared_with_user_id])