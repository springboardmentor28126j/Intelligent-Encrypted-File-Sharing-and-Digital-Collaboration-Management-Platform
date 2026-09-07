from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base


class FileEncryption(Base):
    __tablename__ = "file_encryptions"
    __table_args__ = (UniqueConstraint("file_id", name="uq_file_encryption_file"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    file_id: Mapped[int] = mapped_column(ForeignKey("files.id"), nullable=False, index=True)
    algorithm: Mapped[str] = mapped_column(String(40), nullable=False, default="AES-256-GCM")
    key_version: Mapped[str] = mapped_column(String(20), nullable=False, default="v1")
    wrapped_key: Mapped[str] = mapped_column(String(512), nullable=False)
    key_nonce: Mapped[str] = mapped_column(String(64), nullable=False)
    file_nonce: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    file = relationship("File", back_populates="encryption")