from typing import Dict, Any, List
from datetime import datetime, timezone
import uuid

class NotificationService:
    # In-memory alert event dispatcher for WebSocket / push notifications
    _listeners: List[Any] = []

    @staticmethod
    async def send_notification(user_id: str, title: str, message: str, notification_type: str = "INFO"):
        notification = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "title": title,
            "message": message,
            "type": notification_type,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "read": False
        }
        # Dispatched to active connected clients or email queue
        return notification
