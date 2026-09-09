import base64
import secrets
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from app import config
from app.routers.files import download_file
from app.services.encryption_service import encrypt_file_data
from app.services.storage_service import (
    LocalStorageService,
    S3StorageService,
    StorageError,
    StorageObjectNotFoundError,
)


class FakeBotoError(Exception):
    def __init__(self, code=None):
        self.response = {"Error": {"Code": code}} if code else {}


class FakeS3Client:
    def __init__(self):
        self.put_calls = []
        self.get_calls = []
        self.objects = {}

    def put_object(self, **kwargs):
        self.put_calls.append(kwargs)
        self.objects[(kwargs["Bucket"], kwargs["Key"])] = kwargs["Body"]

    def get_object(self, **kwargs):
        self.get_calls.append(kwargs)
        try:
            content = self.objects[(kwargs["Bucket"], kwargs["Key"])]
        except KeyError as error:
            raise FakeBotoError("NoSuchKey") from error
        return {"Body": SimpleNamespace(read=lambda: content)}


class StorageServiceTests(unittest.TestCase):
    def setUp(self):
        self.original_master_key = config.settings.file_encryption_master_key
        config.settings.file_encryption_master_key = base64.urlsafe_b64encode(secrets.token_bytes(32)).decode()

    def tearDown(self):
        config.settings.file_encryption_master_key = self.original_master_key

    def test_local_storage_round_trip(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            service = LocalStorageService(Path(temp_dir))
            stored = service.put_encrypted(b"ciphertext", "report.pdf")

            self.assertEqual(stored.backend, "local")
            self.assertEqual(service.get_encrypted(stored.key), b"ciphertext")

    def test_s3_upload_sends_ciphertext_only_and_private_server_side_encryption(self):
        client = FakeS3Client()
        service = S3StorageService.__new__(S3StorageService)
        service.client = client
        service.bucket = "private-test-bucket"
        service.prefix = "files"
        service._boto_errors = (FakeBotoError,)
        plaintext = b"secret plaintext"
        encrypted = encrypt_file_data(plaintext)

        stored = service.put_encrypted(encrypted.ciphertext, "secret.txt")
        call = client.put_calls[0]

        self.assertNotIn(plaintext, call["Body"])
        self.assertEqual(call["Body"], encrypted.ciphertext)
        self.assertEqual(call["ServerSideEncryption"], "AES256")
        self.assertNotIn("ACL", call)
        self.assertNotIn("secret.txt", stored.key)
        self.assertTrue(stored.key.startswith("files/"))

    def test_s3_object_keys_are_random(self):
        service = S3StorageService.__new__(S3StorageService)
        service.client = FakeS3Client()
        service.bucket = "private-test-bucket"
        service.prefix = "files"
        service._boto_errors = (FakeBotoError,)

        first = service.put_encrypted(b"one", "same-name.txt")
        second = service.put_encrypted(b"two", "same-name.txt")

        self.assertNotEqual(first.key, second.key)

    def test_s3_download_returns_encrypted_bytes_for_authorized_route(self):
        client = FakeS3Client()
        service = S3StorageService.__new__(S3StorageService)
        service.client = client
        service.bucket = "private-test-bucket"
        service.prefix = "files"
        service._boto_errors = (FakeBotoError,)
        plaintext = b"authorized s3 response"
        encrypted = encrypt_file_data(plaintext)
        stored = service.put_encrypted(encrypted.ciphertext, "report.bin")
        metadata = SimpleNamespace(
            algorithm=encrypted.algorithm,
            wrapped_key=encrypted.wrapped_key.hex(),
            key_nonce=encrypted.key_nonce.hex(),
            file_nonce=encrypted.file_nonce.hex(),
        )
        owner = SimpleNamespace(id=7, name="Owner", email="owner@example.com")
        item = SimpleNamespace(id=12, owner_id=owner.id, storage_backend="s3", storage_key=stored.key, file_path="", original_filename="report.bin", file_type="application/octet-stream", encryption=metadata)
        db = SimpleNamespace(get=lambda model, file_id: item, add=lambda record: None, commit=lambda: None)

        with patch("app.routers.files.get_storage_service", return_value=service):
            response = download_file(12, owner, db)

        self.assertEqual(response.body, plaintext)
        self.assertEqual(client.get_calls[0]["Key"], stored.key)

    def test_legacy_plaintext_local_file_still_works(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            path = Path(temp_dir) / "legacy.txt"
            path.write_bytes(b"legacy plaintext")
            owner = SimpleNamespace(id=7, name="Owner", email="owner@example.com")
            item = SimpleNamespace(id=13, owner_id=owner.id, file_path=str(path), original_filename="legacy.txt", file_type="text/plain", encryption=None)
            db = SimpleNamespace(get=lambda model, file_id: item, add=lambda record: None, commit=lambda: None)

            response = download_file(13, owner, db)

            self.assertEqual(response.path, str(path))

    def test_missing_s3_object_route_returns_safe_error(self):
        owner = SimpleNamespace(id=7, name="Owner", email="owner@example.com")
        item = SimpleNamespace(id=14, owner_id=owner.id, storage_backend="s3", storage_key="files/missing.enc", file_path="", encryption=None)
        db = SimpleNamespace(get=lambda model, file_id: item, add=lambda record: None, commit=lambda: None)
        missing_service = SimpleNamespace(get_encrypted=lambda key: (_ for _ in ()).throw(StorageObjectNotFoundError("internal object detail")))

        with patch("app.routers.files.get_storage_service", return_value=missing_service):
            with self.assertRaises(Exception) as error:
                download_file(14, owner, db)

        self.assertEqual(getattr(error.exception, "status_code", None), 404)
        self.assertEqual(getattr(error.exception, "detail", None), "The requested file is unavailable")

    def test_unauthorized_request_is_rejected_before_s3_retrieval(self):
        item = SimpleNamespace(id=12, owner_id=7, storage_backend="s3", storage_key="files/private.enc", file_path="")

        class Query:
            def filter(self, *args):
                return self
            def first(self):
                return None

        db = SimpleNamespace(get=lambda model, file_id: item, query=lambda model: Query())
        with patch("app.routers.files.get_storage_service") as storage_factory:
            with self.assertRaises(Exception) as error:
                download_file(12, SimpleNamespace(id=8), db)

        self.assertEqual(getattr(error.exception, "status_code", None), 403)
        storage_factory.assert_not_called()

    def test_missing_s3_object_is_translated_to_storage_error(self):
        service = S3StorageService.__new__(S3StorageService)
        service.client = FakeS3Client()
        service.bucket = "private-test-bucket"
        service.prefix = "files"
        service._boto_errors = (FakeBotoError,)

        with self.assertRaises(StorageObjectNotFoundError):
            service.get_encrypted("files/missing.enc")

    def test_s3_failure_is_translated_without_internal_details(self):
        class FailingClient:
            def put_object(self, **kwargs):
                raise FakeBotoError("AccessDenied")

        service = S3StorageService.__new__(S3StorageService)
        service.client = FailingClient()
        service.bucket = "private-test-bucket"
        service.prefix = "files"
        service._boto_errors = (FakeBotoError,)

        with self.assertRaises(StorageError) as error:
            service.put_encrypted(b"ciphertext", "report.bin")

        self.assertEqual(str(error.exception), "Cloud storage upload failed")
        self.assertNotIn("AccessDenied", str(error.exception))


if __name__ == "__main__":
    unittest.main()