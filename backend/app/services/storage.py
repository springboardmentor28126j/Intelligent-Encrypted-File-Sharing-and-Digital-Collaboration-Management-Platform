from pathlib import Path

import boto3
from botocore.exceptions import BotoCoreError, ClientError

from app.core.config import settings


def _s3():
    if not settings.AWS_S3_BUCKET or not settings.AWS_REGION:
        raise ValueError("AWS_S3_BUCKET and AWS_REGION are required for S3 storage")
    return boto3.client("s3", region_name=settings.AWS_REGION,
                        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY)


def put_encrypted(data: bytes, storage_key: str) -> str:
    if settings.STORAGE_BACKEND.lower() == "s3":
        _s3().put_object(Bucket=settings.AWS_S3_BUCKET, Key=storage_key, Body=data,
                         ServerSideEncryption="AES256")
        return storage_key
    path = Path(settings.STORAGE_DIR) / storage_key
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return str(path)


def get_encrypted(storage_key: str) -> bytes:
    if settings.STORAGE_BACKEND.lower() == "s3":
        obj = _s3().get_object(Bucket=settings.AWS_S3_BUCKET, Key=storage_key)
        return obj["Body"].read()
    return Path(storage_key).read_bytes()


def delete_encrypted(storage_key: str) -> None:
    if settings.STORAGE_BACKEND.lower() == "s3":
        _s3().delete_object(Bucket=settings.AWS_S3_BUCKET, Key=storage_key)
        return
    path = Path(storage_key)
    if path.exists():
        path.unlink()
