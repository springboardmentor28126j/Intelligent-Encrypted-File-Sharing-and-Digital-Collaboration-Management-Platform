"""
routers/analytics.py – Analytics & Metrics API endpoints for TrustShare dashboard.

Routes:
  GET /analytics/dashboard           – Unified dashboard payload: cards, trends, breakdown, recent activity
  GET /analytics/trends              – Time-series upload, download, and share statistics (7d/30d)
  GET /analytics/storage-breakdown   – Storage consumption per file category
"""

from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import AuditLog, File, FileShare, User, UserRole
from app.schemas import (
    AnalyticsDashboardOut,
    RecentActivityItem,
    StorageCategoryItem,
    TrendPoint,
)

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get(
    "/dashboard",
    response_model=AnalyticsDashboardOut,
    summary="Get unified analytics dashboard metrics and charts data",
)
def get_dashboard_analytics(
    days: int = Query(7, ge=1, le=90, description="Window in days for trends"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    is_admin = current_user.role == UserRole.admin.value
    user_id = current_user.id

    # 1. Total Files & Storage
    files_query = db.query(File).filter(File.is_deleted == False)
    if not is_admin:
        files_query = files_query.filter(File.owner_id == user_id)

    total_files = files_query.count()
    total_storage_bytes = (
        files_query.with_entities(func.coalesce(func.sum(File.size), 0)).scalar() or 0
    )
    total_storage_mb = round(total_storage_bytes / (1024 * 1024), 2)
    total_downloads = (
        files_query.with_entities(func.coalesce(func.sum(File.download_count), 0)).scalar() or 0
    )

    # 2. Total Shares & Active Links
    shares_query = db.query(FileShare).filter(FileShare.is_revoked == False)
    if not is_admin:
        shares_query = shares_query.filter(FileShare.owner_id == user_id)
    total_shares = shares_query.count()

    now = datetime.now(timezone.utc)
    active_links = shares_query.filter(
        (FileShare.expires_at == None) | (FileShare.expires_at > now)
    ).count()

    # 3. Security Incidents
    audit_base = db.query(AuditLog)
    if not is_admin:
        audit_base = audit_base.filter(AuditLog.user_id == user_id)
    security_incidents = audit_base.filter(
        AuditLog.action.in_([
            "unauthorized_access",
            "suspicious_activity",
            "multiple_failed_logins",
            "excessive_downloads",
            "failed_login",
        ])
    ).count()

    # 4. Recent Activity (Latest 10 audit logs)
    recent_query = (
        db.query(
            AuditLog,
            User.email.label("user_email"),
            File.filename.label("filename"),
        )
        .outerjoin(User, AuditLog.user_id == User.id)
        .outerjoin(File, AuditLog.file_id == File.id)
    )
    if not is_admin:
        recent_query = recent_query.filter(AuditLog.user_id == user_id)

    recent_logs = (
        recent_query.order_by(desc(AuditLog.timestamp))
        .limit(10)
        .all()
    )

    recent_activity = [
        RecentActivityItem(
            id=log.id,
            action=log.action,
            user_email=user_email,
            filename=filename,
            ip_address=log.ip_address,
            timestamp=log.timestamp,
            status=log.status,
        )
        for log, user_email, filename in recent_logs
    ]

    # 5. Trends Calculation (Past N days)
    start_date = (now - timedelta(days=days - 1)).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    
    # Pre-populate dates dict
    date_map = {}
    for i in range(days):
        d_str = (start_date + timedelta(days=i)).strftime("%Y-%m-%d")
        date_map[d_str] = {"uploads": 0, "downloads": 0, "shares": 0}

    # Uploads per day
    upload_query = db.query(
        func.date(File.created_at).label("d"),
        func.count(File.id).label("cnt"),
    ).filter(File.created_at >= start_date, File.is_deleted == False)
    if not is_admin:
        upload_query = upload_query.filter(File.owner_id == user_id)
    for row in upload_query.group_by(func.date(File.created_at)).all():
        ds = str(row.d)
        if ds in date_map:
            date_map[ds]["uploads"] = row.cnt

    # Shares per day
    share_query = db.query(
        func.date(FileShare.created_at).label("d"),
        func.count(FileShare.id).label("cnt"),
    ).filter(FileShare.created_at >= start_date)
    if not is_admin:
        share_query = share_query.filter(FileShare.owner_id == user_id)
    for row in share_query.group_by(func.date(FileShare.created_at)).all():
        ds = str(row.d)
        if ds in date_map:
            date_map[ds]["shares"] = row.cnt

    # Downloads from AuditLog per day
    dl_query = db.query(
        func.date(AuditLog.timestamp).label("d"),
        func.count(AuditLog.id).label("cnt"),
    ).filter(
        AuditLog.timestamp >= start_date,
        AuditLog.action.in_(["download", "public_download"]),
    )
    if not is_admin:
        dl_query = dl_query.filter(AuditLog.user_id == user_id)
    for row in dl_query.group_by(func.date(AuditLog.timestamp)).all():
        ds = str(row.d)
        if ds in date_map:
            date_map[ds]["downloads"] = row.cnt

    upload_trends = [
        TrendPoint(
            date=d_str,
            uploads=data["uploads"],
            downloads=data["downloads"],
            shares=data["shares"],
        )
        for d_str, data in date_map.items()
    ]

    # 6. Category Breakdown
    cat_query = (
        db.query(
            File.category,
            func.count(File.id).label("cnt"),
            func.coalesce(func.sum(File.size), 0).label("total_bytes"),
        )
        .filter(File.is_deleted == False)
    )
    if not is_admin:
        cat_query = cat_query.filter(File.owner_id == user_id)
    cat_rows = cat_query.group_by(File.category).all()

    category_distribution = []
    for cat, cnt, b_sum in cat_rows:
        pct = round((b_sum / total_storage_bytes * 100), 1) if total_storage_bytes > 0 else 0.0
        category_distribution.append(
            StorageCategoryItem(
                category=cat or "other",
                count=cnt,
                bytes=b_sum,
                percentage=pct,
            )
        )

    return AnalyticsDashboardOut(
        total_files=total_files,
        total_storage_bytes=total_storage_bytes,
        total_storage_mb=total_storage_mb,
        total_downloads=total_downloads,
        total_shares=total_shares,
        active_links=active_links,
        security_incidents=security_incidents,
        recent_activity=recent_activity,
        upload_trends=upload_trends,
        category_distribution=category_distribution,
    )
