import asyncio
import base64
import secrets
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace

from app import config
from app.routers.files import download_file, to_response
from app.services import file_service
from app.services.encryption_service import decrypt_file_data, encrypt_file_data


class FakeUpload:
    def __init__(self, data: bytes, filename: str = "binary.bin"):
        self.data = data
        self.filename = filename
        self.read_offset = 0

    async def read(self, size=-1):
        if self.read_offset >= len(self.data):
            return b""
        chunk = self.data[self.read_offset:self.read_offset + size]
        self.read_offset += len(chunk)
        return chunk


class EncryptionServiceTests(unittest.TestCase):
    def setUp(self):
        self.original_master_key = config.settings.file_encryption_master_key
        config.settings.file_encryption_master_key = base64.urlsafe_b64encode(secrets.token_bytes(32)).decode()

    def tearDown(self):
        config.settings.file_encryption_master_key = self.original_master_key

    def test_encrypt_decrypt_round_trip(self):
        plaintext = b"TrustShare encrypted content\x00\xff"
        encrypted = encrypt_file_data(plaintext)

        self.assertNotEqual(encrypted.ciphertext, plaintext)
        self.assertEqual(decrypt_file_data(encrypted.ciphertext, self._metadata(encrypted)), plaintext)

    def test_each_encryption_uses_different_key_and_nonces(self):
        first = encrypt_file_data(b"same content")
        second = encrypt_file_data(b"same content")

        self.assertNotEqual(first.wrapped_key, second.wrapped_key)
        self.assertNotEqual(first.file_nonce, second.file_nonce)
        self.assertNotEqual(first.key_nonce, second.key_nonce)

    def test_tampered_ciphertext_is_rejected(self):
        encrypted = encrypt_file_data(b"protected")
        tampered = bytearray(encrypted.ciphertext)
        tampered[-1] ^= 1

        with self.assertRaises(ValueError):
            decrypt_file_data(bytes(tampered), self._metadata(encrypted))

    def test_wrong_wrapped_key_is_rejected(self):
        encrypted = encrypt_file_data(b"protected")
        other = encrypt_file_data(b"other")

        with self.assertRaises(ValueError):
            decrypt_file_data(encrypted.ciphertext, self._metadata(other))

    def test_empty_and_binary_files_are_supported(self):
        for plaintext in (b"", bytes(range(256))):
            encrypted = encrypt_file_data(plaintext)
            self.assertEqual(decrypt_file_data(encrypted.ciphertext, self._metadata(encrypted)), plaintext)

    def test_encrypted_upload_stores_ciphertext_only(self):
        original_dir = file_service.UPLOAD_DIR
        original_limit = config.settings.max_file_size_mb
        plaintext = b"private upload contents"
        with tempfile.TemporaryDirectory() as temp_dir:
            try:
                file_service.UPLOAD_DIR = Path(temp_dir)
                config.settings.max_file_size_mb = 1
                _, path, size, encrypted = asyncio.run(file_service.save_encrypted_upload(FakeUpload(plaintext)))
                stored = Path(path).read_bytes()
            finally:
                file_service.UPLOAD_DIR = original_dir
                config.settings.max_file_size_mb = original_limit

        self.assertEqual(size, len(plaintext))
        self.assertEqual(stored, encrypted.ciphertext)
        self.assertNotEqual(stored, plaintext)
        self.assertEqual(decrypt_file_data(stored, self._metadata(encrypted)), plaintext)

    def test_authorized_download_returns_plaintext(self):
        original_dir = file_service.UPLOAD_DIR
        plaintext = b"authorized response"
        owner = SimpleNamespace(id=7, name="Owner", email="owner@example.com")
        with tempfile.TemporaryDirectory() as temp_dir:
            try:
                file_service.UPLOAD_DIR = Path(temp_dir)
                encrypted = encrypt_file_data(plaintext)
                path = Path(temp_dir) / "stored.bin"
                path.write_bytes(encrypted.ciphertext)
                item = SimpleNamespace(id=12, owner_id=owner.id, file_path=str(path), original_filename="report.bin", file_type="application/octet-stream", encryption=self._metadata(encrypted))
                response = download_file(12, owner, SimpleNamespace(get=lambda model, file_id: item, add=lambda record: None, commit=lambda: None))
            finally:
                file_service.UPLOAD_DIR = original_dir

        self.assertEqual(response.body, plaintext)

    def test_tampered_download_returns_safe_integrity_error(self):
        original_dir = file_service.UPLOAD_DIR
        owner = SimpleNamespace(id=7, name="Owner", email="owner@example.com")
        with tempfile.TemporaryDirectory() as temp_dir:
            try:
                file_service.UPLOAD_DIR = Path(temp_dir)
                encrypted = encrypt_file_data(b"tamper me")
                path = Path(temp_dir) / "stored.bin"
                tampered = bytearray(encrypted.ciphertext)
                tampered[-1] ^= 1
                path.write_bytes(tampered)
                item = SimpleNamespace(id=12, owner_id=owner.id, file_path=str(path), original_filename="report.bin", file_type="application/octet-stream", encryption=self._metadata(encrypted))
                db = SimpleNamespace(get=lambda model, file_id: item)

                with self.assertRaises(Exception) as error:
                    download_file(12, owner, db)
            finally:
                file_service.UPLOAD_DIR = original_dir

        self.assertEqual(getattr(error.exception, "status_code", None), 422)
        self.assertEqual(getattr(error.exception, "detail", None), "File integrity check failed. The file may have been modified or corrupted.")

    def test_unauthorized_download_is_rejected_before_decryption(self):
        item = SimpleNamespace(id=12, owner_id=7, file_path="does-not-matter", encryption=SimpleNamespace())

        class Query:
            def filter(self, *args):
                return self
            def first(self):
                return None

        db = SimpleNamespace(get=lambda model, file_id: item, query=lambda model: Query())
        with self.assertRaises(Exception) as error:
            download_file(12, SimpleNamespace(id=8), db)

        self.assertEqual(getattr(error.exception, "status_code", None), 403)

    def test_encryption_metadata_is_not_in_file_response(self):
        response = to_response(SimpleNamespace(
            id=1,
            owner_id=2,
            original_filename="report.pdf",
            file_size=10,
            file_type="application/pdf",
            category="PDFs",
            version=1,
            folder_id=None,
            folder=None,
            created_at=None,
            updated_at=None,
            encryption=SimpleNamespace(wrapped_key="secret"),
        ))

        self.assertNotIn("encryption", response)
        self.assertNotIn("wrapped_key", response)

    @staticmethod
    def _metadata(encrypted):
        return type("Metadata", (), {
            "algorithm": encrypted.algorithm,
            "wrapped_key": encrypted.wrapped_key.hex(),
            "key_nonce": encrypted.key_nonce.hex(),
            "file_nonce": encrypted.file_nonce.hex(),
        })()


if __name__ == "__main__":
    unittest.main()