
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from database import SessionLocal
from models import User

from security import (
    hash_password,
    verify_password,
    create_access_token
)


# ==========================================
# ROUTER
# ==========================================

router = APIRouter(
    tags=["Authentication"]
)


# ==========================================
# DATABASE
# ==========================================

def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()


# ==========================================
# REGISTER
# ==========================================

@router.post("/register")
def register(
    name: str,
    email: str,
    password: str,
    db: Session = Depends(get_db)
):

    # Check if email already exists
    existing_user = (
        db.query(User)
        .filter(
            User.email == email
        )
        .first()
    )

    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )

    # Hash password before saving
    hashed_password = hash_password(
        password
    )

    # Create user
    new_user = User(
        name=name,
        email=email,
        password=hashed_password,
        role="user"
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return {
        "message": "Registration successful",
        "user_id": new_user.id,
        "name": new_user.name,
        "email": new_user.email
    }


# ==========================================
# LOGIN
# ==========================================

@router.post("/login")
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):

    print("LOGIN EMAIL:", form_data.username)

    # Find user by email
    user = (
        db.query(User)
        .filter(
            User.email == form_data.username
        )
        .first()
    )

    if user is None:

        print("USER NOT FOUND")

        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    print("USER FOUND:", user.id)

    # Verify password
    try:

        password_valid = verify_password(
            form_data.password,
            user.password
        )

        print(
            "PASSWORD VALID:",
            password_valid
        )

    except Exception as error:

        print(
            "PASSWORD VERIFICATION ERROR:",
            repr(error)
        )

        raise HTTPException(
            status_code=500,
            detail="Password verification failed"
        )

    if not password_valid:

        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    # Create JWT token
    access_token = create_access_token(
        {
            "user_id": user.id
        }
    )

    return {
        "message": "Login successful",
        "access_token": access_token,
        "token_type": "bearer",
        "user_id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role
    }

