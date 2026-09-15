import uuid

from sqlalchemy import Column, String, BigInteger, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base


class FileRecord(Base):
    __tablename__ = "files"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    owner_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False
    )

    filename = Column(String, nullable=False)

    storage_path = Column(String, nullable=False)

    size_bytes = Column(BigInteger, nullable=False)

    uploaded_at = Column(DateTime, nullable=True)

    encrypted_key = Column(String, nullable=False)

    key_nonce = Column(String, nullable=False)

    file_nonce = Column(String, nullable=False)

    owner = relationship("User", back_populates="files")

    shares = relationship(
        "ShareLink",
        back_populates="file",
        cascade="all, delete-orphan"
    )