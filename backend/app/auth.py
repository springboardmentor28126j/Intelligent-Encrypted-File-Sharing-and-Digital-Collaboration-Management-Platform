from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError

from app.security import SECRET_KEY, ALGORITHM


security = HTTPBearer()


# =========================================================
# Get Current Logged-In User
# =========================================================

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):

    token = credentials.credentials

    credentials_exception = HTTPException(
        status_code=401,
        detail="Could not validate credentials"
    )

    try:

        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )

        user_id = payload.get("user_id")
        email = payload.get("email")
        role = payload.get("role")

        if user_id is None or email is None:
            raise credentials_exception

        # Old tokens without a role are treated as normal users
        if role is None:
            role = "user"

        return {
            "user_id": user_id,
            "email": email,
            "role": role
        }

    except JWTError:
        raise credentials_exception


# =========================================================
# Admin Authorization
# =========================================================

def get_current_admin(
    current_user: dict = Depends(get_current_user)
):

    if current_user.get("role") != "admin":

        raise HTTPException(
            status_code=403,
            detail="Admin access required"
        )

    return current_user