from .file_routes import router as file_router
from .share_routes import router as share_router
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
from passlib.context import CryptContext

from .database import Base, SessionLocal, engine
from .models import User
from .auth import create_access_token, get_current_user, require_admin

app = FastAPI(title="TrustShare API")
app.include_router(file_router)
app.include_router(share_router)


# -------------------------
# CORS
# -------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# -------------------------
# Password hashing
# -------------------------
pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto"
)


# -------------------------
# Create database tables
# -------------------------
Base.metadata.create_all(bind=engine)


# -------------------------
# Request models
# -------------------------
class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str


class UserLogin(BaseModel):
    email: str
    password: str


# -------------------------
# Root
# -------------------------
@app.get("/")
def root():
    return {
        "message": "TrustShare API is running"
    }


# -------------------------
# REGISTER
# -------------------------
@app.post("/auth/register")
def register(data: RegisterRequest):

    db: Session = SessionLocal()

    try:
        # Check if email already exists
        existing_user = (
            db.query(User)
            .filter(User.email == data.email)
            .first()
        )

        if existing_user:
            raise HTTPException(
                status_code=400,
                detail="Email already registered"
            )

        # Hash password
        hashed_password = pwd_context.hash(data.password)

        # Create user
        new_user = User(
            username=data.username,
            email=data.email,
            password=hashed_password
        )

        db.add(new_user)
        db.commit()
        db.refresh(new_user)

        return {
            "message": "Registration successful",
            "user_id": new_user.id,
            "username": new_user.username,
            "email": new_user.email
        }

    finally:
        db.close()


# -------------------------
# LOGIN
# -------------------------
@app.post("/auth/login")
def login(user: UserLogin):

    db: Session = SessionLocal()

    try:
        existing_user = (
            db.query(User)
            .filter(User.email == user.email)
            .first()
        )

        if not existing_user:
            raise HTTPException(
                status_code=401,
                detail="Invalid email or password"
            )

        # Verify password
        if not pwd_context.verify(
            user.password,
            existing_user.password
        ):
            raise HTTPException(
                status_code=401,
                detail="Invalid email or password"
            )

        # Create JWT token
        token = create_access_token(existing_user.id)

        return {
            "message": "Login successful",
            "access_token": token,
            "token_type": "bearer",
            "user_id": existing_user.id,
            "username": existing_user.username,
            "email": existing_user.email
        }
    finally:
        db.close()


# -------------------------
# CURRENT USER
# -------------------------
@app.get("/auth/me")
def get_me(current_user: User = Depends(get_current_user)):

    return {
       
    "message": "Authenticated user",
    "user_id": current_user.id,
    "username": current_user.username,
    "email": current_user.email,
    "role": current_user.role

    }
@app.get("/admin")
def admin_dashboard(current_user: User = Depends(require_admin)):
    return {
        "message": "Welcome to the Admin Dashboard",
        "admin": current_user.username,
        "role": current_user.role
    }