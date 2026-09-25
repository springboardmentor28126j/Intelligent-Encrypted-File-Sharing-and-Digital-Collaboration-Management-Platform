import unittest
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock

from app.routers.activity import export_activity_csv, format_ist_timestamp, list_activity


class ActivityExportTests(unittest.TestCase):
    def test_format_ist_timestamp(self):
        dt = datetime(2026, 9, 25, 10, 30, 0)
        formatted = format_ist_timestamp(dt)
        self.assertIn("2026-09-25", formatted)
        self.assertIn("PM", formatted)

    def test_list_activity_endpoint(self):
        user = SimpleNamespace(id=1)
        db = MagicMock()
        mock_log = SimpleNamespace(id=1, user_id=1, action="upload", description="Uploaded file.txt", created_at=datetime.now(timezone.utc))

        query_mock = MagicMock()
        db.query.return_value = query_mock
        query_mock.outerjoin.return_value = query_mock
        query_mock.filter.return_value = query_mock
        query_mock.order_by.return_value = query_mock
        query_mock.limit.return_value = query_mock
        query_mock.all.return_value = [(mock_log, None)]

        result = list_activity(action="upload", search="", current_user=user, db=db)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0].action, "upload")

    def test_export_activity_csv_endpoint(self):
        user = SimpleNamespace(id=1)
        db = MagicMock()
        mock_log = SimpleNamespace(
            id=1,
            user_id=1,
            action="file_share",
            description="Shared doc.pdf with Alice",
            ip_address="127.0.0.1",
            user_agent="Mozilla/5.0",
            created_at=datetime(2026, 9, 25, 10, 0, 0),
        )
        mock_file = SimpleNamespace(id=10, original_filename="doc.pdf")

        query_mock = MagicMock()
        db.query.return_value = query_mock
        query_mock.outerjoin.return_value = query_mock
        query_mock.filter.return_value = query_mock
        query_mock.order_by.return_value = query_mock
        query_mock.all.return_value = [(mock_log, mock_file)]

        response = export_activity_csv(action="file_share", current_user=user, db=db)
        self.assertEqual(response.media_type, "text/csv; charset=utf-8")
        self.assertIn("trustshare_activity_report_", response.headers["Content-Disposition"])

        csv_text = response.body.decode("utf-8")
        self.assertIn("Timestamp (IST),Action,File Name,IP Address,User Agent,Details", csv_text)
        self.assertIn("File Share", csv_text)
        self.assertIn("doc.pdf", csv_text)
        self.assertIn("127.0.0.1", csv_text)
        self.assertIn("Shared doc.pdf with Alice", csv_text)
