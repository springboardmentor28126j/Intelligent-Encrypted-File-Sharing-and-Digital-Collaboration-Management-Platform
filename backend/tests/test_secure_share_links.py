import base64
import secrets
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import HTTPException

from app import config
from app.models import File, SecureShareLink
from app.routers.secure_share_links import access_share_link, create_share_link, hash_share_token, revoke_share_link
from app.services.encryption_service import encrypt_file_data, metadata_for_storage


class Query:
    def __init__(self, value):
        self.value = value

    def filter(self, *args):
        return self

    def first(self):
        return self.value


class SecureShareLinkTests(unittest.TestCase):
    def setUp(self):
        self.original_master_key = config.settings.file_encryption_master_key
        self.original_base_url = config.settings.share_link_base_url
        config.settings.file_encryption_master_key = base64.urlsafe_b64encode(secrets.token_bytes(32)).decode()
        config.settings.share_link_base_url = "http://localhost:8000/api/share-links"

    def tearDown(self):
        config.settings.file_encryption_master_key = self.original_master_key
        config.settings.share_link_base_url = self.original_base_url

    def test_owner_can_create_link_and_only_hash_is_stored(self):
        owner = SimpleNamespace(id=7, name="Owner", email="owner@example.com")
        item = SimpleNamespace(id=12, owner_id=owner.id, original_filename="report.pdf")
        records = []

        class Db:
            def get(self, model, file_id):
                return item
            def add(self, value):
                records.append(value)
            def commit(self):
                pass
            def refresh(self, value):
                value.created_at = value.created_at or __import__("datetime").datetime.utcnow()

        response = create_share_link(12, None, owner, Db())
        link = records[0]
        token = response["share_url"].rsplit("/", 1)[-1]

        self.assertIsInstance(link, SecureShareLink)
        self.assertEqual(link.token_hash, hash_share_token(token))
        self.assertNotEqual(link.token_hash, token)
        self.assertNotIn(token, link.token_hash)
        self.assertTrue(response["share_url"].startswith(config.settings.frontend_origin.rstrip("/") + "/share/"))

    def test_non_owner_cannot_create_link(self):
        owner = SimpleNamespace(id=7)
        other_user = SimpleNamespace(id=8)
        item = SimpleNamespace(id=12, owner_id=owner.id)
        db = SimpleNamespace(get=lambda model, file_id: item)

        with self.assertRaises(HTTPException) as error:
            create_share_link(12, None, other_user, db)

        self.assertEqual(error.exception.status_code, 403)

    def test_valid_link_returns_original_encrypted_file_content(self):
        owner = SimpleNamespace(id=7, name="Owner", email="owner@example.com")
        plaintext = b"secure shared content"
        encrypted = encrypt_file_data(plaintext)
        with tempfile.TemporaryDirectory() as temp_dir:
            path = Path(temp_dir) / "stored.enc"
            path.write_bytes(encrypted.ciphertext)
            item = SimpleNamespace(id=12, owner_id=owner.id, file_path=str(path), storage_backend=None, storage_key=None, original_filename="report.txt", file_type="text/plain", encryption=SimpleNamespace(**metadata_for_storage(encrypted)))
            token = secrets.token_urlsafe(32)
            link = SimpleNamespace(id=1, file_id=item.id, revoked_at=None, token_hash=hash_share_token(token), expires_at=None, max_downloads=None, download_count=0)
            db = SimpleNamespace(query=lambda model: Query(link), get=lambda model, file_id: item if model == File else owner, commit=lambda: None)

            response = access_share_link(token, db)

        self.assertEqual(response.body, plaintext)
        self.assertEqual(response.media_type, "text/plain")

    def test_invalid_or_modified_token_is_rejected(self):
        token = secrets.token_urlsafe(32)
        db = SimpleNamespace(query=lambda model: Query(None))

        with self.assertRaises(HTTPException) as error:
            access_share_link(token[:-1] + ("A" if token[-1] != "A" else "B"), db)

        self.assertEqual(error.exception.status_code, 404)

    def test_revoked_link_is_rejected(self):
        token = secrets.token_urlsafe(32)
        link = SimpleNamespace(id=1, file_id=12, revoked_at=__import__("datetime").datetime.utcnow(), token_hash=hash_share_token(token))
        db = SimpleNamespace(query=lambda model: Query(link))

        with self.assertRaises(HTTPException) as error:
            access_share_link(token, db)

        self.assertEqual(error.exception.status_code, 404)

    def test_owner_can_revoke_link(self):
        owner = SimpleNamespace(id=7)
        item = SimpleNamespace(id=12, owner_id=owner.id, original_filename="report.txt")
        link = SimpleNamespace(id=3, file_id=12, revoked_at=None)
        db = SimpleNamespace(get=lambda model, value: item, query=lambda model: Query(link), add=lambda record: None, commit=lambda: None)

        response = revoke_share_link(12, 3, owner, db)

        self.assertEqual(response["message"], "Secure link revoked")
        self.assertIsNotNone(link.revoked_at)


if __name__ == "__main__":
    unittest.main()
