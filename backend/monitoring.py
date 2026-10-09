from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import ActivityLog, File


router = APIRouter(
    prefix="/monitoring",
    tags=["Monitoring & Analytics"]
)


# ============================================================
# HELPER FUNCTIONS
# ============================================================

def describe_activity(log):
    """
    Converts an API activity log into a user-friendly
    description for the monitoring dashboard.
    """

    action = str(log.action or "").lower()
    path = str(log.path or "").lower()
    method = str(log.method or "").upper()
    status_code = log.status_code or 0

    if "upload" in path:
        if status_code < 400:
            return "User uploaded a file successfully."
        return "File upload request failed."

    if "download" in path:
        if status_code < 400:
            return "User downloaded or accessed a file successfully."
        return "File download request failed."

    if "share" in path:
        if status_code < 400:
            return "File sharing request completed successfully."
        return "File sharing request failed."

    if "temporary" in path or "link" in path:
        if status_code < 400:
            return "Temporary access link was created or accessed."
        return "Temporary access request failed."

    if "login" in path or "auth" in path:
        if status_code in (401, 403):
            return "Authentication attempt was unsuccessful."

        if status_code < 400:
            return "User authenticated successfully."

    if method == "DELETE" or "delete" in action:
        if status_code < 400:
            return "File or resource was deleted successfully."
        return "Delete request failed."

    if status_code >= 500:
        return "Server error occurred while processing the request."

    if status_code >= 400:
        return "API request was rejected or could not be completed."

    if method == "GET":
        return "User accessed TrustShare data successfully."

    if method == "POST":
        return "User submitted a request successfully."

    if method == "PUT" or method == "PATCH":
        return "User updated TrustShare data successfully."

    return "TrustShare activity was recorded successfully."


def notification_icon(notification_type):
    """
    Returns an icon identifier for the frontend.
    """

    icons = {
        "security": "🛡️",
        "authentication": "🔐",
        "file_activity": "📁",
        "system": "🔔",
        "file_access": "👁️",
        "sharing": "🤝",
    }

    return icons.get(notification_type, "🔔")


def audit_status(status_code):
    """
    Converts HTTP status codes into a simple audit status.
    """

    try:
        code = int(status_code or 0)
    except (TypeError, ValueError):
        code = 0

    if 200 <= code < 400:
        return "Success"

    if code >= 400:
        return "Failed"

    return "Recorded"


# ============================================================
# ACTIVITY MONITORING
# ============================================================

@router.get("/activity")
def get_activity_logs(
    limit: int = 100,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    limit = min(max(limit, 1), 500)

    logs = (
        db.query(ActivityLog)
        .filter(ActivityLog.user_id == current_user.id)
        .order_by(ActivityLog.created_at.desc())
        .limit(limit)
        .all()
    )

    return {
        "count": len(logs),
        "activities": [
            {
                "id": str(log.id),
                "action": log.action,
                "method": log.method,
                "path": log.path,
                "status_code": log.status_code,
                "ip_address": log.ip_address,
                "response_time_ms": log.response_time_ms,
                "created_at": log.created_at,
                "description": describe_activity(log),
            }
            for log in logs
        ],
    }


# ============================================================
# AUDIT LOGGING
# ============================================================

@router.get("/audit")
def get_audit_logs(
    limit: int = 100,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    limit = min(max(limit, 1), 500)

    logs = (
        db.query(ActivityLog)
        .filter(ActivityLog.user_id == current_user.id)
        .order_by(ActivityLog.created_at.desc())
        .limit(limit)
        .all()
    )

    return {
        "count": len(logs),
        "audit_logs": [
            {
                "id": str(log.id),
                "user_id": (
                    str(log.user_id)
                    if log.user_id
                    else None
                ),
                "user_email": log.user_email,
                "action": log.action,
                "method": log.method,
                "path": log.path,
                "status_code": log.status_code,
                "status": audit_status(log.status_code),
                "ip_address": log.ip_address,
                "response_time_ms": log.response_time_ms,
                "timestamp": log.created_at,
                "created_at": log.created_at,
                "description": describe_activity(log),
            }
            for log in logs
        ],
    }


# ============================================================
# SECURITY ALERTS
# ============================================================

@router.get("/alerts")
def get_security_alerts(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    since = datetime.utcnow() - timedelta(hours=24)

    logs = (
        db.query(ActivityLog)
        .filter(
            ActivityLog.user_id == current_user.id,
            ActivityLog.created_at >= since,
        )
        .order_by(ActivityLog.created_at.desc())
        .all()
    )

    alerts = []

    # --------------------------------------------------------
    # FAILED AUTHENTICATION
    # --------------------------------------------------------

    failed_auth = [
        log
        for log in logs
        if str(log.path or "").startswith("/auth/")
        and log.status_code in (401, 403)
    ]

    if len(failed_auth) >= 1:
        alerts.append({
            "type": "authentication_failure",
            "severity": "high",
            "message": (
                f"{len(failed_auth)} failed authentication "
                "attempt(s) detected in the last 24 hours."
            ),
            "count": len(failed_auth),
        })

    # --------------------------------------------------------
    # FORBIDDEN REQUESTS
    # --------------------------------------------------------

    forbidden_requests = [
        log
        for log in logs
        if log.status_code == 403
    ]

    if len(forbidden_requests) >= 3:
        alerts.append({
            "type": "access_denied",
            "severity": "medium",
            "message": (
                f"{len(forbidden_requests)} forbidden requests "
                "detected in the last 24 hours."
            ),
            "count": len(forbidden_requests),
        })

    # --------------------------------------------------------
    # SERVER ERRORS
    # --------------------------------------------------------

    server_errors = [
        log
        for log in logs
        if (log.status_code or 0) >= 500
    ]

    if len(server_errors) >= 5:
        alerts.append({
            "type": "server_error_spike",
            "severity": "medium",
            "message": (
                f"{len(server_errors)} server errors detected "
                "in the last 24 hours."
            ),
            "count": len(server_errors),
        })

    # --------------------------------------------------------
    # HIGH API ACTIVITY
    # --------------------------------------------------------

    if len(logs) >= 200:
        alerts.append({
            "type": "high_activity",
            "severity": "medium",
            "message": (
                "Unusually high API activity detected "
                "for this account."
            ),
            "count": len(logs),
        })

    return {
        "period": "last_24_hours",
        "alert_count": len(alerts),
        "alerts": alerts,
    }


# ============================================================
# NOTIFICATIONS
# ============================================================

@router.get("/notifications")
def get_notifications(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Generates user-facing security and system notifications
    from recent monitoring events.
    """

    since = datetime.utcnow() - timedelta(hours=24)

    logs = (
        db.query(ActivityLog)
        .filter(
            ActivityLog.user_id == current_user.id,
            ActivityLog.created_at >= since,
        )
        .order_by(ActivityLog.created_at.desc())
        .all()
    )

    notifications = []

    # --------------------------------------------------------
    # FAILED REQUEST NOTIFICATION
    # --------------------------------------------------------

    failed_requests = [
        log
        for log in logs
        if (log.status_code or 0) >= 400
    ]

    if failed_requests:
        notifications.append({
            "id": "failed-requests",
            "type": "security",
            "severity": "medium",
            "title": "Failed requests detected",
            "message": (
                f"{len(failed_requests)} failed API request(s) "
                "were detected in the last 24 hours. "
                "Review the audit logs for more details."
            ),
            "description": (
                "TrustShare detected API requests that were "
                "not completed successfully."
            ),
            "count": len(failed_requests),
            "created_at": datetime.utcnow(),
            "read": False,
            "is_read": False,
            "status": "unread",
            "icon": notification_icon("security"),
        })

    # --------------------------------------------------------
    # AUTHENTICATION WARNING
    # --------------------------------------------------------

    failed_auth = [
        log
        for log in logs
        if str(log.path or "").startswith("/auth/")
        and log.status_code in (401, 403)
    ]

    if failed_auth:
        notifications.append({
            "id": "authentication-warning",
            "type": "authentication",
            "severity": "high",
            "title": "Authentication warning",
            "message": (
                f"{len(failed_auth)} failed authentication "
                "attempt(s) were detected."
            ),
            "description": (
                "An unsuccessful authentication attempt "
                "was recorded by TrustShare."
            ),
            "count": len(failed_auth),
            "created_at": datetime.utcnow(),
            "read": False,
            "is_read": False,
            "status": "unread",
            "icon": notification_icon("authentication"),
        })

    # --------------------------------------------------------
    # HIGH DOWNLOAD ACTIVITY
    # --------------------------------------------------------

    downloads = [
        log
        for log in logs
        if "/download" in str(log.path or "").lower()
        and log.status_code == 200
    ]

    if len(downloads) >= 20:
        notifications.append({
            "id": "high-download-activity",
            "type": "file_activity",
            "severity": "medium",
            "title": "High download activity",
            "message": (
                f"{len(downloads)} successful file downloads "
                "were recorded in the last 24 hours."
            ),
            "description": (
                "TrustShare detected unusually high file "
                "download activity."
            ),
            "count": len(downloads),
            "created_at": datetime.utcnow(),
            "read": False,
            "is_read": False,
            "status": "unread",
            "icon": notification_icon("file_activity"),
        })

    # --------------------------------------------------------
    # FILE SHARING ACTIVITY
    # --------------------------------------------------------

    share_events = [
        log
        for log in logs
        if "share" in str(log.path or "").lower()
        and log.status_code
        and log.status_code < 400
    ]

    if share_events:
        notifications.append({
            "id": "sharing-activity",
            "type": "sharing",
            "severity": "info",
            "title": "File sharing activity",
            "message": (
                f"{len(share_events)} file sharing operation(s) "
                "were completed successfully."
            ),
            "description": (
                "TrustShare recorded successful file sharing "
                "activity for this account."
            ),
            "count": len(share_events),
            "created_at": datetime.utcnow(),
            "read": True,
            "is_read": True,
            "status": "read",
            "icon": notification_icon("sharing"),
        })

    # --------------------------------------------------------
    # NO SECURITY EVENTS
    # --------------------------------------------------------

    if not notifications:
        notifications.append({
            "id": "system-status",
            "type": "system",
            "severity": "info",
            "title": "Security status clear",
            "message": (
                "No security events require attention "
                "in the last 24 hours."
            ),
            "description": (
                "TrustShare monitoring is active and no "
                "security issue requires your attention."
            ),
            "count": 0,
            "created_at": datetime.utcnow(),
            "read": True,
            "is_read": True,
            "status": "read",
            "icon": notification_icon("system"),
        })

    return {
        "user": current_user.email,
        "period": "last_24_hours",
        "notification_count": len(notifications),
        "unread_count": sum(
            1
            for notification in notifications
            if notification.get("read") is False
        ),
        "notifications": notifications,
    }


# ============================================================
# FILE ACTIVITY REPORT
# ============================================================

@router.get("/reports/files")
def file_activity_report(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    upload_count = (
        db.query(ActivityLog)
        .filter(
            ActivityLog.user_id == current_user.id,
            ActivityLog.path.contains("/files/upload"),
        )
        .count()
    )

    download_count = (
        db.query(ActivityLog)
        .filter(
            ActivityLog.user_id == current_user.id,
            ActivityLog.path.contains("/download"),
            ActivityLog.status_code == 200,
        )
        .count()
    )

    delete_count = (
        db.query(ActivityLog)
        .filter(
            ActivityLog.user_id == current_user.id,
            ActivityLog.method == "DELETE",
            ActivityLog.path.startswith("/files/"),
        )
        .count()
    )

    total_files = (
        db.query(File)
        .filter(File.owner_id == current_user.id)
        .count()
    )

    return {
        "report": "file_activity",
        "user": current_user.email,
        "total_owned_files": total_files,
        "uploads": upload_count,
        "downloads": download_count,
        "deletions": delete_count,
        "generated_at": datetime.utcnow(),
    }


# ============================================================
# STORAGE ANALYTICS
# ============================================================

@router.get("/analytics/storage")
def storage_analytics(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    result = (
        db.query(
            func.count(File.id),
            func.coalesce(func.sum(File.size_bytes), 0),
        )
        .filter(File.owner_id == current_user.id)
        .first()
    )

    file_count = result[0] or 0
    total_bytes = result[1] or 0

    total_mb = round(
        total_bytes / (1024 * 1024),
        2
    )

    total_gb = round(
        total_bytes / (1024 * 1024 * 1024),
        4
    )

    return {
        "user": current_user.email,
        "file_count": file_count,
        "total_bytes": total_bytes,
        "total_mb": total_mb,
        "total_gb": total_gb,
        "generated_at": datetime.utcnow(),
    }


# ============================================================
# MONITORING DASHBOARD
# ============================================================

@router.get("/dashboard")
def monitoring_dashboard(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    since = datetime.utcnow() - timedelta(hours=24)

    activity_count = (
        db.query(ActivityLog)
        .filter(
            ActivityLog.user_id == current_user.id,
            ActivityLog.created_at >= since,
        )
        .count()
    )

    successful_requests = (
        db.query(ActivityLog)
        .filter(
            ActivityLog.user_id == current_user.id,
            ActivityLog.created_at >= since,
            ActivityLog.status_code < 400,
        )
        .count()
    )

    failed_requests = (
        db.query(ActivityLog)
        .filter(
            ActivityLog.user_id == current_user.id,
            ActivityLog.created_at >= since,
            ActivityLog.status_code >= 400,
        )
        .count()
    )

    storage = (
        db.query(
            func.count(File.id),
            func.coalesce(func.sum(File.size_bytes), 0),
        )
        .filter(File.owner_id == current_user.id)
        .first()
    )

    file_count = storage[0] or 0
    total_bytes = storage[1] or 0

    return {
        "dashboard": "TrustShare Monitoring Dashboard",
        "user": current_user.email,
        "period": "last_24_hours",
        "activity": {
            "total_requests": activity_count,
            "successful_requests": successful_requests,
            "failed_requests": failed_requests,
        },
        "storage": {
            "file_count": file_count,
            "total_bytes": total_bytes,
            "total_mb": round(
                total_bytes / (1024 * 1024),
                2
            ),
        },
        "generated_at": datetime.utcnow(),
    }


# ============================================================
# SUSPICIOUS ACTIVITY DETECTION
# ============================================================

@router.get("/suspicious")
def suspicious_activity(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    since = datetime.utcnow() - timedelta(hours=24)

    logs = (
        db.query(ActivityLog)
        .filter(
            ActivityLog.user_id == current_user.id,
            ActivityLog.created_at >= since,
        )
        .order_by(ActivityLog.created_at.desc())
        .all()
    )

    suspicious_events = []

    # --------------------------------------------------------
    # MULTIPLE IP ADDRESSES
    # --------------------------------------------------------

    ip_addresses = {
        log.ip_address
        for log in logs
        if log.ip_address
    }

    if len(ip_addresses) >= 3:
        suspicious_events.append({
            "type": "multiple_ip_addresses",
            "severity": "medium",
            "message": (
                "Activity detected from multiple IP addresses."
            ),
            "ip_count": len(ip_addresses),
        })

    # --------------------------------------------------------
    # REPEATED FAILURES
    # --------------------------------------------------------

    failed_requests = [
        log
        for log in logs
        if (log.status_code or 0) >= 400
    ]

    if len(failed_requests) >= 10:
        suspicious_events.append({
            "type": "repeated_failures",
            "severity": "high",
            "message": (
                "Repeated failed API requests detected."
            ),
            "count": len(failed_requests),
        })

    # --------------------------------------------------------
    # HIGH DOWNLOAD VOLUME
    # --------------------------------------------------------

    downloads = [
        log
        for log in logs
        if "/download" in str(log.path or "").lower()
        and log.status_code == 200
    ]

    if len(downloads) >= 20:
        suspicious_events.append({
            "type": "high_download_volume",
            "severity": "medium",
            "message": (
                "Unusually high file download activity detected."
            ),
            "download_count": len(downloads),
        })

    return {
        "period": "last_24_hours",
        "suspicious_event_count": len(suspicious_events),
        "events": suspicious_events,
    }