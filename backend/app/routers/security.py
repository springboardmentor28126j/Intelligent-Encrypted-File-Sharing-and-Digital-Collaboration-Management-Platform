"""
routers/security.py – Comprehensive Security Monitoring, Alerts, and Lockout Management Endpoints.

Routes:
  GET   /security/summary                – Aggregated security metrics & open alert counts
  GET   /security/events                 – Filterable security & incident audit events
  GET   /security/alerts                 – Real-time high-priority security alerts
  PATCH /security/alerts/{alert_id}      – Update alert lifecycle (OPEN, INVESTIGATING, RESOLVED)
  GET   /security/suspicious-activities  – Suspicious velocity & brute force records
  PATCH /security/suspicious-activities/{id} – Update suspicious activity status
  GET   /security/locked-accounts        – List temporarily locked user accounts (Admin)
  POST  /security/unlock-account/{user_id} – Admin action to unlock user account
  GET   /security/analytics              – Security time-series trends and severity breakdowns
"""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import User, UserRole
from app.schemas import (
    AuditLogOut,
    LockedAccountOut,
    MessageResponse,
    SecurityAlertOut,
    SecurityAnalyticsOut,
    SecuritySummaryOut,
    SuspiciousActivityOut,
    UpdateSecurityStatusRequest,
)
from app.services.audit_service import get_audit_logs
from app.services.security_service import (
    get_security_analytics,
    get_security_summary,
    list_locked_accounts,
    list_security_alerts,
    list_suspicious_activities,
    unlock_user_account,
    update_security_alert_status,
    update_suspicious_activity_status,
)

router = APIRouter(prefix="/security", tags=["Security Monitoring"])


@router.get(
    "/summary",
    response_model=SecuritySummaryOut,
    summary="Get aggregated security overview metrics",
)
def get_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_security_summary(db=db, current_user=current_user)


@router.get(
    "/events",
    response_model=List[AuditLogOut],
    summary="List security incidents and access events",
)
def get_security_events(
    action: Optional[str] = Query(None, description="Filter by event action (e.g. failed_login, account_locked, unauthorized_access)"),
    status_filter: Optional[str] = Query(None, description="Filter by status (e.g. security_incident, failure, success)"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id_filter = None if current_user.role == UserRole.admin.value else current_user.id
    return get_audit_logs(
        db=db,
        user_id=user_id_filter,
        action=action,
        status_filter=status_filter,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/alerts",
    response_model=List[SecurityAlertOut],
    summary="List security alerts and warnings",
)
def get_alerts(
    status: Optional[str] = Query("all", description="Filter by status: OPEN, INVESTIGATING, RESOLVED, all"),
    severity: Optional[str] = Query("all", description="Filter by severity: INFO, WARNING, HIGH, CRITICAL, all"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return list_security_alerts(
        db=db,
        current_user=current_user,
        status=status,
        severity=severity,
        limit=limit,
        offset=offset,
    )


@router.patch(
    "/alerts/{alert_id}",
    response_model=MessageResponse,
    summary="Update security alert investigation state (Admin)",
)
def update_alert(
    alert_id: int,
    payload: UpdateSecurityStatusRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != UserRole.admin.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privilege required to update security alert state.",
        )
    success = update_security_alert_status(
        db=db, alert_id=alert_id, new_status=payload.status, admin_user=current_user
    )
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Security alert not found.",
        )
    return MessageResponse(message=f"Security alert updated to {payload.status}.")


@router.get(
    "/suspicious-activities",
    response_model=List[SuspiciousActivityOut],
    summary="List velocity-triggered suspicious activity records",
)
def get_suspicious_activities(
    status: Optional[str] = Query("all", description="Filter status: OPEN, INVESTIGATING, RESOLVED, all"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return list_suspicious_activities(
        db=db,
        current_user=current_user,
        status=status,
        limit=limit,
        offset=offset,
    )


@router.patch(
    "/suspicious-activities/{activity_id}",
    response_model=MessageResponse,
    summary="Update suspicious activity status (Admin)",
)
def update_suspicious(
    activity_id: int,
    payload: UpdateSecurityStatusRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != UserRole.admin.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privilege required to update suspicious activity status.",
        )
    success = update_suspicious_activity_status(
        db=db, activity_id=activity_id, new_status=payload.status, admin_user=current_user
    )
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Suspicious activity record not found.",
        )
    return MessageResponse(message=f"Suspicious activity record updated to {payload.status}.")


@router.get(
    "/locked-accounts",
    response_model=List[LockedAccountOut],
    summary="List currently locked user accounts (Admin)",
)
def get_locked_accounts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != UserRole.admin.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privilege required to view locked accounts.",
        )
    return list_locked_accounts(db=db)


@router.post(
    "/unlock-account/{user_id}",
    response_model=MessageResponse,
    summary="Manually unlock a locked user account (Admin)",
)
def unlock_account(
    user_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != UserRole.admin.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privilege required to unlock user accounts.",
        )
    success = unlock_user_account(
        db=db, user_id=user_id, admin_user=current_user, request=request
    )
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User account not found.",
        )
    return MessageResponse(message="User account successfully unlocked and security incidents resolved.")


@router.get(
    "/analytics",
    response_model=SecurityAnalyticsOut,
    summary="Get security time-series trends and severity breakdowns",
)
def get_analytics(
    days: int = Query(7, ge=1, le=90),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_security_analytics(db=db, days=days)
