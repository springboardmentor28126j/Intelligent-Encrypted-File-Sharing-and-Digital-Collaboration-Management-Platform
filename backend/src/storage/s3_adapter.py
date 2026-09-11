import os
import aiofiles
from typing import AsyncGenerator
from src.storage.base import StorageAdapter
from src.core.config import settings

class LocalFileStorageAdapter(StorageAdapter):
    def __init__(self, base_dir: str = settings.LOCAL_STORAGE_DIR):
        self.base_dir = base_dir
        os.makedirs(self.base_dir, exist_ok=True)

    def _get_path(self, key: str) -> str:
        safe_key = key.replace("..", "").lstrip("/")
        full_path = os.path.join(self.base_dir, safe_key)
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        return full_path

    async def upload_stream(self, key: str, stream: AsyncGenerator[bytes, None]) -> str:
        path = self._get_path(key)
        async with aiofiles.open(path, "wb") as f:
            async for chunk in stream:
                await f.write(chunk)
        return key

    async def download_stream(self, key: str, chunk_size: int = 65536) -> AsyncGenerator[bytes, None]:
        path = self._get_path(key)
        if not os.path.exists(path):
            raise FileNotFoundError(f"Storage object {key} not found")
        async with aiofiles.open(path, "rb") as f:
            while True:
                chunk = await f.read(chunk_size)
                if not chunk:
                    break
                yield chunk

    async def delete(self, key: str) -> bool:
        path = self._get_path(key)
        if os.path.exists(path):
            os.remove(path)
            return True
        return False

    async def exists(self, key: str) -> bool:
        path = self._get_path(key)
        return os.path.exists(path)

class S3StorageAdapter(StorageAdapter):
    def __init__(self):
        import boto3
        from botocore.config import Config
        
        self.bucket = settings.S3_BUCKET_NAME
        self.s3 = boto3.client(
            "s3",
            endpoint_url=settings.S3_ENDPOINT_URL,
            aws_access_key_id=settings.S3_ACCESS_KEY,
            aws_secret_access_key=settings.S3_SECRET_KEY,
            region_name=settings.S3_REGION,
            config=Config(signature_version="s3v4")
        )
        self._ensure_bucket()

    def _ensure_bucket(self):
        try:
            self.s3.head_bucket(Bucket=self.bucket)
        except Exception:
            try:
                self.s3.create_bucket(Bucket=self.bucket)
            except Exception:
                pass

    async def upload_stream(self, key: str, stream: AsyncGenerator[bytes, None]) -> str:
        # Buffer or stream to S3
        data = bytearray()
        async for chunk in stream:
            data.extend(chunk)
        self.s3.put_object(Bucket=self.bucket, Key=key, Body=bytes(data))
        return key

    async def download_stream(self, key: str, chunk_size: int = 65536) -> AsyncGenerator[bytes, None]:
        try:
            response = self.s3.get_object(Bucket=self.bucket, Key=key)
            body = response["Body"]
            while True:
                chunk = body.read(chunk_size)
                if not chunk:
                    break
                yield chunk
        except Exception as e:
            raise FileNotFoundError(f"S3 Object {key} not found: {str(e)}")

    async def delete(self, key: str) -> bool:
        try:
            self.s3.delete_object(Bucket=self.bucket, Key=key)
            return True
        except Exception:
            return False

    async def exists(self, key: str) -> bool:
        try:
            self.s3.head_object(Bucket=self.bucket, Key=key)
            return True
        except Exception:
            return False

def get_storage_adapter() -> StorageAdapter:
    if settings.STORAGE_TYPE == "local":
        return LocalFileStorageAdapter()
    try:
        return S3StorageAdapter()
    except Exception:
        # Fallback to local storage if S3/MinIO is unreachable during standalone tests
        return LocalFileStorageAdapter()
