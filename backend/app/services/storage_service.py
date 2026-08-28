"""
Storage backend abstraction. Only ever stores/reads ENCRYPTED bytes -
plaintext never touches disk or S3.
"""
import os
from pathlib import Path

from app.core.config import settings


class LocalStorage:
    def __init__(self, base_dir: str):
        self.base_dir = Path(base_dir)
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def save(self, object_key: str, data: bytes) -> str:
        path = self.base_dir / object_key
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        return str(path)

    def load(self, object_key: str) -> bytes:
        path = self.base_dir / object_key
        return path.read_bytes()

    def delete(self, object_key: str) -> None:
        path = self.base_dir / object_key
        if path.exists():
            path.unlink()


class S3Storage:
    def __init__(self):
        import boto3
        self.client = boto3.client(
            "s3",
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=settings.AWS_REGION,
        )
        self.bucket = settings.S3_BUCKET_NAME

    def save(self, object_key: str, data: bytes) -> str:
        self.client.put_object(Bucket=self.bucket, Key=object_key, Body=data)
        return f"s3://{self.bucket}/{object_key}"

    def load(self, object_key: str) -> bytes:
        obj = self.client.get_object(Bucket=self.bucket, Key=object_key)
        return obj["Body"].read()

    def delete(self, object_key: str) -> None:
        self.client.delete_object(Bucket=self.bucket, Key=object_key)


def get_storage_backend():
    if settings.STORAGE_BACKEND == "s3":
        return S3Storage()
    return LocalStorage(settings.LOCAL_STORAGE_DIR)
