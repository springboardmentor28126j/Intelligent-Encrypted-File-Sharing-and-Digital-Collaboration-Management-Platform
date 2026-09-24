import os
from uuid import UUID

from dotenv import load_dotenv
from fastapi import (
    APIRouter,
    Depends,
    HTTPException
)
from fastapi.security import (
    HTTPBearer,
    HTTPAuthorizationCredentials
)
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from jose import jwt

from database import get_db
from models import User, ActivityLog
from schemas import (
    UserRegister,
    UserResponse,
    UserLogin,
    TokenResponse
)


load_dotenv()


router = APIRouter(
    prefix="/auth",
    tags=["Authentication"]
)


pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto"
)


SECRET_KEY = os.getenv(
    "TRUSTSHARE_JWT_SECRET_KEY"
)

ALGORITHM = "HS256"


if not SECRET_KEY:
    raise RuntimeError(
        "TRUSTSHARE_JWT_SECRET_KEY is not configured"
    )


security = HTTPBearer()


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=201
)
def register_user(
    user_data: UserRegister,
    db: Session = Depends(get_db)
):
    existing_user = (
        db.query(User)
        .filter(User.email == user_data.email)
        .first()
    )

    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Email is already registered"
        )

    hashed_password = pwd_context.hash(
        user_data.password
    )

    new_user = User(
        name=user_data.name,
        email=user_data.email,
        password_hash=hashed_password
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return new_user


@router.post(
    "/login",
    response_model=TokenResponse
)
def login_user(
    user_data: UserLogin,
    db: Session = Depends(get_db)
):
    user = (
        db.query(User)
        .filter(User.email == user_data.email)
        .first()
    )

    # ------------------------------------------------------------
    # FAILED LOGIN - UNKNOWN EMAIL
    #
    # Do not store the password or authentication token.
    # There is no known user_id to associate with this event.
    # ------------------------------------------------------------
    if not user:
        failed_log = ActivityLog(
            user_id=None,
            user_email=user_data.email,
            action="authentication_failed",
            method="POST",
            path="/auth/login",
            status_code=401,
            ip_address=None,
            response_time_ms=None
        )

        db.add(failed_log)
        db.commit()

        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    password_valid = pwd_context.verify(
        user_data.password,
        user.password_hash
    )

    # ------------------------------------------------------------
    # FAILED LOGIN - WRONG PASSWORD
    #
    # The email belongs to a known user, so associate the event
    # with that user's UUID. This allows the monitoring dashboard
    # to display the security event for the logged-in account.
    #
    # Never store the submitted password.
    # ------------------------------------------------------------
    if not password_valid:
        failed_log = ActivityLog(
            user_id=user.id,
            user_email=user.email,
            action="authentication_failed",
            method="POST",
            path="/auth/login",
            status_code=401,
            ip_address=None,
            response_time_ms=None
        )

        db.add(failed_log)
        db.commit()

        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    # ------------------------------------------------------------
    # SUCCESSFUL LOGIN
    # ------------------------------------------------------------
    token_data = {
        "sub": str(user.id),
        "email": user.email
    }

    access_token = jwt.encode(
        token_data,
        SECRET_KEY,
        algorithm=ALGORITHM
    )

    return {
        "access_token": access_token,
        "token_type": "bearer"
    }


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    token = credentials.credentials

    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )

        user_id = payload.get("sub")

        if user_id is None:
            raise HTTPException(
                status_code=401,
                detail="Invalid authentication token"
            )

        user_uuid = UUID(str(user_id))

    except HTTPException:
        raise

    except Exception:
        raise HTTPException(
            status_code=401,
            detail="Invalid authentication token"
        )

    user = (
        db.query(User)
        .filter(User.id == user_uuid)
        .first()
    )

    if user is None:
        raise HTTPException(
            status_code=401,
            detail="User not found"
        )

    return user


@router.get(
    "/me",
    response_model=UserResponse
)
def get_my_profile(
    current_user: User = Depends(get_current_user)
):
    return current_user