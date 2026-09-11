from datetime import datetime, timezone
from src.models.nosql.database import get_mongo_db
from src.models.nosql.audit import SecurityAlertEntry
from src.core.redis import get_redis

class SecurityAnomalyDetector:
    @staticmethod
    async def record_failed_attempt(ip: str, share_token: str) -> bool:
        """
        Detects brute force passphrase attempts using sliding window counters in Redis.
        Returns True if alert was triggered.
        """
        try:
            redis = await get_redis()
            key = f"rate:fail:{ip}:{share_token}"
            count = await redis.incr(key)
            if count == 1:
                await redis.expire(key, 300)  # 5 minute window
            
            if count >= 5:
                # Trigger Security Alert
                alert = SecurityAlertEntry(
                    severity="HIGH",
                    type="BRUTE_FORCE_PASSPHRASE",
                    source_ip=ip,
                    description=f"Multiple failed passphrase attempts ({count}) on share token {share_token[:8]}..."
                )
                db = get_mongo_db()
                await db.security_alerts.insert_one(alert.model_dump())
                return True
        except Exception:
            pass
        return False
