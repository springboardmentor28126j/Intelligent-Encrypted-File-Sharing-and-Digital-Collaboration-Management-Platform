"""
routers/audit.py – Activity Monitoring & Security Audit API endpoints.

Routes:
  GET /audit/logs               – Paginated activity audit logs with search/action/status filters
  GET /audit/stats              – Aggregated monitoring stats (logins, file ops, security incidents)
  GET /audit/file/{file_id}     – Full access history and lifecycle trail for a specific file
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import File, User, UserRole
from app.schemas import AuditLogOut, AuditStatsOut
from app.services.audit_service import get_audit_logs, get_audit_stats, get_file_history

router = APIRouter(prefix="/audit", tags=["Monitoring & Audit"])


@router.get(
    "/logs",
    response_model=List[AuditLogOut],
    summary="List security and activity audit logs",
)
def list_audit_logs(
    action: Optional[str] = Query(None, description="Filter by action name (e.g. login, upload, failed_login)"),
    file_id: Optional[int] = Query(None, description="Filter by specific file ID"),
    status_filter: Optional[str] = Query(None, description="Filter by status (success, failure, security_incident)"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Admins see system-wide logs; standard users see their own events
    user_id_filter = None if current_user.role == UserRole.admin.value else current_user.id
    logs = get_audit_logs(
        db=db,
        user_id=user_id_filter,
        action=action,
        file_id=file_id,
        status_filter=status_filter,
        limit=limit,
        offset=offset,
    )
    return logs


@router.get(
    "/stats",
    response_model=AuditStatsOut,
    summary="Get aggregated security monitoring and event metrics",
)
def get_monitoring_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id_filter = None if current_user.role == UserRole.admin.value else current_user.id
    return get_audit_stats(db=db, user_id=user_id_filter)


@router.get(
    "/file/{file_id}",
    response_model=List[AuditLogOut],
    summary="Get access and audit history for a specific file",
)
def get_file_audit_history(
    file_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Verify file ownership or admin role
    file = db.query(File).filter(File.id == file_id).first()
    if not file:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found.")
    if file.owner_id != current_user.id and current_user.role != UserRole.admin.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: You do not own this file.",
        )
    return get_file_history(db=db, file_id=file_id)
