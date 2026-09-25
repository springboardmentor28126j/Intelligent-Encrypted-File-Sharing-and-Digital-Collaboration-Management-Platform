import time
import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from fastapi import HTTPException
from app.services.security_service import (
    check_login_lockout,
    record_failed_file_access,
    record_failed_login,
    reset_failed_login,
)


class SecurityServiceTests(unittest.TestCase):
    def setUp(self):
        # Reset state before each test
        reset_failed_login("test@example.com")
        reset_failed_login("user@example.com")

    def test_record_failed_login_threshold_and_lockout(self):
        user = SimpleNamespace(id=10, email="test@example.com")
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = user

        # 4 failed attempts should not trigger lockout
        for i in range(4):
            locked = record_failed_login(db, "test@example.com", ip_address="192.168.1.1")
            self.assertFalse(locked)

        # 5th failed attempt should trigger lockout
        with patch("app.services.security_service.log_activity") as mock_log, \
             patch("app.services.security_service.create_notification") as mock_notif:
            locked = record_failed_login(db, "test@example.com", ip_address="192.168.1.1")
            self.assertTrue(locked)
            mock_log.assert_called_once()
            self.assertEqual(mock_log.call_args[1]["action"], "SUSPICIOUS_LOGIN_ATTEMPT")
            mock_notif.assert_called_once()
            self.assertEqual(mock_notif.call_args[1]["type"], "security_alert")

        # Verify lockout check returns true
        is_locked, msg = check_login_lockout("test@example.com")
        self.assertTrue(is_locked)
        self.assertIn("15 minutes", msg)

        # Reset failed login clears lockout
        reset_failed_login("test@example.com")
        is_locked, _ = check_login_lockout("test@example.com")
        self.assertFalse(is_locked)

    def test_record_failed_file_access_threshold(self):
        db = MagicMock()
        owner = SimpleNamespace(id=5, email="owner@example.com")
        file_item = SimpleNamespace(id=99, owner_id=5, original_filename="confidential.docx")
        db.get.return_value = owner

        # First 2 attempts
        for _ in range(2):
            alerted = record_failed_file_access(db, file_item, ip_address="10.0.0.5")
            self.assertFalse(alerted)

        # 3rd attempt triggers security alert
        with patch("app.services.security_service.log_activity") as mock_log, \
             patch("app.services.security_service.create_notification") as mock_notif:
            alerted = record_failed_file_access(db, file_item, ip_address="10.0.0.5")
            self.assertTrue(alerted)
            mock_log.assert_called_once()
            self.assertEqual(mock_log.call_args[1]["action"], "UNAUTHORIZED_ACCESS_ATTEMPT")
            mock_notif.assert_called_once()
            self.assertEqual(mock_notif.call_args[1]["type"], "security_alert")
