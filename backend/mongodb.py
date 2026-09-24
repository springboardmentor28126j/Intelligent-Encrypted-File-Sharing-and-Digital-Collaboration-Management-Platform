from datetime import datetime, timezone

from pymongo import MongoClient


# =========================================================
# MONGODB CONFIGURATION
# =========================================================

MONGO_URL = "mongodb://127.0.0.1:27017"

DATABASE_NAME = "intelligent_file_sharing"


# =========================================================
# MONGODB CLIENT
# =========================================================

client = MongoClient(
    MONGO_URL,
    serverSelectionTimeoutMS=5000
)


# =========================================================
# DATABASE
# =========================================================

mongo_db = client[DATABASE_NAME]


# =========================================================
# ACTIVITY LOG COLLECTION
# =========================================================

activity_logs = mongo_db["activity_logs"]


# =========================================================
# SECURITY ALERT COLLECTION
# =========================================================

security_alerts = mongo_db["security_alerts"]


# =========================================================
# TEST CONNECTION
# =========================================================

def test_mongodb():

    try:

        client.admin.command("ping")

        print(
            "MongoDB connection successful."
        )

        return True

    except Exception as error:

        print(
            "MongoDB connection failed:",
            error
        )

        return False


# =========================================================
# CREATE ACTIVITY / AUDIT LOG
# =========================================================

def create_activity_log(
    user_id: int,
    action: str,
    filename: str | None = None,
    status: str = "success",
    details: str | None = None,
    target_user: str | None = None,
    ip_address: str | None = None
):

    log = {

        "user_id": user_id,

        "action": action,

        "filename": filename,

        "status": status,

        "details": details,

        "target_user": target_user,

        "ip_address": ip_address,

        "timestamp":
            datetime.now(timezone.utc)
    }

    activity_logs.insert_one(log)


# =========================================================
# CREATE SECURITY ALERT
# =========================================================

def create_security_alert(
    user_id: int,
    alert_type: str,
    severity: str,
    message: str,
    filename: str | None = None,
    ip_address: str | None = None
):

    alert = {

        "user_id": user_id,

        "alert_type": alert_type,

        "severity": severity,

        "message": message,

        "filename": filename,

        "ip_address": ip_address,

        "read": False,

        "timestamp":
            datetime.now(timezone.utc)
    }

    security_alerts.insert_one(alert)