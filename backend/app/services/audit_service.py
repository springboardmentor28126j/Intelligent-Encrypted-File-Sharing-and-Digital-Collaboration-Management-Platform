"""
audit_service.py – Audit logging and event monitoring service for TrustShare.

Provides comprehensive logging of:
  - User Authentication (Login, Logout, Failed Login)
  - File Lifecycle (Upload, Download, Delete, View)
  - Sharing Operations (Share Created, Direct User Share, Share Revoked)
  - Security Events (Unauthorized Access, Rate Limit Exceeded, Suspicious IP)
Persists records to both PostgreSQL (relational audit table) and MongoDB (document store).
"""

from datetime import datetime, timezone
import logging
from typing import Any, Dict, List, Optional
from fastapi import Request
from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from app.models import AuditLog, File, User
from app.mongodb import get_mongo_db, is_mongo_available

logger = logging.getLogger("trustshare.audit")


def get_client_ip(request: Optional[Request] = None) -> str:
    """Extract client real IP address, honoring proxy headers."""
    if not request:
        return "127.0.0.1"
    
    # 1. Forwarded headers from Reverse Proxy / CDN / Cloudflare
    x_forwarded_for = request.headers.get("X-Forwarded-For")
    if x_forwarded_for:
        return x_forwarded_for.split(",")[0].strip()
    
    x_real_ip = request.headers.get("X-Real-IP")
    if x_real_ip:
        return x_real_ip.strip()
    
    # 2. Standard client host
    if request.client and request.client.host:
        return request.client.host
    
    return "127.0.0.1"


def get_user_agent(request: Optional[Request] = None) -> str:
    """Extract client User-Agent header."""
    if not request:
        return "Unknown"
    return request.headers.get("User-Agent", "Unknown")[:250]


def log_audit_event(
    db: Session,
    action: str,
    user_id: Optional[int] = None,
    file_id: Optional[int] = None,
    ip_address: Optional[str] = None,
    details: Optional[str] = None,
    status: str = "success",
    user_agent: Optional[str] = None,
    request: Optional[Request] = None,
) -> AuditLog:
    """
    Record an immutable audit log entry into PostgreSQL and MongoDB.
    """
    resolved_ip = ip_address or get_client_ip(request)
    resolved_ua = user_agent or get_user_agent(request)
    now = datetime.now(timezone.utc)

    # 1. Save to PostgreSQL
    log_entry = AuditLog(
        user_id=user_id,
        action=action,
        file_id=file_id,
        ip_address=resolved_ip,
        timestamp=now,
        details=details,
        status=status,
        user_agent=resolved_ua,
    )
    try:
        db.add(log_entry)
        db.commit()
        db.refresh(log_entry)
    except Exception as exc:
        db.rollback()
        logger.error(f"Failed to write audit log to PostgreSQL: {exc}")

    # 2. Sync to MongoDB if available
    try:
        if is_mongo_available():
            mongo_db = get_mongo_db()
            mongo_doc = {
                "sql_id": log_entry.id,
                "user_id": user_id,
                "action": action,
                "file_id": file_id,
                "ip_address": resolved_ip,
                "timestamp": now.isoformat(),
                "details": details,
                "status": status,
                "user_agent": resolved_ua,
            }
            mongo_db["audit_logs"].insert_one(mongo_doc)
    except Exception as exc:
        logger.warning(f"Failed to mirror audit log to MongoDB: {exc}")

    return log_entry


def get_audit_logs(
    db: Session,
    user_id: Optional[int] = None,
    action: Optional[str] = None,
    file_id: Optional[int] = None,
    status_filter: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> List[Dict[str, Any]]:
    """Retrieve audit logs with relational joins for user emails and file names."""
    query = (
        db.query(
            AuditLog,
            User.email.label("user_email"),
            File.filename.label("filename"),
        )
        .outerjoin(User, AuditLog.user_id == User.id)
        .outerjoin(File, AuditLog.file_id == File.id)
    )

    if user_id is not None:
        query = query.filter(AuditLog.user_id == user_id)
    if action:
        query = query.filter(AuditLog.action.ilike(f"%{action}%"))
    if file_id is not None:
        query = query.filter(AuditLog.file_id == file_id)
    if status_filter:
        query = query.filter(AuditLog.status == status_filter)

    results = (
        query.order_by(desc(AuditLog.timestamp))
        .offset(offset)
        .limit(limit)
        .all()
    )

    formatted = []
    for log, user_email, filename in results:
        formatted.append({
            "id": log.id,
            "user_id": log.user_id,
            "user_email": user_email,
            "action": log.action,
            "file_id": log.file_id,
            "filename": filename,
            "ip_address": log.ip_address,
            "timestamp": log.timestamp,
            "details": log.details,
            "status": log.status,
            "user_agent": log.user_agent,
        })
    return formatted


def get_audit_stats(db: Session, user_id: Optional[int] = None) -> Dict[str, Any]:
    """Aggregate statistics for monitoring dashboards."""
    base_query = db.query(AuditLog)
    if user_id is not None:
        base_query = base_query.filter(AuditLog.user_id == user_id)

    total_events = base_query.count()
    login_events = base_query.filter(AuditLog.action == "login").count()
    failed_logins = base_query.filter(AuditLog.action == "failed_login").count()
    file_ops = base_query.filter(
        AuditLog.action.in_(["upload", "download", "delete", "share", "direct_share"])
    ).count()
    security_alerts = base_query.filter(
        AuditLog.action.in_(["unauthorized_access", "suspicious_activity", "multiple_failed_logins", "excessive_downloads"])
    ).count()

    # Breakdown by action
    actions = (
        db.query(AuditLog.action, func.count(AuditLog.id))
        .group_by(AuditLog.action)
        .all()
    )
    actions_breakdown = {act: count for act, count in actions}

    unique_users = db.query(func.count(func.distinct(AuditLog.user_id))).scalar() or 0

    return {
        "total_events": total_events,
        "login_events": login_events,
        "failed_logins": failed_logins,
        "file_operations": file_ops,
        "security_alerts": security_alerts,
        "unique_users": unique_users,
        "actions_breakdown": actions_breakdown,
    }


def get_file_history(db: Session, file_id: int) -> List[Dict[str, Any]]:
    """Get the full chronological audit history of a specific file."""
    return get_audit_logs(db, file_id=file_id, limit=100)
