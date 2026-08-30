"""
models.py – SQLAlchemy ORM models for TrustShare.

Each class maps to a database table. The `User` model stores all
authentication-related data for registered users.
"""

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, Enum as SAEnum
from app.database import Base
import enum


class UserRole(str, enum.Enum):
    """Possible roles a user can have in the system."""
    admin = "admin"
    user = "user"


class User(Base):
    """
    users table – stores registered TrustShare accounts.

    Columns:
        id              – Auto-incrementing primary key
        full_name       – User's display name
        email           – Unique login identifier
        hashed_password – bcrypt hash of the user's password (never store plaintext)
        role            – Enum: 'admin' or 'user' (default: 'user')
        created_at      – UTC timestamp when the account was created
    """

    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    full_name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(
        SAEnum(UserRole, name="userrole"),
        default=UserRole.user,
        nullable=False,
        server_default="user",
    )
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<User id={self.id} email={self.email!r} role={self.role}>"
