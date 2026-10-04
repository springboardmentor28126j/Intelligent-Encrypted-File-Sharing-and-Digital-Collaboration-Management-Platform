"""
test_supabase_storage.py – Test suite for Supabase Cloud Object Storage Backend with mocked HTTP client.
"""

from unittest.mock import MagicMock, patch
import pytest
from app.services.storage_service import SupabaseStorageBackend


def test_supabase_save_and_get():
    """Verify Supabase backend save_file, get_file, file_exists, and delete_file workflow."""
    with patch("urllib.request.urlopen") as mock_urlopen:
        mock_resp = MagicMock()
        mock_resp.status = 200
        mock_resp.read.return_value = b"encrypted_supabase_ciphertext_bytes"
        mock_urlopen.return_value.__enter__.return_value = mock_resp

        backend = SupabaseStorageBackend(
            supabase_url="https://tcrrbiozamvwminkrhbi.supabase.co",
            service_role_key="test_service_key",
            bucket_name="trustshare-files",
        )

        assert backend.backend_name == "supabase"
        assert backend.bucket_name == "trustshare-files"

        # 1. Save
        key = backend.save_file("vault/enc_file.bin", b"encrypted_supabase_ciphertext_bytes")
        assert key == "vault/enc_file.bin"

        # 2. Exists
        assert backend.file_exists("vault/enc_file.bin") is True

        # 3. Get
        data = backend.get_file("vault/enc_file.bin")
        assert data == b"encrypted_supabase_ciphertext_bytes"

        # 4. Signed URL (5 minutes)
        mock_sign_resp = MagicMock()
        mock_sign_resp.status = 200
        mock_sign_resp.read.return_value = b'{"signedURL":"https://tcrrbiozamvwminkrhbi.supabase.co/storage/v1/object/sign/trustshare-files/vault/enc_file.bin?token=sig123"}'
        mock_urlopen.return_value.__enter__.return_value = mock_sign_resp

        signed_url = backend.generate_signed_url("vault/enc_file.bin", expires_in=300)
        assert signed_url is not None
        assert "sig123" in signed_url

        # 5. Delete
        assert backend.delete_file("vault/enc_file.bin") is True
