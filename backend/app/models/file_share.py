from datetime import datetime
from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..database import Base


class FileShare(Base):
    __tablename__ = "file_shares"
    __table_args__ = (UniqueConstraint("file_id", "shared_with_user_id", name="uq_file_share_user"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    file_id: Mapped[int] = mapped_column(ForeignKey("files.id"), nullable=False, index=True)
    shared_with_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    permission: Mapped[str] = mapped_column(String(20), nullable=False, default="VIEWER")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    file = relationship("File", back_populates="shares")
    shared_with_user = relationship("User", foreign_keys="FileShare.shared_with_user_id", back_populates="file_shares_received")
