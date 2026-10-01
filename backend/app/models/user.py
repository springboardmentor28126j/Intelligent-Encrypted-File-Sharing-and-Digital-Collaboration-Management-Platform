from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    role: Mapped[str] = mapped_column(String(20), default="USER", nullable=False)
    mfa_secret: Mapped[str | None] = mapped_column(String(64), nullable=True)
    mfa_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    storage_quota: Mapped[int] = mapped_column(BigInteger, default=5 * 1024 * 1024 * 1024, nullable=False)
    used_storage: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    oauth_provider: Mapped[str | None] = mapped_column(String(30), nullable=True)
    oauth_subject: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    folders = relationship("Folder", back_populates="owner")
    files = relationship("File", back_populates="owner")
    owned_shares = relationship("FileShare", foreign_keys="FileShare.owner_id", back_populates="owner")
    shared_shares = relationship("FileShare", foreign_keys="FileShare.shared_with_id", back_populates="shared_with")
    share_links = relationship("ShareLink", back_populates="owner")
    sessions = relationship("UserSession", back_populates="user", cascade="all, delete-orphan")
    audit_logs = relationship(
    "AuditLog",
    back_populates="user",
    cascade="all, delete-orphan",)
