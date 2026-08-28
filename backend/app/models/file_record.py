from datetime import datetime, timezone

from sqlalchemy import Column, Integer, String, BigInteger, ForeignKey, DateTime, LargeBinary
from sqlalchemy.orm import relationship

from app.core.database import Base


class FileRecord(Base):
    __tablename__ = "files"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    filename = Column(String, nullable=False)
    content_type = Column(String, nullable=True)
    size_bytes = Column(BigInteger, nullable=False)

    # Where the encrypted blob lives (local path or s3 key)
    storage_object_key = Column(String, nullable=False)

    # Encryption metadata — never store a raw usable key.
    wrapped_key = Column(String, nullable=False)
    nonce = Column(LargeBinary, nullable=False)

    version = Column(Integer, default=1)
    folder = Column(String, default="/")

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc),
                         onupdate=lambda: datetime.now(timezone.utc))

    owner = relationship("User", back_populates="files")
    shares = relationship("ShareLink", back_populates="file", cascade="all, delete-orphan")
