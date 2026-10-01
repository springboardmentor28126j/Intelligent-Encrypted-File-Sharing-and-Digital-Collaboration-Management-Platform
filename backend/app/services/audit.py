from datetime import datetime, timedelta, timezone
from typing import Any

from app.core.mongodb import get_activity_collection


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def log_activity(
    action: str,
    user_id: int | None = None,
    *,
    status: str = "success",
    ip: str | None = None,
    user_agent: str | None = None,
    details: dict[str, Any] | None = None,
):
    """Write an audit event to MongoDB.

    Audit persistence is intentionally non-blocking: a monitoring outage must not
    break the primary file/authentication workflow.
    """
    doc = {
        "action": action,
        "user_id": user_id,
        "status": status,
        "ip": ip,
        "user_agent": user_agent,
        "details": details or {},
        "timestamp": _utc_now(),
    }
    try:
        get_activity_collection().insert_one(doc)
    except Exception:
        pass


def recent_activity(user_id: int | None = None, limit: int = 100):
    query = {} if user_id is None else {"user_id": user_id}
    try:
        docs = list(
            get_activity_collection()
            .find(query)
            .sort("timestamp", -1)
            .limit(max(1, min(limit, 500)))
        )
        for d in docs:
            d["_id"] = str(d["_id"])
            if isinstance(d.get("timestamp"), datetime):
                d["timestamp"] = d["timestamp"].isoformat()
        return docs
    except Exception:
        return []


def activity_report(user_id: int, days: int = 30):
    """Return grouped event counts for the requested period."""
    since = _utc_now() - timedelta(days=days)
    try:
        pipeline = [
            {"$match": {"user_id": user_id, "timestamp": {"$gte": since}}},
            {"$group": {
                "_id": {"action": "$action", "status": "$status"},
                "count": {"$sum": 1},
            }},
            {"$sort": {"count": -1}},
        ]
        rows = list(get_activity_collection().aggregate(pipeline))
        return [
            {
                "action": row["_id"].get("action", "UNKNOWN"),
                "status": row["_id"].get("status", "success"),
                "count": int(row["count"]),
            }
            for row in rows
        ]
    except Exception:
        # Fallback keeps the report usable if MongoDB aggregation is unavailable.
        events = recent_activity(user_id, 500)
        cutoff = since.timestamp()
        grouped: dict[tuple[str, str], int] = {}
        for event in events:
            ts = event.get("timestamp")
            try:
                if isinstance(ts, str) and datetime.fromisoformat(ts).timestamp() < cutoff:
                    continue
            except Exception:
                pass
            key = (event.get("action", "UNKNOWN"), event.get("status", "success"))
            grouped[key] = grouped.get(key, 0) + 1
        return [
            {"action": action, "status": status, "count": count}
            for (action, status), count in sorted(grouped.items(), key=lambda x: -x[1])
        ]


def suspicious_activity(user_id: int, limit: int = 500):
    """Threshold-based security heuristics for the current user's activity."""
    events = recent_activity(user_id, limit)
    now = _utc_now()
    windows = {
        "failed_logins": now - timedelta(minutes=10),
        "downloads": now - timedelta(minutes=10),
        "denied": now - timedelta(minutes=10),
    }

    failed_logins = 0
    downloads = 0
    denied = 0
    ips: dict[str, int] = {}

    for event in events:
        try:
            ts = datetime.fromisoformat(event["timestamp"])
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=timezone.utc)
        except Exception:
            continue

        if ts < windows["failed_logins"]:
            continue

        action = event.get("action")
        status = event.get("status")
        if action == "LOGIN" and status == "failed":
            failed_logins += 1
            ip = event.get("ip") or "unknown"
            ips[ip] = ips.get(ip, 0) + 1
        if action in {"DOWNLOAD", "SHARE_LINK_DOWNLOAD"} and status == "success":
            downloads += 1
        if status in {"denied", "failed"} and action not in {"LOGIN"}:
            denied += 1

    alerts = []
    if failed_logins >= 5:
        alerts.append({
            "type": "repeated_failed_login",
            "severity": "high",
            "title": "Repeated failed login attempts",
            "description": f"{failed_logins} failed login attempts were recorded in the last 10 minutes.",
            "count": failed_logins,
            "top_ips": sorted(ips.items(), key=lambda x: -x[1])[:5],
        })
    if downloads >= 20:
        alerts.append({
            "type": "download_spike",
            "severity": "medium",
            "title": "Unusual download activity",
            "description": f"{downloads} downloads were recorded in the last 10 minutes.",
            "count": downloads,
        })
    if denied >= 5:
        alerts.append({
            "type": "repeated_denied_access",
            "severity": "high",
            "title": "Repeated denied access attempts",
            "description": f"{denied} denied/failed non-login actions were recorded in the last 10 minutes.",
            "count": denied,
        })
    return alerts
