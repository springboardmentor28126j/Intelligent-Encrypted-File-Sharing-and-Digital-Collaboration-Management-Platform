import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from src.models.sql.user import User
from src.services.analytics_service import AnalyticsService

@pytest.mark.asyncio
async def test_analytics_metrics(async_session: AsyncSession, test_user: User):
    metrics = await AnalyticsService.get_dashboard_metrics(async_session, test_user)
    assert "storage_used_bytes" in metrics
    assert "total_files" in metrics
    assert "active_share_links" in metrics

    admin_metrics = await AnalyticsService.get_admin_metrics(async_session)
    assert "total_users" in admin_metrics
    assert "total_files" in admin_metrics
