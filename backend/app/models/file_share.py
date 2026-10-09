from datetime import datetime
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, UniqueConstraint, event
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..database import Base


class FileShare(Base):
    __tablename__ = "file_shares"
    __table_args__ = (UniqueConstraint("file_id", "shared_with_user_id", name="uq_file_share_user"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    file_id: Mapped[int] = mapped_column(ForeignKey("files.id"), nullable=False, index=True)
    owner_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    shared_with_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    shared_with_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    permission: Mapped[str] = mapped_column(String(20), nullable=False, default="VIEWER")
    can_download: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_revoked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    recipient_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    share_token: Mapped[str | None] = mapped_column(String(64), nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    max_downloads: Mapped[int | None] = mapped_column(Integer, nullable=True)
    download_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    file = relationship("File", back_populates="shares")
    shared_with_user = relationship("User", foreign_keys="FileShare.shared_with_user_id", back_populates="file_shares_received")


@event.listens_for(FileShare, "before_insert")
@event.listens_for(FileShare, "before_update")
def sync_file_share_columns(mapper, connection, target):
    recipient_id = target.shared_with_user_id or target.shared_with_id
    target.shared_with_user_id = recipient_id
    target.shared_with_id = recipient_id
    if target.is_revoked is None:
        target.is_revoked = False
    if target.can_download is None:
        target.can_download = True
    if target.download_count is None:
        target.download_count = 0
