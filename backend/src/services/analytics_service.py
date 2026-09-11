import asyncio
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from src.models.sql.user import User
from src.models.sql.file import File
from src.models.sql.share import ShareLink
from src.models.nosql.database import get_mongo_db

class AnalyticsService:
    @staticmethod
    async def get_dashboard_metrics(db: AsyncSession, user: User) -> dict:
        total_files = await db.scalar(select(func.count(File.id)).where(File.owner_id == user.id)) or 0
        active_shares = await db.scalar(select(func.count(ShareLink.id)).where(ShareLink.created_by == user.id)) or 0
        
        alerts_count = 0
        try:
            mongo = get_mongo_db()
            alerts_count = await asyncio.wait_for(mongo.security_alerts.count_documents({}), timeout=0.5)
        except Exception:
            alerts_count = 0

        return {
            "storage_used_bytes": user.storage_used_bytes,
            "storage_quota_bytes": user.storage_quota_bytes,
            "total_files": total_files,
            "active_share_links": active_shares,
            "security_alerts_count": alerts_count
        }

    @staticmethod
    async def get_admin_metrics(db: AsyncSession) -> dict:
        total_users = await db.scalar(select(func.count(User.id))) or 0
        total_files = await db.scalar(select(func.count(File.id))) or 0
        total_storage_used = await db.scalar(select(func.sum(File.size_bytes))) or 0
        total_shares = await db.scalar(select(func.count(ShareLink.id))) or 0

        return {
            "total_users": total_users,
            "total_files": total_files,
            "total_storage_used_bytes": total_storage_used,
            "total_shares": total_shares
        }
