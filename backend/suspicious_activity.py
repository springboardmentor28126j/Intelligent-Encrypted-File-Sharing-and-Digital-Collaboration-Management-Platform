from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from models import User
from security import get_current_user
from mongodb import activity_logs, security_alerts

router = APIRouter(
    prefix="/suspicious",
    tags=["Suspicious Activity Detection"]
)


@router.get("/detect")
def detect_suspicious_activity(
    current_user: User = Depends(get_current_user)
):
    now = datetime.now(timezone.utc)
    recent_time = now - timedelta(minutes=10)

    suspicious_events = []

    # 1. Detect multiple failed login attempts
    failed_logins = list(
        activity_logs.find({
            "user_id": current_user.id,
            "action": "login",
            "status": "failed",
            "timestamp": {
                "$gte": recent_time
            }
        })
    )

    if len(failed_logins) >= 3:
        suspicious_events.append({
            "type": "Multiple Failed Logins",
            "severity": "high",
            "message": (
                f"{len(failed_logins)} failed login attempts "
                "detected within the last 10 minutes."
            ),
            "count": len(failed_logins)
        })

    # 2. Detect unauthorized file access
    unauthorized_access = list(
        activity_logs.find({
            "user_id": current_user.id,
            "action": "unauthorized_file_access",
            "timestamp": {
                "$gte": recent_time
            }
        })
    )

    if len(unauthorized_access) >= 2:
        suspicious_events.append({
            "type": "Repeated Unauthorized Access",
            "severity": "high",
            "message": (
                f"{len(unauthorized_access)} unauthorized "
                "file access attempts detected."
            ),
            "count": len(unauthorized_access)
        })

    # 3. Detect permission violations
    permission_violations = list(
        activity_logs.find({
            "user_id": current_user.id,
            "action": "permission_violation",
            "timestamp": {
                "$gte": recent_time
            }
        })
    )

    if len(permission_violations) >= 2:
        suspicious_events.append({
            "type": "Permission Violation",
            "severity": "medium",
            "message": (
                f"{len(permission_violations)} permission "
                "violations detected."
            ),
            "count": len(permission_violations)
        })

    # 4. Detect expired file access
    expired_access = list(
        activity_logs.find({
            "user_id": current_user.id,
            "action": "expired_file_access",
            "timestamp": {
                "$gte": recent_time
            }
        })
    )

    if len(expired_access) >= 2:
        suspicious_events.append({
            "type": "Repeated Expired File Access",
            "severity": "medium",
            "message": (
                f"{len(expired_access)} attempts to access "
                "expired files detected."
            ),
            "count": len(expired_access)
        })

    return {
        "success": True,
        "suspicious": len(suspicious_events) > 0,
        "count": len(suspicious_events),
        "events": suspicious_events
    }