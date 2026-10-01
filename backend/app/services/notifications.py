import json
from datetime import datetime, timezone
from typing import Any, Dict, List

from sqlalchemy.orm import Session

from app.core.redis import get_redis_client

KEY_PREFIX = "trustshare:notifications:"
READ_PREFIX = "trustshare:notification-read:"
    
def _parse_item(val: bytes | str | Dict[str, Any]) -> Dict[str, Any]:
    if isinstance(val, (bytes, str)):
        return json.loads(val)
    return val

def notify_security_alert(
    db: Session,
    user_id: int,
    title: str,
    message: str,
) -> Dict[str, Any]:
    """Pushes a security alert notification to the user."""
    return push_notification(
        user_id=user_id,
        message=message,
        kind="WARNING",
        title=title,
    )

def push_notification(user_id: int, message: str, kind: str = "INFO", title: str | None = None) -> Dict[str, Any]:
    payload = {
        "id": f"{user_id}-{datetime.now(timezone.utc).timestamp()}",
        "title": title or kind.title(),
        "message": message,
        "kind": kind,
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    try:
        r = get_redis_client()
        key = f"{KEY_PREFIX}{user_id}"
        r.lpush(key, json.dumps(payload))
        r.ltrim(key, 0, 49)
        r.expire(key, 60 * 60 * 24 * 30)
    except Exception:
        pass
    return payload


def get_notifications(user_id: int, limit: int = 50, unread_only: bool = False) -> List[Dict[str, Any]]:
    try:
        values = get_redis_client().lrange(
            f"{KEY_PREFIX}{user_id}", 0, max(0, min(limit, 100) - 1)
        )
        items = [_parse_item(v) for v in values]
        if unread_only:
            items = [x for x in items if not x.get("is_read", False)]
        return items
    except Exception:
        return []


def mark_notification_read(user_id: int, notification_id: str) -> bool:
    try:
        r = get_redis_client()
        key = f"{KEY_PREFIX}{user_id}"
        values = r.lrange(key, 0, 49)
        changed = False
        updated: List[str] = []
        
        for value in values:
            item = _parse_item(value)
            if item.get("id") == notification_id:
                item["is_read"] = True
                changed = True
            updated.append(json.dumps(item))
            
        if changed:
            pipe = r.pipeline()
            pipe.delete(key)
            if updated:
                pipe.rpush(key, *reversed(updated))
                pipe.expire(key, 60 * 60 * 24 * 30)
            pipe.execute()
        return changed
    except Exception:
        return False