from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import SessionLocal
from models import User
from security import get_current_admin

from mongodb import security_alerts


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

        "message":
            "Admin access granted",

        "user_id":
            current_admin.id,

        "name":
            current_admin.name,

        "email":
            current_admin.email,

        "role":
            current_admin.role

    }


# =========================================================
# GET ALL USERS
# =========================================================

@router.get("/users")
def get_all_users(

    current_admin: User = Depends(
        get_current_admin
    ),

    db: Session = Depends(
        get_db
    )

):

    users = db.query(
        User
    ).all()

    return [

        {

            "id":
                user.id,

            "name":
                user.name,

            "email":
                user.email,

            "role":
                user.role

        }

        for user in users

    ]


# =========================================================
# GET SECURITY ALERTS
# =========================================================

@router.get("/security-alerts")
def get_security_alerts(

    current_admin: User = Depends(
        get_current_admin
    )

):

    try:

        alerts = list(

            security_alerts

            .find(
                {
                    "user_id":
                        current_admin.id
                }
            )

            .sort(
                "timestamp",
                -1
            )

            .limit(100)

        )


        result = []


        for alert in alerts:

            timestamp = alert.get(
                "timestamp"
            )


            if timestamp:

                timestamp = timestamp.isoformat()


            result.append(

                {

                    "id":
                        str(
                            alert.get("_id")
                        ),

                    "user_id":
                        alert.get(
                            "user_id"
                        ),

                    "alert_type":
                        alert.get(
                            "alert_type"
                        ),

                    "severity":
                        alert.get(
                            "severity"
                        ),

                    "message":
                        alert.get(
                            "message"
                        ),

                    "filename":
                        alert.get(
                            "filename"
                        ),

                    "ip_address":
                        alert.get(
                            "ip_address"
                        ),

                    "read":
                        alert.get(
                            "read",
                            False
                        ),

                    "timestamp":
                        timestamp

                }

            )


        return {

            "success":
                True,

            "count":
                len(result),

            "alerts":
                result

        }


    except Exception as error:

        print(
            "Security alert retrieval failed:",
            error
        )

        return {

            "success":
                False,

            "count":
                0,

            "alerts":
                []

        }