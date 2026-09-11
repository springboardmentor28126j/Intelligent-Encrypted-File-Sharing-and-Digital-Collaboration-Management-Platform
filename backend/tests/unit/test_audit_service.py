import pytest
from src.services.audit_service import AuditService

@pytest.mark.asyncio
async def test_audit_log_fallback():
    event_id = await AuditService.log_event(
        category="SECURITY",
        action="TEST_ACTION",
        actor={"user_id": "test", "client_ip": "127.0.0.1"},
        resource={"resource_type": "file", "resource_id": "123", "resource_name": "test.txt"},
        status="SUCCESS"
    )
    assert event_id is not None
