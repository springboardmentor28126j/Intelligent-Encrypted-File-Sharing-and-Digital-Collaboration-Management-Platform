"""
storage_service.py – Clean Cloud Object Storage Abstraction for Encrypted Files.

Implements:
  - Abstract StorageBackend interface.
  - S3StorageBackend: AWS S3 integration with private object permissions,
    content streaming, and custom endpoint URL support (LocalStack/MinIO/AWS).
  - LocalStorageBackend: Secure local disk fallback storing ONLY encrypted ciphertext.
  - Factory function `get_storage_backend()` for runtime dependency injection.
"""

from abc import ABC, abstractmethod
import io
import logging
import os
from pathlib import Path
from typing import Optional

from fastapi import HTTPException, status
from app.config import settings

logger = logging.getLogger("trustshare.storage")


class StorageBackend(ABC):
    """Abstract interface for object storage backends."""

    @abstractmethod
    def save_file(self, file_key: str, data: bytes, content_type: str = "application/octet-stream") -> str:
        """
        Store encrypted data bytes in object storage.
        Returns the unique storage reference key.
        """
        pass

    @abstractmethod
    def get_file(self, file_key: str) -> bytes:
        """
        Retrieve encrypted data bytes from object storage.
        """
        pass

    @abstractmethod
    def delete_file(self, file_key: str) -> bool:
        """
        Permanently delete an encrypted object from storage.
        """
        pass

    @abstractmethod
    def file_exists(self, file_key: str) -> bool:
        """
        Check if an object exists in storage.
        """
        pass

    @property
    @abstractmethod
    def backend_name(self) -> str:
        """Return human-readable name of backend ('s3' or 'local')."""
        pass


class LocalStorageBackend(StorageBackend):
    """
    Local filesystem storage backend for encrypted files.
    Stores only encrypted binary data in a dedicated secure directory.
    """

    def __init__(self, base_dir: Optional[str] = None):
        self.storage_dir = Path(base_dir or settings.UPLOAD_DIR) / "encrypted"
        self.storage_dir.mkdir(parents=True, exist_ok=True)

    @property
    def backend_name(self) -> str:
        return "local"

    def _get_path(self, file_key: str) -> Path:
        # Sanitize key to prevent path traversal
        clean_key = os.path.basename(file_key.replace("\\", "/"))
        return self.storage_dir / clean_key

    def save_file(self, file_key: str, data: bytes, content_type: str = "application/octet-stream") -> str:
        target_path = self._get_path(file_key)
        try:
            with open(target_path, "wb") as f:
                f.write(data)
            return file_key
        except Exception as exc:
            logger.error(f"LocalStorage save error: {exc}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to write encrypted file to storage: {exc}",
            )

    def get_file(self, file_key: str) -> bytes:
        target_path = self._get_path(file_key)
        if not target_path.exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Encrypted object was not found in storage.",
            )
        try:
            with open(target_path, "rb") as f:
                return f.read()
        except Exception as exc:
            logger.error(f"LocalStorage read error: {exc}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to read encrypted file from storage: {exc}",
            )

    def delete_file(self, file_key: str) -> bool:
        target_path = self._get_path(file_key)
        try:
            if target_path.exists():
                target_path.unlink()
                return True
            return False
        except Exception as exc:
            logger.warning(f"LocalStorage delete error for key '{file_key}': {exc}")
            return False

    def file_exists(self, file_key: str) -> bool:
        return self._get_path(file_key).exists()


class S3StorageBackend(StorageBackend):
    """
    AWS S3 Cloud Object Storage backend.
    Stores encrypted files in a private S3 bucket.
    """

    def __init__(
        self,
        bucket_name: Optional[str] = None,
        aws_access_key_id: Optional[str] = None,
        aws_secret_access_key: Optional[str] = None,
        region_name: Optional[str] = None,
        endpoint_url: Optional[str] = None,
    ):
        import boto3
        from botocore.config import Config

        self.bucket_name = bucket_name or settings.AWS_S3_BUCKET_NAME
        self.region_name = region_name or settings.AWS_REGION

        client_kwargs = {
            "service_name": "s3",
            "region_name": self.region_name,
            "config": Config(signature_version="s3v4", s3={"addressing_style": "virtual"}),
        }

        access_key = aws_access_key_id or settings.AWS_ACCESS_KEY_ID
        secret_key = aws_secret_access_key or settings.AWS_SECRET_ACCESS_KEY
        if access_key and secret_key:
            client_kwargs["aws_access_key_id"] = access_key
            client_kwargs["aws_secret_access_key"] = secret_key

        ep = endpoint_url or settings.AWS_S3_ENDPOINT_URL
        if ep and ep.strip():
            client_kwargs["endpoint_url"] = ep.strip()

        self.s3_client = boto3.client(**client_kwargs)
        self._ensure_bucket()

    @property
    def backend_name(self) -> str:
        return "s3"

    def _ensure_bucket(self):
        """Check if bucket exists or log a warning if inaccessible."""
        try:
            self.s3_client.head_bucket(Bucket=self.bucket_name)
        except Exception as exc:
            logger.info(f"S3 bucket '{self.bucket_name}' check result: {exc}")

    def save_file(self, file_key: str, data: bytes, content_type: str = "application/octet-stream") -> str:
        try:
            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=file_key,
                Body=data,
                ContentType=content_type,
                ServerSideEncryption="AES256",
            )
            return file_key
        except Exception as exc:
            logger.error(f"S3 put_object error: {exc}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to upload encrypted file to S3 cloud storage: {exc}",
            )

    def get_file(self, file_key: str) -> bytes:
        try:
            response = self.s3_client.get_object(
                Bucket=self.bucket_name,
                Key=file_key,
            )
            return response["Body"].read()
        except Exception as exc:
            logger.error(f"S3 get_object error for key '{file_key}': {exc}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Encrypted object not found in S3 cloud storage: {exc}",
            )

    def delete_file(self, file_key: str) -> bool:
        try:
            self.s3_client.delete_object(
                Bucket=self.bucket_name,
                Key=file_key,
            )
            return True
        except Exception as exc:
            logger.warning(f"S3 delete_object error for key '{file_key}': {exc}")
            return False

    def file_exists(self, file_key: str) -> bool:
        try:
            self.s3_client.head_object(Bucket=self.bucket_name, Key=file_key)
            return True
        except Exception:
            return False


def get_storage_backend() -> StorageBackend:
    """
    Factory function returning the configured StorageBackend instance.
    Falls back gracefully to LocalStorageBackend if S3 configuration is incomplete.
    """
    if settings.STORAGE_BACKEND.lower() == "s3":
        try:
            return S3StorageBackend()
        except Exception as exc:
            logger.warning(f"Failed to initialize S3StorageBackend ({exc}). Falling back to LocalStorageBackend.")
            return LocalStorageBackend()
    return LocalStorageBackend()


# Default singleton instance
storage_backend: StorageBackend = get_storage_backend()
