import hashlib

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User
from ..redis_client import redis_conn
from .security import get_token_subject


oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/auth/token"
)


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:

    # Hash the JWT before using it as the Redis key
    token_hash = hashlib.sha256(
        token.encode()
    ).hexdigest()

    # Check whether the token has been revoked
    if redis_conn.get(
        f"blacklist:{token_hash}"
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been invalidated"
        )

    # Existing JWT validation
    user_id = get_token_subject(token)

    user = db.get(
        User,
        user_id
    ) if user_id else None

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )

    return user


def require_admin(
    current_user: User = Depends(get_current_user)
) -> User:

    if current_user.role.lower() != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )

    return current_user