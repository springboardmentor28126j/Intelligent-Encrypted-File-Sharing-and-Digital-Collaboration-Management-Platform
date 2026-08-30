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
# TEST CONNECTION
# =========================================================

def test_mongodb():

    try:

        client.admin.command("ping")

        print("MongoDB connection successful.")

        return True

    except Exception as error:

        print(
            "MongoDB connection failed:",
            error
        )

        return False


# =========================================================
# CREATE ACTIVITY LOG
# =========================================================

def create_activity_log(
    user_id: int,
    action: str,
    filename: str | None = None
):

    log = {
        "user_id": user_id,
        "action": action,
        "filename": filename,
        "timestamp": datetime.now(timezone.utc)
    }

    activity_logs.insert_one(log)