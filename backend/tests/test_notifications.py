"""
test_notifications.py – Test suite for In-App Notifications, Read status, and Unread counts.
"""

import pytest
from app.models import Notification, User
from app.services.notification_service import (
    create_notification,
    delete_notification,
    get_unread_count,
    get_user_notifications,
    mark_all_as_read,
    mark_as_read,
    notify_file_shared,
    notify_file_downloaded,
    notify_security_alert,
)


def test_notification_lifecycle(db_session, test_user):
    """Verify notification creation, count, read toggle, and deletion."""
    user_id = test_user.id

    # 1. Create notifications
    notif1 = notify_file_shared(
        db=db_session,
        recipient_id=user_id,
        sender_email="alice@example.com",
        filename="quarterly_report.pdf",
    )
    notif2 = notify_file_downloaded(
        db=db_session,
        owner_id=user_id,
        filename="quarterly_report.pdf",
        downloader_info="bob@example.com",
    )
    notif3 = notify_security_alert(
        db=db_session,
        user_id=user_id,
        message="New login from unrecognized IP: 198.51.100.2",
    )

    # 2. Check unread count
    assert get_unread_count(db=db_session, user_id=user_id) == 3

    # 3. Mark single as read
    assert mark_as_read(db=db_session, notification_id=notif1.id, user_id=user_id) is True
    assert get_unread_count(db=db_session, user_id=user_id) == 2

    # 4. Mark all as read
    marked = mark_all_as_read(db=db_session, user_id=user_id)
    assert marked == 2
    assert get_unread_count(db=db_session, user_id=user_id) == 0

    # 5. Delete notification
    assert delete_notification(db=db_session, notification_id=notif2.id, user_id=user_id) is True
    remaining = get_user_notifications(db=db_session, user_id=user_id)
    assert len(remaining) == 2


def test_notifications_api_endpoints(client, auth_headers):
    """Verify HTTP API endpoints for /notifications."""
    # List notifications
    res = client.get("/notifications", headers=auth_headers)
    assert res.status_code == 200
    assert isinstance(res.json(), list)

    # Unread count
    res_count = client.get("/notifications/unread-count", headers=auth_headers)
    assert res_count.status_code == 200
    assert "unread_count" in res_count.json()

    # Read all
    res_read_all = client.post("/notifications/read-all", headers=auth_headers)
    assert res_read_all.status_code == 200
    assert res_read_all.json()["success"] is True
