from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import (
    HTTPBearer,
    HTTPAuthorizationCredentials
)

from database import SessionLocal
from models import User
from mongodb import activity_logs
from security import decode_access_token


# =========================================================
# ROUTER
# =========================================================

router = APIRouter(
    prefix="/activity",
    tags=["Activity Monitoring"]
)


# =========================================================
# SECURITY
# =========================================================

security = HTTPBearer()


# =========================================================
# DATABASE
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
        security
    ),
    db=Depends(get_db)
):

    token = credentials.credentials

    try:

        payload = decode_access_token(
            token
        )

    except Exception:

        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token"
        )

    user_id = payload.get(
        "user_id"
    )

    if not user_id:

        raise HTTPException(
            status_code=401,
            detail="Invalid token"
        )

    user = (
        db.query(User)
        .filter(
            User.id == user_id
        )
        .first()
    )

    if not user:

        raise HTTPException(
            status_code=401,
            detail="User not found"
        )

    return user


# =========================================================
# GET USER ACTIVITY
# =========================================================

@router.get("/")
def get_my_activity(
    current_user: User = Depends(
        get_current_user
    )
):

    try:

        logs = list(
            activity_logs
            .find(
                {
                    "user_id":
                        current_user.id
                }
            )
            .sort(
                "timestamp",
                -1
            )
            .limit(100)
        )

        result = []

        for log in logs:

            timestamp = log.get(
                "timestamp"
            )

            if isinstance(
                timestamp,
                datetime
            ):

                 if timestamp.tzinfo is None:
                     timestamp = timestamp.replace(
                         tzinfo=timezone.utc
                         )
                     timestamp = timestamp.isoformat()

            result.append(
                {
                    "id": str(
                        log.get("_id")
                    ),

                    "user_id": log.get(
                        "user_id"
                    ),

                    "action": log.get(
                        "action"
                    ),

                    "filename": log.get(
                        "filename"
                    ),

                    "status": log.get(
                        "status",
                        "success"
                    ),

                    "details": log.get(
                        "details"
                    ),

                    "target_user": log.get(
                        "target_user"
                    ),

                    "ip_address": log.get(
                        "ip_address"
                    ),

                    "timestamp": timestamp
                }
            )

        return {
            "success": True,
            "count": len(result),
            "activities": result
        }

    except Exception as error:

        print(
            "Activity log retrieval failed:",
            error
        )

        raise HTTPException(
            status_code=500,
            detail="Unable to retrieve activity logs."
        )