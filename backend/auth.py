from datetime import datetime, timedelta, timezone

from passlib.context import CryptContext
from jose import jwt, JWTError


# =========================================================
# PASSWORD HASHING
# =========================================================

pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto"
)


def hash_password(password: str):

    return pwd_context.hash(password)


def verify_password(
    plain_password: str,
    hashed_password: str
):

    return pwd_context.verify(
        plain_password,
        hashed_password
    )


# =========================================================
# JWT SETTINGS
# =========================================================

SECRET_KEY = "TRUSTSHARE_CHANGE_THIS_SECRET_KEY_123456"

ALGORITHM = "HS256"

ACCESS_TOKEN_EXPIRE_MINUTES = 60


# =========================================================
# CREATE JWT
# =========================================================

def create_access_token(
    user_id: int,
    username: str,
    role: str
):

    expire = datetime.now(
        timezone.utc
    ) + timedelta(
        minutes=ACCESS_TOKEN_EXPIRE_MINUTES
    )

    payload = {
        "sub": str(user_id),
        "username": username,
        "role": role,
        "exp": expire
    }

    token = jwt.encode(
        payload,
        SECRET_KEY,
        algorithm=ALGORITHM
    )

    return token


# =========================================================
# VERIFY JWT
# =========================================================

def verify_token(token: str):

    try:

        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )

        user_id = payload.get("sub")
        username = payload.get("username")
        role = payload.get("role")

        if user_id is None:
            return None

        return {
            "user_id": int(user_id),
            "username": username,
            "role": role
        }

    except JWTError:

        return None