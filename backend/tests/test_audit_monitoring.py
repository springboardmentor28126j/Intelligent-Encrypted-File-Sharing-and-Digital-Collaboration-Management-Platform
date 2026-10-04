"""
test_audit_monitoring.py – Test suite for Activity Monitoring, Audit Logs, and File Access Trails.
"""

import pytest
from app.models import AuditLog, File, User
from app.services.audit_service import (
    get_audit_logs,
    get_audit_stats,
    get_file_history,
    log_audit_event,
)


def test_log_audit_event_and_query(db_session):
    """Verify writing audit log entries and querying them back."""
    # 1. Write an event
    log_entry = log_audit_event(
        db=db_session,
        action="upload",
        user_id=1,
        file_id=10,
        ip_address="192.168.1.50",
        details="Uploaded secret document",
        status="success",
    )
    assert log_entry.id is not None
    assert log_entry.action == "upload"
    assert log_entry.ip_address == "192.168.1.50"

    # 2. Query logs
    logs = get_audit_logs(db=db_session, user_id=1)
    assert len(logs) >= 1
    found = any(l["action"] == "upload" and l["ip_address"] == "192.168.1.50" for l in logs)
    assert found is True


def test_audit_stats_aggregation(db_session):
    """Verify aggregated audit stats calculations."""
    log_audit_event(db=db_session, action="login", user_id=2, status="success")
    log_audit_event(db=db_session, action="failed_login", ip_address="10.0.0.1", status="failure")
    log_audit_event(db=db_session, action="download", user_id=2, file_id=5, status="success")
    log_audit_event(db=db_session, action="unauthorized_access", ip_address="10.0.0.99", status="security_incident")

    stats = get_audit_stats(db=db_session)
    assert stats["total_events"] >= 4
    assert stats["login_events"] >= 1
    assert stats["failed_logins"] >= 1
    assert stats["file_operations"] >= 1
    assert stats["security_alerts"] >= 1
    assert "login" in stats["actions_breakdown"]


def test_audit_api_endpoints(client, auth_headers):
    """Verify HTTP API endpoints for /audit/logs and /audit/stats."""
    # Query logs
    res = client.get("/audit/logs", headers=auth_headers)
    assert res.status_code == 200
    assert isinstance(res.json(), list)

    # Query stats
    res_stats = client.get("/audit/stats", headers=auth_headers)
    assert res_stats.status_code == 200
    data = res_stats.json()
    assert "total_events" in data
    assert "actions_breakdown" in data
