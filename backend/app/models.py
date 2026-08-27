from sqlalchemy import Column, Integer, String
from app.database import Base


# =========================================================
# User Model
# =========================================================

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

    # User role for Role-Based Access Control
    role = Column(
        String,
        nullable=False,
        default="user"
    )


# =========================================================
# Shared File Model
# =========================================================

class SharedFile(Base):

    __tablename__ = "shared_files"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    filename = Column(
        String,
        nullable=False
    )

    # Owner of the original uploaded file
    owner_id = Column(
        Integer,
        nullable=False
    )

    # Person who shared the file
    sender_id = Column(
        Integer,
        nullable=False
    )

    # Person receiving the file
    recipient_id = Column(
        Integer,
        nullable=False
    )