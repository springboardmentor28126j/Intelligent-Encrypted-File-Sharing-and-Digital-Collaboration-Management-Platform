from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import SessionLocal
from models import User
from security import get_current_user

from mongodb import security_alerts


# =========================================================
# ROUTER
# =========================================================

router = APIRouter(
    prefix="/security",
    tags=["Security Monitoring"]
)


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
# GET MY SECURITY ALERTS
# =========================================================

@router.get("/alerts")
def get_my_security_alerts(

    current_user: User = Depends(
        get_current_user
    )

):

    try:

        alerts = list(

            security_alerts

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

        for alert in alerts:
            timestamp = alert.get(
                "timestamp"
                )

            if isinstance(timestamp, datetime):
                if timestamp.tzinfo is None:
                    timestamp = timestamp.replace(
                        tzinfo=timezone.utc
                        )

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