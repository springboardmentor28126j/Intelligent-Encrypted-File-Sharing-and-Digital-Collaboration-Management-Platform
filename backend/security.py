from datetime import datetime, timedelta, timezone

from jose import jwt, JWTError
from passlib.context import CryptContext

from fastapi import (
    Depends,
    HTTPException,
    status
)

from fastapi.security import (
    HTTPBearer,
    HTTPAuthorizationCredentials
)

from sqlalchemy.orm import Session

from database import SessionLocal
from models import User


# =========================================================
# JWT CONFIGURATION
# =========================================================

SECRET_KEY = "intelligent-file-sharing-secret-key"

ALGORITHM = "HS256"

ACCESS_TOKEN_EXPIRE_MINUTES = 60


# =========================================================
# PASSWORD HASHING
# =========================================================

pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto"
)


# =========================================================
# BEARER AUTHENTICATION
# =========================================================

bearer_scheme = HTTPBearer()


# =========================================================
# HASH PASSWORD
# =========================================================

def hash_password(password: str) -> str:

    return pwd_context.hash(password)


# =========================================================
# VERIFY PASSWORD
# =========================================================

def verify_password(
    plain_password: str,
    hashed_password: str
) -> bool:

    return pwd_context.verify(
        plain_password,
        hashed_password
    )


# =========================================================
# CREATE ACCESS TOKEN
# =========================================================

def create_access_token(
    data: dict
) -> str:

    to_encode = data.copy()

    expire = (
        datetime.now(timezone.utc)
        + timedelta(
            minutes=ACCESS_TOKEN_EXPIRE_MINUTES
        )
    )

    to_encode["exp"] = expire

    encoded_jwt = jwt.encode(
        to_encode,
        SECRET_KEY,
        algorithm=ALGORITHM
    )

    return encoded_jwt


# =========================================================
# DATABASE DEPENDENCY
# =========================================================

def get_db():

    db = SessionLocal()

    try:

        yield db

    finally:

        db.close()


# =========================================================
# GET CURRENT USER
# =========================================================

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(
        bearer_scheme
    ),
    db: Session = Depends(get_db)
):

    token = credentials.credentials

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={
            "WWW-Authenticate": "Bearer"
        }
    )

    # -----------------------------------------------------
    # DECODE JWT
    # -----------------------------------------------------

    try:

        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )

        user_id = payload.get("user_id")

        if user_id is None:

            raise credentials_exception

        try:

            user_id = int(user_id)

        except (ValueError, TypeError):

            raise credentials_exception

    except JWTError:

        raise credentials_exception

    # -----------------------------------------------------
    # FIND USER
    # -----------------------------------------------------

    user = (
        db.query(User)
        .filter(
            User.id == user_id
        )
        .first()
    )

    if user is None:

        raise credentials_exception

    return user


# =========================================================
# GET CURRENT ADMIN
# =========================================================

def get_current_admin(
    current_user: User = Depends(
        get_current_user
    )
):

    # -----------------------------------------------------
    # CHECK USER ROLE
    # -----------------------------------------------------

    if current_user.role != "admin":

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )

    return current_user