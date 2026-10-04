"""
test_storage.py – Storage abstraction tests (LocalStorageBackend & Supabase Storage interface).
"""

import os
from unittest.mock import MagicMock, patch
import pytest
from app.services.storage_service import LocalStorageBackend, SupabaseStorageBackend, get_storage_backend


def test_local_storage_backend(tmp_path):
    """Test LocalStorageBackend save, get, exists, and delete operations."""
    backend = LocalStorageBackend(base_dir=str(tmp_path))
    
    file_key = "test_encrypted.enc"
    data = b"ENCRYPTED_CIPHERTEXT_BLOB_12345"
    
    saved_key = backend.save_file(file_key, data)
    assert saved_key == file_key
    assert backend.file_exists(file_key) is True
    
    retrieved = backend.get_file(file_key)
    assert retrieved == data
    
    deleted = backend.delete_file(file_key)
    assert deleted is True
    assert backend.file_exists(file_key) is False


def test_supabase_storage_backend_mock():
    """Test SupabaseStorageBackend save, get, delete, and signed URL generation with mocked HTTP."""
    with patch("urllib.request.urlopen") as mock_urlopen:
        # Mock bucket check
        mock_resp_bucket = MagicMock()
        mock_resp_bucket.status = 200
        mock_urlopen.return_value.__enter__.return_value = mock_resp_bucket

        backend = SupabaseStorageBackend(
            supabase_url="https://xyzcompany.supabase.co",
            service_role_key="test-service-key",
            bucket_name="trustshare-files",
        )
        assert backend.backend_name == "supabase"

        # 1. Save
        mock_resp_save = MagicMock()
        mock_resp_save.status = 200
        mock_urlopen.return_value.__enter__.return_value = mock_resp_save

        saved_key = backend.save_file("vault/enc_doc.enc", b"CIPHERTEXT_BYTES")
        assert saved_key == "vault/enc_doc.enc"

        # 2. Get
        mock_resp_get = MagicMock()
        mock_resp_get.read.return_value = b"CIPHERTEXT_BYTES"
        mock_urlopen.return_value.__enter__.return_value = mock_resp_get

        data = backend.get_file("vault/enc_doc.enc")
        assert data == b"CIPHERTEXT_BYTES"

        # 3. Signed URL (5 minutes / 300s)
        mock_resp_sign = MagicMock()
        mock_resp_sign.read.return_value = b'{"signedURL":"/storage/v1/object/sign/trustshare-files/vault/enc_doc.enc?token=abc123xyz"}'
        mock_urlopen.return_value.__enter__.return_value = mock_resp_sign

        signed_url = backend.generate_signed_url("vault/enc_doc.enc", expires_in=300)
        assert signed_url is not None
        assert "token=abc123xyz" in signed_url

        # 4. Delete
        mock_resp_del = MagicMock()
        mock_resp_del.status = 200
        mock_urlopen.return_value.__enter__.return_value = mock_resp_del

        deleted = backend.delete_file("vault/enc_doc.enc")
        assert deleted is True
