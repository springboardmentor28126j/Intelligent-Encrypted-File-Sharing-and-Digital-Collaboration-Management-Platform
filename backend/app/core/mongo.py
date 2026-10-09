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


def get_recent_failed_login_counts(since_iso: str) -> dict:
    """Failed-login counts for every user in one query, grouped by user_id.

    Used instead of calling count_recent_failed_logins() in a per-user loop
    (one Mongo round trip per user, which gets slower as the user table
    grows) — this does the same job in a single aggregation query."""
    pipeline = [
        {"$match": {"action": "login_failed", "timestamp": {"$gte": since_iso}}},
        {"$group": {"_id": "$user_id", "count": {"$sum": 1}}},
    ]
    return {row["_id"]: row["count"] for row in activity_logs.aggregate(pipeline)}


def get_action_counts_since(since_iso: str) -> dict:
    """Platform-wide counts of each action type since a given timestamp —
    the basis for the admin security/activity summary report."""
    pipeline = [
        {"$match": {"timestamp": {"$gte": since_iso}}},
        {"$group": {"_id": "$action", "count": {"$sum": 1}}},
    ]
    return {row["_id"]: row["count"] for row in activity_logs.aggregate(pipeline)}