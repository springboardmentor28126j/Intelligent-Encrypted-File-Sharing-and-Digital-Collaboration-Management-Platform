from typing import Annotated

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.user import User
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

# Reusable DB Dependency
DatabaseDep = Annotated[Session, Depends(get_db)]

# Use HTTPBearer instead of OAuth2PasswordBearer
security = HTTPBearer()
SecurityDep = Annotated[HTTPAuthorizationCredentials, Depends(security)]


def get_current_user(
    credentials: SecurityDep,
    db: DatabaseDep,
) -> User:
    # credentials.credentials holds the raw JWT string
    token = credentials.credentials

    try:
        user_id = decode_access_token(token)

        # Defensive check to extract integer ID if payload dictionary was returned
        if isinstance(user_id, dict):
            user_id = user_id.get("user_id") or user_id.get("sub") or user_id.get("id")

        target_id = int(user_id)

    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={
                "WWW-Authenticate": "Bearer",
            },
        )

    user = (
        db.query(User)
        .filter(User.id == target_id)
        .first()
    )

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={
                "WWW-Authenticate": "Bearer",
            },
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive",
        )

    return user

# Module-level Annotated dependency for route handlers
CurrentUserDep = Annotated[User, Depends(get_current_user)]