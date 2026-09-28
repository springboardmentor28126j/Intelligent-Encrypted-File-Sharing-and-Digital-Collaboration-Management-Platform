from datetime import datetime, timezone
from pymongo import MongoClient


# =========================================================
# MONGODB CONNECTION
# =========================================================

mongo_client = MongoClient(
    "mongodb://localhost:27017/"
)

mongo_db = mongo_client["trustshare"]

audit_collection = mongo_db["audit_logs"]


# =========================================================
# CREATE AUDIT LOG
# =========================================================

def log_activity(
    action: str,
    user_email: str,
    filename: str | None = None,
    status: str = "success",
    details: str | None = None
):
    log_entry = {
        "action": action,
        "user_email": user_email,
        "filename": filename,
        "status": status,
        "details": details,
        "timestamp": datetime.now(timezone.utc)
    }

    audit_collection.insert_one(log_entry)

    return log_entry


# =========================================================
# GET AUDIT LOGS
# =========================================================

def get_audit_logs():

    logs = audit_collection.find(
        {},
        {"_id": 0}
    ).sort(
        "timestamp",
        -1
    )

    return list(logs)
