from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import SessionLocal
from models import User
from security import get_current_admin


# =========================================================
# ADMIN ROUTER
# =========================================================

router = APIRouter(
    prefix="/admin",
    tags=["Admin"]
)


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
# ADMIN ACCESS
# =========================================================

@router.get("/")
def admin_access(
    current_admin: User = Depends(
        get_current_admin
    )
):
    return {
        "message": "Admin access granted",
        "user_id": current_admin.id,
        "name": current_admin.name,
        "email": current_admin.email,
        "role": current_admin.role
    }


# =========================================================
# GET ALL USERS
# =========================================================

@router.get("/users")
def get_all_users(
    current_admin: User = Depends(
        get_current_admin
    ),
    db: Session = Depends(get_db)
):

    users = db.query(User).all()

    return [
        {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role
        }
        for user in users
    ]