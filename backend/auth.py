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
from models import User
from schemas import (
    UserRegister,
    UserResponse,
    UserLogin,
    TokenResponse
)


# Authentication router
router = APIRouter(
    prefix="/auth",
    tags=["Authentication"]
)


# Password hashing configuration
pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto"
)


# JWT configuration
SECRET_KEY = "trustshare-secret-key-change-this-later"
ALGORITHM = "HS256"


# Bearer token security
security = HTTPBearer()


# ============================================================
# REGISTER USER
# ============================================================

@router.post(
    "/register",
    response_model=UserResponse,
    status_code=201
)
def register_user(
    user_data: UserRegister,
    db: Session = Depends(get_db)
):
    # Check whether email already exists
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

    # Hash password before storing it
    hashed_password = pwd_context.hash(
        user_data.password
    )

    # Create new user
    new_user = User(
        name=user_data.name,
        email=user_data.email,
        password_hash=hashed_password
    )

    # Save user to database
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return new_user


# ============================================================
# LOGIN USER
# ============================================================

@router.post(
    "/login",
    response_model=TokenResponse
)
def login_user(
    user_data: UserLogin,
    db: Session = Depends(get_db)
):
    # Find user by email
    user = (
        db.query(User)
        .filter(User.email == user_data.email)
        .first()
    )

    # If user does not exist
    if not user:
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    # Verify password
    password_valid = pwd_context.verify(
        user_data.password,
        user.password_hash
    )

    # If password is incorrect
    if not password_valid:
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    # Data stored inside JWT
    token_data = {
        "sub": str(user.id),
        "email": user.email
    }

    # Generate JWT access token
    access_token = jwt.encode(
        token_data,
        SECRET_KEY,
        algorithm=ALGORITHM
    )

    return {
        "access_token": access_token,
        "token_type": "bearer"
    }


# ============================================================
# GET CURRENT USER FROM JWT
# ============================================================

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    # Extract token from Authorization header
    token = credentials.credentials

    try:
        # Decode and verify JWT
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )

        # Get user ID from token
        user_id = payload.get("sub")

        if user_id is None:
            raise HTTPException(
                status_code=401,
                detail="Invalid authentication token"
            )

    except Exception:
        raise HTTPException(
            status_code=401,
            detail="Invalid authentication token"
        )

    # Find user in database
    user = (
        db.query(User)
        .filter(User.id == int(user_id))
        .first()
    )

    # User doesn't exist
    if user is None:
        raise HTTPException(
            status_code=401,
            detail="User not found"
        )

    return user


# ============================================================
# GET CURRENT USER PROFILE
# ============================================================

@router.get(
    "/me",
    response_model=UserResponse
)
def get_my_profile(
    current_user: User = Depends(get_current_user)
):
    return current_user