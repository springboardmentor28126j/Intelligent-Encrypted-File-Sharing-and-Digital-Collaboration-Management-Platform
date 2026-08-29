from sqlalchemy import Column, Integer, String, DateTime
from database import Base


# ==========================================
# USER MODEL
# ==========================================

class User(Base):
    __tablename__ = "users"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    name = Column(
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

    # Password reset fields
    reset_token = Column(
        String,
        nullable=True
    )

    reset_token_expires = Column(
        DateTime(timezone=True),
        nullable=True
    )


# ==========================================
# FILE MODEL
# ==========================================

class File(Base):
    __tablename__ = "files"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    filename = Column(
        String,
        nullable=False
    )

    stored_filename = Column(
        String,
        nullable=False
    )

    file_path = Column(
        String,
        nullable=False
    )

    owner_id = Column(
        Integer,
        nullable=False
    )