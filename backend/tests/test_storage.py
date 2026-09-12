"""
test_storage.py – Storage abstraction tests (LocalStorageBackend & S3 Storage interface).
"""

import os
from unittest.mock import MagicMock, patch
import pytest
from app.services.storage_service import LocalStorageBackend, S3StorageBackend, get_storage_backend


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


def test_s3_storage_backend_mock():
    """Test S3StorageBackend calls boto3 put_object, get_object, and delete_object."""
    with patch("boto3.client") as mock_boto:
        mock_s3 = MagicMock()
        mock_boto.return_value = mock_s3
        
        mock_s3.get_object.return_value = {
            "Body": MagicMock(read=lambda: b"S3_CIPHERTEXT_BYTES")
        }
        
        s3_backend = S3StorageBackend(
            bucket_name="test-bucket",
            aws_access_key_id="test-key",
            aws_secret_access_key="test-secret",
            region_name="us-east-1",
        )
        
        # Save
        s3_backend.save_file("key.enc", b"CIPHERTEXT")
        mock_s3.put_object.assert_called_once_with(
            Bucket="test-bucket",
            Key="key.enc",
            Body=b"CIPHERTEXT",
            ContentType="application/octet-stream",
            ServerSideEncryption="AES256",
        )
        
        # Get
        retrieved = s3_backend.get_file("key.enc")
        assert retrieved == b"S3_CIPHERTEXT_BYTES"
        
        # Delete
        deleted = s3_backend.delete_file("key.enc")
        assert deleted is True
        mock_s3.delete_object.assert_called_once_with(
            Bucket="test-bucket",
            Key="key.enc",
        )
