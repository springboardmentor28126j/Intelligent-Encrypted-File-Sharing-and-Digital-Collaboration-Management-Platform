from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from src.models.sql.database import get_db
from src.models.sql.user import User
from src.services.analytics_service import AnalyticsService
from src.api.deps import get_current_user, get_current_admin

router = APIRouter(prefix="/analytics", tags=["Analytics"])

@router.get("/dashboard")
async def get_user_dashboard(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await AnalyticsService.get_dashboard_metrics(db, user)

@router.get("/admin")
async def get_admin_dashboard(admin: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    return await AnalyticsService.get_admin_metrics(db)
