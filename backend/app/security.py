from jose import jwt
from datetime import datetime, timedelta
from decouple import config


# =========================================================
# JWT Configuration
# =========================================================

SECRET_KEY = config("JWT_SECRET_KEY")
ALGORITHM = "HS256"

ACCESS_TOKEN_EXPIRE_MINUTES = 60


# =========================================================
# Create Access Token
# Used when the user logs into TrustShare
# =========================================================

def create_access_token(data: dict):

    to_encode = data.copy()

    expire = datetime.utcnow() + timedelta(
        minutes=ACCESS_TOKEN_EXPIRE_MINUTES
    )

    to_encode.update({
        "exp": expire
    })

    return jwt.encode(
        to_encode,
        SECRET_KEY,
        algorithm=ALGORITHM
    )


# =========================================================
# Create Password Reset Token
# Used only for Forgot Password
# =========================================================

def create_password_reset_token(user_id: int):

    # Reset token is valid for 15 minutes
    expire = datetime.utcnow() + timedelta(
        minutes=15
    )

    data = {
        "user_id": user_id,
        "type": "password_reset",
        "exp": expire
    }

    return jwt.encode(
        data,
        SECRET_KEY,
        algorithm=ALGORITHM
    )


# =========================================================
# Verify Password Reset Token
# =========================================================

def verify_password_reset_token(token: str):

    try:

        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )

        # Make sure this is a password-reset token
        if payload.get("type") != "password_reset":
            return None

        # Get user ID from the token
        user_id = payload.get("user_id")

        if user_id is None:
            return None

        return user_id

    except Exception:

        # Token is invalid or expired
        return None