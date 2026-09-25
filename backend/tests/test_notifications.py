import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from fastapi import HTTPException

from app.models.notification import Notification
from app.routers.notifications import clear_all_notifications, delete_notification, list_notifications, mark_all_read, mark_notification_read
from app.services.email_service import send_notification_email
from app.services.notification_service import (
    count_unread_notifications,
    create_notification,
    delete_all_user_notifications,
    delete_notification_by_id,
    get_user_notifications,
    mark_all_notifications_as_read,
    mark_notification_as_read,
)


class NotificationServiceTests(unittest.TestCase):
    def test_notification_model_fields(self):
        n = Notification(
            user_id=1,
            type="file_share",
            title="New file shared",
            message="Alice shared doc.pdf with you.",
        )
        self.assertEqual(n.user_id, 1)
        self.assertEqual(n.type, "file_share")
        self.assertEqual(n.title, "New file shared")
        self.assertEqual(n.message, "Alice shared doc.pdf with you.")
        self.assertFalse(n.is_read)

    def test_create_notification(self):
        added = []
        db = SimpleNamespace(
            add=lambda item: added.append(item),
            commit=lambda: None,
            refresh=lambda item: setattr(item, "id", 101),
        )
        n = create_notification(db, user_id=2, type="download", title="File downloaded", message="report.pdf was downloaded.")
        self.assertEqual(len(added), 1)
        self.assertEqual(n.user_id, 2)
        self.assertEqual(n.type, "download")
        self.assertEqual(n.title, "File downloaded")
        self.assertEqual(n.is_read, False)
        self.assertEqual(n.id, 101)

    def test_mark_notification_as_read(self):
        notif = SimpleNamespace(id=5, user_id=1, is_read=False)
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = notif

        result = mark_notification_as_read(db, notification_id=5, user_id=1)
        self.assertIsNotNone(result)
        self.assertTrue(result.is_read)
        db.commit.assert_called_once()
        db.refresh.assert_called_once_with(notif)

    def test_mark_notification_as_read_not_found(self):
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = None

        result = mark_notification_as_read(db, notification_id=99, user_id=1)
        self.assertIsNone(result)

    def test_mark_all_notifications_as_read(self):
        db = MagicMock()
        db.query.return_value.filter.return_value.update.return_value = 3

        count = mark_all_notifications_as_read(db, user_id=1)
        self.assertEqual(count, 3)
        db.commit.assert_called_once()

    def test_delete_notification_by_id(self):
        notif = SimpleNamespace(id=5, user_id=1)
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = notif

        res = delete_notification_by_id(db, notification_id=5, user_id=1)
        self.assertTrue(res)
        db.delete.assert_called_once_with(notif)
        db.commit.assert_called_once()

    def test_delete_all_user_notifications(self):
        db = MagicMock()
        db.query.return_value.filter.return_value.delete.return_value = 4

        count = delete_all_user_notifications(db, user_id=1)
        self.assertEqual(count, 4)
        db.commit.assert_called_once()


class NotificationRouterTests(unittest.TestCase):
    def test_list_notifications_endpoint(self):
        user = SimpleNamespace(id=1, name="Test User")
        db = MagicMock()
        mock_notifs = [
            SimpleNamespace(id=1, user_id=1, type="file_share", title="Title 1", message="Msg 1", is_read=False),
            SimpleNamespace(id=2, user_id=1, type="download", title="Title 2", message="Msg 2", is_read=True),
        ]
        with patch("app.routers.notifications.get_user_notifications", return_value=mock_notifs), \
             patch("app.routers.notifications.count_unread_notifications", return_value=1):
            response = list_notifications(limit=100, current_user=user, db=db)
            self.assertEqual(response["unread_count"], 1)
            self.assertEqual(len(response["notifications"]), 2)

    def test_mark_notification_read_endpoint(self):
        user = SimpleNamespace(id=1)
        db = MagicMock()
        mock_notif = SimpleNamespace(id=10, user_id=1, is_read=True)
        with patch("app.routers.notifications.mark_notification_as_read", return_value=mock_notif):
            response = mark_notification_read(id=10, current_user=user, db=db)
            self.assertEqual(response.id, 10)
            self.assertTrue(response.is_read)

    def test_mark_notification_read_not_found(self):
        user = SimpleNamespace(id=1)
        db = MagicMock()
        with patch("app.routers.notifications.mark_notification_as_read", return_value=None):
            with self.assertRaises(HTTPException) as ctx:
                mark_notification_read(id=999, current_user=user, db=db)
            self.assertEqual(ctx.exception.status_code, 404)

    def test_mark_all_read_endpoint(self):
        user = SimpleNamespace(id=1)
        db = MagicMock()
        with patch("app.routers.notifications.mark_all_notifications_as_read", return_value=5):
            response = mark_all_read(current_user=user, db=db)
            self.assertEqual(response["message"], "All notifications marked as read")

    def test_delete_notification_endpoint(self):
        user = SimpleNamespace(id=1)
        db = MagicMock()
        with patch("app.routers.notifications.delete_notification_by_id", return_value=True):
            res = delete_notification(id=10, current_user=user, db=db)
            self.assertEqual(res["message"], "Notification deleted successfully")

    def test_clear_all_notifications_endpoint(self):
        user = SimpleNamespace(id=1)
        db = MagicMock()
        with patch("app.routers.notifications.delete_all_user_notifications", return_value=3):
            res = clear_all_notifications(current_user=user, db=db)
            self.assertEqual(res["message"], "All notifications cleared")



class EmailServiceNotificationTests(unittest.TestCase):
    @patch("smtplib.SMTP")
    def test_send_notification_email_success(self, mock_smtp):
        instance = MagicMock()
        mock_smtp.return_value.__enter__.return_value = instance

        with patch("app.services.email_service.settings") as mock_settings:
            mock_settings.smtp_host = "smtp.example.com"
            mock_settings.smtp_port = 587
            mock_settings.smtp_username = "user@example.com"
            mock_settings.smtp_password = "password"
            mock_settings.smtp_from_email = "no-reply@example.com"
            mock_settings.smtp_use_tls = True

            send_notification_email(
                recipient="bob@example.com",
                subject_or_message="New file shared",
                message="Alice shared doc.pdf with you.",
            )
            instance.starttls.assert_called_once()
            instance.login.assert_called_once_with("user@example.com", "password")
            instance.send_message.assert_called_once()

    def test_send_notification_email_unconfigured_does_not_throw(self):
        with patch("app.services.email_service.settings") as mock_settings:
            mock_settings.smtp_host = ""
            mock_settings.smtp_username = ""
            # Should gracefully log and return without raising
            send_notification_email("bob@example.com", "Subject", "Message")
