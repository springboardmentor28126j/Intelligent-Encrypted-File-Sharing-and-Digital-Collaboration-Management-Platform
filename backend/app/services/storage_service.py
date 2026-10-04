"""
storage_service.py – Supabase Cloud Storage & Secure Local Vault Engine for Encrypted Files.

Implements:
  - Abstract StorageBackend interface.
  - SupabaseStorageBackend: High-performance Supabase Object Storage integration
    with private bucket management, signed download URLs (5-minute expiry),
    object deletion, listing, and streaming.
  - LocalStorageBackend: Secure local encrypted vault fallback.
  - Factory function `get_storage_backend()` for runtime dependency injection.
"""

from abc import ABC, abstractmethod
import json
import logging
import os
from pathlib import Path
from typing import Any, Dict, List, Optional
import urllib.error
import urllib.request

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

    @abstractmethod
    def generate_signed_url(self, file_key: str, expires_in: int = 300) -> Optional[str]:
        """
        Generate temporary secure signed URL for downloading/accessing object (default: 5 minutes / 300 seconds).
        """
        pass

    def generate_presigned_url(self, file_key: str, expires_in: int = 300) -> Optional[str]:
        """Alias for compatibility across modules."""
        return self.generate_signed_url(file_key, expires_in)

    def list_files(self, prefix: str = "", limit: int = 100) -> List[Dict[str, Any]]:
        """List objects stored in the bucket."""
        return []

    @property
    @abstractmethod
    def backend_name(self) -> str:
        """Return human-readable name of backend ('supabase' or 'local')."""
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

    def generate_signed_url(self, file_key: str, expires_in: int = 300) -> Optional[str]:
        return None

    def list_files(self, prefix: str = "", limit: int = 100) -> List[Dict[str, Any]]:
        results = []
        try:
            for p in self.storage_dir.iterdir():
                if p.is_file():
                    results.append({"name": p.name, "size": p.stat().st_size})
        except Exception:
            pass
        return results[:limit]


class SupabaseStorageBackend(StorageBackend):
    """
    Supabase Cloud Object Storage Backend.
    Uploads and manages AES-256-GCM encrypted ciphertext in a private Supabase Storage bucket.
    Generates 5-minute signed URLs and handles authentication via Service Role / API Keys.
    """

    def __init__(
        self,
        supabase_url: Optional[str] = None,
        service_role_key: Optional[str] = None,
        bucket_name: Optional[str] = None,
    ):
        self.supabase_url = (supabase_url or settings.SUPABASE_URL).rstrip("/")
        self.api_key = service_role_key or settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_ANON_KEY
        self.bucket_name = bucket_name or settings.SUPABASE_STORAGE_BUCKET or "trustshare-files"
        self._ensure_bucket()

    @property
    def backend_name(self) -> str:
        return "supabase"

    def _headers(self, extra: Optional[Dict[str, str]] = None) -> Dict[str, str]:
        hdrs = {
            "Authorization": f"Bearer {self.api_key}",
            "apikey": self.api_key,
        }
        if extra:
            hdrs.update(extra)
        return hdrs

    def _ensure_bucket(self):
        """Create private storage bucket if not already present."""
        if not self.supabase_url or not self.api_key:
            return

        check_url = f"{self.supabase_url}/storage/v1/bucket/{self.bucket_name}"
        try:
            req = urllib.request.Request(check_url, headers=self._headers(), method="GET")
            with urllib.request.urlopen(req, timeout=5) as resp:
                if resp.status == 200:
                    logger.info(f"[SupabaseStorage] Verified private bucket '{self.bucket_name}'.")
                    return
        except urllib.error.HTTPError as exc:
            if exc.code == 404:
                # Create private bucket
                create_url = f"{self.supabase_url}/storage/v1/bucket"
                payload = json.dumps({"id": self.bucket_name, "name": self.bucket_name, "public": False}).encode()
                try:
                    create_req = urllib.request.Request(
                        create_url,
                        data=payload,
                        headers=self._headers({"Content-Type": "application/json"}),
                        method="POST",
                    )
                    with urllib.request.urlopen(create_req, timeout=5) as c_resp:
                        logger.info(f"[SupabaseStorage] Created private bucket '{self.bucket_name}' (status {c_resp.status}).")
                except Exception as c_exc:
                    logger.info(f"[SupabaseStorage] Bucket initialization note: {c_exc}")
        except Exception as exc:
            logger.info(f"[SupabaseStorage] Bucket check note: {exc}")

    def save_file(self, file_key: str, data: bytes, content_type: str = "application/octet-stream") -> str:
        clean_key = file_key.lstrip("/")
        upload_url = f"{self.supabase_url}/storage/v1/object/{self.bucket_name}/{clean_key}"

        try:
            req = urllib.request.Request(
                upload_url,
                data=data,
                headers=self._headers({
                    "Content-Type": content_type,
                    "x-upsert": "true",
                }),
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=30) as resp:
                if resp.status in (200, 201):
                    logger.info(f"[SupabaseStorage] Successfully stored encrypted object: {self.bucket_name}/{clean_key}")
                    return clean_key
                else:
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail=f"Supabase Storage responded with HTTP {resp.status}",
                    )
        except urllib.error.HTTPError as exc:
            err_body = exc.read().decode("utf-8", errors="ignore")
            logger.error(f"[SupabaseStorage] Upload HTTP error {exc.code}: {err_body}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to upload file to Supabase Storage: {err_body or exc.reason}",
            )
        except Exception as exc:
            logger.error(f"[SupabaseStorage] Upload failure: {exc}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Supabase Storage upload error: {exc}",
            )

    def get_file(self, file_key: str) -> bytes:
        clean_key = file_key.lstrip("/")
        download_url = f"{self.supabase_url}/storage/v1/object/authenticated/{self.bucket_name}/{clean_key}"

        try:
            req = urllib.request.Request(
                download_url,
                headers=self._headers(),
                method="GET",
            )
            with urllib.request.urlopen(req, timeout=30) as resp:
                return resp.read()
        except urllib.error.HTTPError as exc:
            logger.error(f"[SupabaseStorage] Get object HTTP error {exc.code} for '{clean_key}'")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Encrypted object was not found in Supabase Storage.",
            )
        except Exception as exc:
            logger.error(f"[SupabaseStorage] Get object error: {exc}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to download object from Supabase Storage: {exc}",
            )

    def delete_file(self, file_key: str) -> bool:
        clean_key = file_key.lstrip("/")
        delete_url = f"{self.supabase_url}/storage/v1/object/{self.bucket_name}"
        payload = json.dumps({"prefixes": [clean_key]}).encode("utf-8")

        try:
            req = urllib.request.Request(
                delete_url,
                data=payload,
                headers=self._headers({"Content-Type": "application/json"}),
                method="DELETE",
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                logger.info(f"[SupabaseStorage] Deleted object '{clean_key}' from bucket '{self.bucket_name}'")
                return True
        except Exception as exc:
            logger.warning(f"[SupabaseStorage] Delete error for '{clean_key}': {exc}")
            return False

    def file_exists(self, file_key: str) -> bool:
        clean_key = file_key.lstrip("/")
        info_url = f"{self.supabase_url}/storage/v1/object/info/authenticated/{self.bucket_name}/{clean_key}"
        try:
            req = urllib.request.Request(info_url, headers=self._headers(), method="GET")
            with urllib.request.urlopen(req, timeout=5) as resp:
                return resp.status == 200
        except Exception:
            return False

    def generate_signed_url(self, file_key: str, expires_in: int = 300) -> Optional[str]:
        """
        Generate a 5-minute (300 seconds) signed URL for authenticated download from Supabase Storage.
        """
        clean_key = file_key.lstrip("/")
        sign_url = f"{self.supabase_url}/storage/v1/object/sign/{self.bucket_name}/{clean_key}"
        payload = json.dumps({"expiresIn": expires_in}).encode("utf-8")

        try:
            req = urllib.request.Request(
                sign_url,
                data=payload,
                headers=self._headers({"Content-Type": "application/json"}),
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                signed_rel_path = data.get("signedURL")
                if signed_rel_path:
                    # Full absolute signed URL
                    if signed_rel_path.startswith("http"):
                        return signed_rel_path
                    return f"{self.supabase_url}/storage/v1{signed_rel_path}"
                return None
        except Exception as exc:
            logger.warning(f"[SupabaseStorage] Failed to generate signed URL for '{clean_key}': {exc}")
            return None

    def list_files(self, prefix: str = "", limit: int = 100) -> List[Dict[str, Any]]:
        """List objects from Supabase Storage bucket."""
        list_url = f"{self.supabase_url}/storage/v1/object/list/{self.bucket_name}"
        payload = json.dumps({
            "prefix": prefix,
            "limit": limit,
            "offset": 0,
            "sortBy": {"column": "name", "order": "asc"},
        }).encode("utf-8")

        try:
            req = urllib.request.Request(
                list_url,
                data=payload,
                headers=self._headers({"Content-Type": "application/json"}),
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                items = json.loads(resp.read().decode("utf-8"))
                return items if isinstance(items, list) else []
        except Exception as exc:
            logger.warning(f"[SupabaseStorage] List files note: {exc}")
            return []


def get_storage_backend() -> StorageBackend:
    """
    Factory function returning the configured StorageBackend instance.
    Defaults to SupabaseStorageBackend, falling back to LocalStorageBackend if unconfigured or offline.
    """
    backend_choice = (settings.STORAGE_BACKEND or "supabase").strip().lower()

    if backend_choice == "supabase":
        if settings.SUPABASE_URL and (settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_ANON_KEY):
            try:
                return SupabaseStorageBackend()
            except Exception as exc:
                logger.warning(f"[Storage] Supabase backend init error ({exc}). Falling back to LocalStorage.")
                return LocalStorageBackend()
        else:
            logger.info("[Storage] Supabase URL/keys not configured in environment. Using LocalStorage backend.")
            return LocalStorageBackend()

    return LocalStorageBackend()


# Default singleton instance
storage_backend: StorageBackend = get_storage_backend()
