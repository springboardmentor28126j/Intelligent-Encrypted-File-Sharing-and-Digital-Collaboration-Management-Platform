"""
test_analytics.py – Test suite for Analytics Dashboard, Trends, and Storage breakdowns.
"""

import pytest


def test_analytics_dashboard_api(client, auth_headers):
    """Verify /analytics/dashboard endpoint metrics and trend payload."""
    res = client.get("/analytics/dashboard?days=7", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()

    # Verify all expected cards and charts fields exist
    assert "total_files" in data
    assert "total_storage_bytes" in data
    assert "total_storage_mb" in data
    assert "total_downloads" in data
    assert "total_shares" in data
    assert "active_links" in data
    assert "security_incidents" in data
    assert "recent_activity" in data
    assert "upload_trends" in data
    assert "category_distribution" in data

    # Verify upload trends has points
    assert len(data["upload_trends"]) == 7
    assert "date" in data["upload_trends"][0]
    assert "uploads" in data["upload_trends"][0]
