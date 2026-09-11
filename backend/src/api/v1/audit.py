from fastapi import APIRouter, Depends, Query
from typing import Optional, List, Dict, Any
from src.services.audit_service import AuditService
from src.api.deps import get_current_admin, get_current_user
from src.models.sql.user import User

router = APIRouter(prefix="/audit", tags=["Audit & Telemetry"])

@router.get("/logs", response_model=List[Dict[str, Any]])
async def get_audit_logs(
    category: Optional[str] = None,
    action: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = Query(default=50, ge=1, le=200),
    admin: User = Depends(get_current_admin)
):
    return await AuditService.query_logs(category, action, status, limit)
