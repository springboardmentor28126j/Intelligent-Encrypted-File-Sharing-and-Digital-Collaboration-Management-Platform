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
                "user_id": str(log.user_id)
                if log.user_id else None,
                "user_email": log.user_email,
                "action": log.action,
                "method": log.method,
                "path": log.path,
                "status_code": log.status_code,
                "ip_address": log.ip_address,
                "response_time_ms": log.response_time_ms,
                "timestamp": log.created_at,
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

    failed_auth = [
        log
        for log in logs
        if log.path.startswith("/auth/")
        and log.status_code in (401, 403)
    ]

    if len(failed_auth) >= 3:
        alerts.append({
            "type": "authentication_failure",
            "severity": "high",
            "message": (
                f"{len(failed_auth)} failed authentication "
                "attempts detected in the last 24 hours."
            ),
            "count": len(failed_auth),
        })

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

    server_errors = [
        log
        for log in logs
        if log.status_code >= 500
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
    Generates user-facing security notifications from
    recent monitoring events.
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

    failed_requests = [
        log
        for log in logs
        if log.status_code >= 400
    ]

    if failed_requests:
        notifications.append({
            "type": "security",
            "severity": "warning",
            "title": "Failed requests detected",
            "message": (
                f"{len(failed_requests)} failed API request(s) "
                "were detected in the last 24 hours."
            ),
            "count": len(failed_requests),
            "created_at": datetime.utcnow(),
            "read": False,
        })

    failed_auth = [
        log
        for log in logs
        if log.path.startswith("/auth/")
        and log.status_code in (401, 403)
    ]

    if failed_auth:
        notifications.append({
            "type": "authentication",
            "severity": "high",
            "title": "Authentication warning",
            "message": (
                f"{len(failed_auth)} failed authentication "
                "attempt(s) were detected."
            ),
            "count": len(failed_auth),
            "created_at": datetime.utcnow(),
            "read": False,
        })

    downloads = [
        log
        for log in logs
        if "/download" in log.path
        and log.status_code == 200
    ]

    if len(downloads) >= 20:
        notifications.append({
            "type": "file_activity",
            "severity": "warning",
            "title": "High download activity",
            "message": (
                "Unusually high file download activity "
                "was detected."
            ),
            "count": len(downloads),
            "created_at": datetime.utcnow(),
            "read": False,
        })

    if not notifications:
        notifications.append({
            "type": "system",
            "severity": "info",
            "title": "No security alerts",
            "message": (
                "No security events require attention "
                "in the last 24 hours."
            ),
            "count": 0,
            "created_at": datetime.utcnow(),
            "read": False,
        })

    return {
        "user": current_user.email,
        "period": "last_24_hours",
        "notification_count": len(notifications),
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

    failed_requests = [
        log
        for log in logs
        if log.status_code >= 400
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

    downloads = [
        log
        for log in logs
        if "/download" in log.path
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