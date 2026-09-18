from datetime import datetime, timezone
from pymongo import MongoClient

from app.core.config import settings

_client = MongoClient(settings.MONGO_URL)
_db = _client.get_database("trustshare")
activity_logs = _db.get_collection("activity_logs")


def log_activity(user_id: str, action: str, resource_id: str | None = None, category: str = "info"):
    activity_logs.insert_one(
        {
            "user_id": user_id,
            "action": action,
            "resource_id": resource_id,
            # "info" = normal usage (upload, download, share...).
            # "security" = auth/access events worth surfacing on a security
            # dashboard (failed logins, unauthorized access attempts).
            "category": category,
            # timezone-aware ISO string (ends in +00:00) so the browser
            # correctly converts it to the viewer's local time instead of
            # treating it as if it were already local
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    )


def get_recent_activity(user_id: str, limit: int = 20):
    cursor = (
        activity_logs.find({"user_id": user_id}, {"_id": 0})
        .sort("timestamp", -1)
        .limit(limit)
    )
    return list(cursor)


def get_all_activity(limit: int = 50, skip: int = 0, category: str | None = None):
    """Admin-wide view across every user — not scoped to one account."""
    query = {"category": category} if category else {}
    cursor = (
        activity_logs.find(query, {"_id": 0})
        .sort("timestamp", -1)
        .skip(skip)
        .limit(limit)
    )
    return list(cursor)


def count_recent_failed_logins(user_id: str, since_iso: str) -> int:
    return activity_logs.count_documents(
        {
            "user_id": user_id,
            "action": "login_failed",
            "timestamp": {"$gte": since_iso},
        }
    )
