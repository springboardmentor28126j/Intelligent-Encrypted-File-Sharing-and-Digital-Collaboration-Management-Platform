from datetime import datetime
from pymongo import MongoClient

from app.core.config import settings

_client = MongoClient(settings.MONGO_URL)
_db = _client.get_database("trustshare")
activity_logs = _db.get_collection("activity_logs")


def log_activity(user_id: str, action: str, resource_id: str | None = None):
    activity_logs.insert_one(
        {
            "user_id": user_id,
            "action": action,
            "resource_id": resource_id,
            "timestamp": datetime.utcnow().isoformat(),
        }
    )


def get_recent_activity(user_id: str, limit: int = 20):
    cursor = (
        activity_logs.find({"user_id": user_id}, {"_id": 0})
        .sort("timestamp", -1)
        .limit(limit)
    )
    return list(cursor)
