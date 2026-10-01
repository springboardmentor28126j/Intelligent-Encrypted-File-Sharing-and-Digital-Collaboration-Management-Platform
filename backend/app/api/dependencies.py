from datetime import datetime, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_access_token, hash_identifier
from app.models.collaboration import UserSession
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    exc = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired authentication token", headers={"WWW-Authenticate":"Bearer"})
    try:
        payload = decode_access_token(token); subject = payload.get("sub"); jti = payload.get("jti")
        if subject is None: raise exc
        user_id = int(subject)
    except (JWTError, ValueError, TypeError): raise exc
    user = db.scalar(select(User).where(User.id == user_id))
    if not user: raise exc
    if jti:
        session = db.scalar(select(UserSession).where(UserSession.jti_hash == hash_identifier(jti), UserSession.user_id == user_id))
        now = datetime.now(timezone.utc)
        if not session or session.revoked_at is not None or session.expires_at <= now: raise exc
    return user

def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_active: 
        raise HTTPException(status_code=403, detail="User account is inactive")
    return current_user

def require_admin(current_user: User = Depends(get_current_active_user)) -> User:
    if current_user.role.upper() != "ADMIN": 
        raise HTTPException(status_code=403, detail="Administrator access required")
    return current_user
