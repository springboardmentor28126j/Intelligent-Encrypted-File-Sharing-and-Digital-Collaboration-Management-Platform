from fastapi import APIRouter, Depends
from models import User
from security import get_current_user
from mongodb import activity_logs, security_alerts

router = APIRouter(
    prefix="/reports",
    tags=["Reports"]
)


@router.get("/activity")
def get_activity_report(
    current_user: User = Depends(get_current_user)
):
    logs = list(
        activity_logs
        .find({"user_id": current_user.id})
        .sort("timestamp", -1)
        .limit(500)
    )

    result = []

    for log in logs:
        timestamp = log.get("timestamp")

        if timestamp:
            timestamp = timestamp.isoformat()

        result.append({
            "id": str(log.get("_id")),
            "action": log.get("action"),
            "filename": log.get("filename"),
            "status": log.get("status"),
            "details": log.get("details"),
            "target_user": log.get("target_user"),
            "ip_address": log.get("ip_address"),
            "timestamp": timestamp
        })

    return {
        "success": True,
        "count": len(result),
        "activities": result
    }


@router.get("/security")
def get_security_report(
    current_user: User = Depends(get_current_user)
):
    alerts = list(
        security_alerts
        .find({"user_id": current_user.id})
        .sort("timestamp", -1)
        .limit(500)
    )

    result = []

    for alert in alerts:
        timestamp = alert.get("timestamp")

        if timestamp:
            timestamp = timestamp.isoformat()

        result.append({
            "id": str(alert.get("_id")),
            "alert_type": alert.get("alert_type"),
            "severity": alert.get("severity"),
            "message": alert.get("message"),
            "filename": alert.get("filename"),
            "ip_address": alert.get("ip_address"),
            "read": alert.get("read", False),
            "timestamp": timestamp
        })

    return {
        "success": True,
        "count": len(result),
        "alerts": result
    }