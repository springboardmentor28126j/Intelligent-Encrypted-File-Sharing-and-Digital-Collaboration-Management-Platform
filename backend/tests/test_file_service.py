import asyncio
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace

from app import config
from app.services import file_service
from app.services.activity_service import log_download_notification


class FakeUpload:
    def __init__(self, chunks, filename='demo.mp4'):
        self.chunks = chunks
        self.filename = filename
        self.pos = 0

    async def read(self, size=-1):
        if self.pos >= len(self.chunks):
            return b''
        data = self.chunks[self.pos]
        self.pos += 1
        return data


class SaveUploadTests(unittest.TestCase):
    def setUp(self):
        self.original_dir = file_service.UPLOAD_DIR
        self.original_limit = config.settings.max_file_size_mb
        self.temp_dir = tempfile.TemporaryDirectory()
        file_service.UPLOAD_DIR = Path(self.temp_dir.name)
        file_service.UPLOAD_DIR.mkdir(exist_ok=True)

    def tearDown(self):
        file_service.UPLOAD_DIR = self.original_dir
        config.settings.max_file_size_mb = self.original_limit
        self.temp_dir.cleanup()

    def test_save_upload_writes_file_for_video(self):
        upload = FakeUpload([b'123', b'456'])
        stored, path, size = asyncio.run(file_service.save_upload(upload))

        self.assertTrue(Path(path).exists())
        self.assertEqual(size, 6)
        self.assertTrue(stored.endswith('_demo.mp4'))

    def test_save_upload_removes_over_limit_file(self):
        config.settings.max_file_size_mb = 0
        upload = FakeUpload([b'123'])

        with self.assertRaises(ValueError):
            asyncio.run(file_service.save_upload(upload))

        self.assertEqual(list(file_service.UPLOAD_DIR.iterdir()), [])


class ActivityNotificationTests(unittest.TestCase):
    def test_log_download_notification_records_owner_action(self):
        class DummyDb:
            def __init__(self):
                self.records = []
            def add(self, item):
                self.records.append(item)
            def commit(self):
                pass

        db = DummyDb()
        owner = SimpleNamespace(id=1, email='owner@example.com', name='Owner')
        downloader = SimpleNamespace(id=2, email='viewer@example.com', name='Viewer')

        log_download_notification(db, owner, downloader, 'report.pdf', 99)

        self.assertEqual(len(db.records), 1)
        self.assertEqual(db.records[0].user_id, 1)
        self.assertEqual(db.records[0].action, 'shared_download')
        self.assertIn('downloaded', db.records[0].description)
        self.assertEqual(db.records[0].file_id, 99)


if __name__ == '__main__':
    unittest.main()
