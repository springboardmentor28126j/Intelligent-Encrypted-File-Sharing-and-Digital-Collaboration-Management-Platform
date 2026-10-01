import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import (
    create_access_token,
    hash_identifier,
    hash_password,
    verify_password,
)
from app.models.collaboration import PasswordResetToken, UserSession
from app.models.user import User
from app.schemas.auth import UserCreate


def register_user(db: Session, user_data: UserCreate) -> User:
    email = user_data.email.lower()
    if db.scalar(select(User).where(User.email == email)):
        raise ValueError("Email already registered")
    user = User(name=user_data.name.strip(), email=email, password_hash=hash_password(user_data.password), role="USER", is_active=True)
    db.add(user); db.commit(); db.refresh(user); return user

def authenticate_user(db: Session, email: str, password: str) -> User | None:
    user = db.scalar(select(User).where(User.email == email.lower()))
    return user if user and verify_password(password, user.password_hash) else None

def create_session(db: Session, user: User, user_agent: str | None, ip: str | None) -> tuple[str, datetime]:
    token, jti, expires = create_access_token(user.id, user.role)
    db.add(UserSession(user_id=user.id, jti_hash=hash_identifier(jti), user_agent=user_agent, ip_address=ip, expires_at=expires))
    db.commit()
    return token, expires

def revoke_session(db: Session, jti: str) -> None:
    session = db.scalar(select(UserSession).where(UserSession.jti_hash == hash_identifier(jti), UserSession.revoked_at.is_(None)))
    if session: session.revoked_at = datetime.now(timezone.utc); db.commit()

def revoke_all_sessions(db: Session, user_id: int) -> None:
    sessions = db.scalars(select(UserSession).where(UserSession.user_id == user_id, UserSession.revoked_at.is_(None))).all()
    now = datetime.now(timezone.utc)
    for s in sessions: s.revoked_at = now
    db.commit()

def create_reset_token(db: Session, user: User) -> str:
    raw = secrets.token_urlsafe(48)
    db.add(PasswordResetToken(user_id=user.id, token_hash=hash_identifier(raw), expires_at=datetime.now(timezone.utc)+timedelta(minutes=settings.PASSWORD_RESET_EXPIRE_MINUTES)))
    db.commit(); return raw
