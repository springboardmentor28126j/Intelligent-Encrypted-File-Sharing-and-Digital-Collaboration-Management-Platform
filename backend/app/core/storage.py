"""
File storage abstraction with two backends:

  - "local": writes encrypted bytes to disk inside the container (default,
    zero setup).
  - "s3": writes to an S3-compatible object store. Works with real AWS S3,
    or any S3-compatible provider (Backblaze B2, Cloudflare R2, etc.) by
    setting S3_ENDPOINT_URL to that provider's endpoint instead of leaving
    it blank.

Callers never touch S3 or the filesystem directly — they call save_file,
read_file, and delete_file, and get back an opaque "storage reference"
string to keep in the database. What that reference actually means (a
local path vs. an S3 object key) is this module's business alone.

If STORAGE_BACKEND=s3 but the required S3 settings aren't filled in, this
falls back to local storage rather than crashing the app on startup.
"""

import os

from app.core.config import settings


def _s3_is_configured() -> bool:
    return bool(
        settings.STORAGE_BACKEND == "s3"
        and settings.AWS_ACCESS_KEY_ID
        and settings.AWS_SECRET_ACCESS_KEY
        and settings.S3_BUCKET_NAME
    )


_s3_client_instance = None


def _s3_client():
    global _s3_client_instance
    if _s3_client_instance is None:
        import boto3
        kwargs = {
            "aws_access_key_id": settings.AWS_ACCESS_KEY_ID,
            "aws_secret_access_key": settings.AWS_SECRET_ACCESS_KEY,
            "region_name": settings.AWS_REGION,
        }
        if settings.S3_ENDPOINT_URL:
            kwargs["endpoint_url"] = settings.S3_ENDPOINT_URL
        _s3_client_instance = boto3.client("s3", **kwargs)
    return _s3_client_instance


def storage_backend_in_use() -> str:
    return "s3" if _s3_is_configured() else "local"


def save_file(key: str, data: bytes) -> str:
    """Stores encrypted bytes under `key`. Returns a storage reference to
    pass to read_file/delete_file later (a local path, or the same `key`
    for S3)."""
    if _s3_is_configured():
        _s3_client().put_object(Bucket=settings.S3_BUCKET_NAME, Key=key, Body=data)
        return key

    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    path = os.path.join(settings.UPLOAD_DIR, key)
    with open(path, "wb") as f:
        f.write(data)
    return path


def read_file(reference: str) -> bytes:
    if _s3_is_configured():
        obj = _s3_client().get_object(Bucket=settings.S3_BUCKET_NAME, Key=reference)
        return obj["Body"].read()

    with open(reference, "rb") as f:
        return f.read()


def delete_file(reference: str) -> None:
    if _s3_is_configured():
        _s3_client().delete_object(Bucket=settings.S3_BUCKET_NAME, Key=reference)
        return

    if os.path.exists(reference):
        os.remove(reference)
