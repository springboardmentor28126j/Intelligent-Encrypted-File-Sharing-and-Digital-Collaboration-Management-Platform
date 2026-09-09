import logging
from dataclasses import dataclass
from pathlib import Path
from uuid import uuid4

from ..config import settings

logger = logging.getLogger(__name__)


class StorageError(RuntimeError):
    pass


class StorageConfigurationError(StorageError):
    pass


class StorageObjectNotFoundError(StorageError):
    pass


@dataclass(frozen=True)
class StoredObject:
    backend: str
    key: str
    local_path: str | None = None


class LocalStorageService:
    backend = "local"

    def __init__(self, upload_dir: Path):
        self.upload_dir = upload_dir
        self.upload_dir.mkdir(exist_ok=True)

    def put_encrypted(self, content: bytes, filename: str) -> StoredObject:
        key = f"{uuid4().hex}_{Path(filename).name}"
        path = self.upload_dir / key
        try:
            path.write_bytes(content)
        except OSError as error:
            raise StorageError("Local encrypted file could not be stored") from error
        return StoredObject(self.backend, key, str(path))

    def get_encrypted(self, key: str) -> bytes:
        path = self.upload_dir / Path(key).name
        try:
            return path.read_bytes()
        except FileNotFoundError as error:
            raise StorageObjectNotFoundError("Stored file was not found") from error
        except OSError as error:
            raise StorageError("Local encrypted file could not be read") from error

    def delete(self, key: str) -> None:
        try:
            (self.upload_dir / Path(key).name).unlink(missing_ok=True)
        except OSError as error:
            raise StorageError("Local encrypted file could not be removed") from error


class S3StorageService:
    backend = "s3"

    def __init__(self):
        if not settings.aws_s3_bucket or not settings.aws_region:
            raise StorageConfigurationError("AWS S3 storage is not configured")
        try:
            import boto3
            from botocore.exceptions import BotoCoreError, ClientError
        except ImportError as error:
            raise StorageConfigurationError("AWS S3 support is not installed") from error

        self._boto_errors = (BotoCoreError, ClientError)
        client_kwargs = {"region_name": settings.aws_region}
        if settings.aws_access_key_id and settings.aws_secret_access_key:
            client_kwargs.update({
                "aws_access_key_id": settings.aws_access_key_id,
                "aws_secret_access_key": settings.aws_secret_access_key,
            })
        if settings.aws_endpoint_url:
            client_kwargs["endpoint_url"] = settings.aws_endpoint_url
        self.client = boto3.client("s3", **client_kwargs)
        self.bucket = settings.aws_s3_bucket
        self.prefix = settings.aws_s3_prefix.strip("/")

    def _object_key(self) -> str:
        random_key = f"{uuid4().hex}.enc"
        return f"{self.prefix}/{random_key}" if self.prefix else random_key

    def put_encrypted(self, content: bytes, filename: str) -> StoredObject:
        key = self._object_key()
        try:
            self.client.put_object(
                Bucket=self.bucket,
                Key=key,
                Body=content,
                ContentType="application/octet-stream",
                ServerSideEncryption="AES256",
            )
        except self._boto_errors as error:
            logger.error("S3 encrypted object upload failed")
            raise StorageError("Cloud storage upload failed") from error
        return StoredObject(self.backend, key)

    def get_encrypted(self, key: str) -> bytes:
        try:
            response = self.client.get_object(Bucket=self.bucket, Key=key)
            return response["Body"].read()
        except self._boto_errors as error:
            error_code = getattr(error, "response", {}).get("Error", {}).get("Code")
            if error_code in {"NoSuchKey", "404", "NotFound"}:
                raise StorageObjectNotFoundError("Stored file was not found") from error
            logger.error("S3 encrypted object download failed")
            raise StorageError("Cloud storage download failed") from error

    def delete(self, key: str) -> None:
        try:
            self.client.delete_object(Bucket=self.bucket, Key=key)
        except self._boto_errors as error:
            logger.error("S3 encrypted object deletion failed")
            raise StorageError("Cloud storage deletion failed") from error


def get_storage_service(backend: str | None = None, upload_dir: Path | None = None):
    selected = (backend or settings.storage_backend).strip().lower()
    if selected == "local":
        if upload_dir is None:
            upload_dir = Path(__file__).resolve().parents[2] / "uploads"
        return LocalStorageService(upload_dir)
    if selected == "s3":
        return S3StorageService()
    raise StorageConfigurationError("Unsupported storage backend")
