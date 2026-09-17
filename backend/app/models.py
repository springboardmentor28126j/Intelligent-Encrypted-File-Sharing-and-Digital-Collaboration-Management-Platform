from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from .database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)

    username = Column(
        String,
        nullable=False
    )

    email = Column(
        String,
        unique=True,
        index=True,
        nullable=False
    )

    password = Column(
        String,
        nullable=False
    )

    role = Column(
        String,
        default="user",
        nullable=False
    )


class FileShare(Base):
    __tablename__ = "file_shares"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    owner_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False
    )

    shared_with_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False
    )

    storage_path = Column(
        String,
        nullable=False
    )

    permission = Column(
        String,
        default="download",
        nullable=False
    )

    expires_at = Column(
        DateTime,
        nullable=True
    )

    is_revoked = Column(
        Integer,
        default=0,
        nullable=False
    )

    created_at = Column(
        DateTime,
        nullable=False
    )