import os

import boto3
from botocore.exceptions import ClientError, BotoCoreError
from dotenv import load_dotenv

load_dotenv()

AWS_REGION = os.getenv("AWS_REGION", "ap-south-1")
AWS_BUCKET_NAME = os.getenv(
    "AWS_BUCKET_NAME",
    "trustshare-sreeteja-2026"
)


def get_s3_client():
    access_key = os.getenv("AWS_ACCESS_KEY_ID")
    secret_key = os.getenv("AWS_SECRET_ACCESS_KEY")

    if not access_key or not secret_key:
        return None

    return boto3.client(
        "s3",
        region_name=AWS_REGION,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key
    )


def is_s3_configured():
    return bool(
        os.getenv("AWS_ACCESS_KEY_ID")
        and os.getenv("AWS_SECRET_ACCESS_KEY")
    )


def upload_encrypted_file(
    local_file_path: str,
    s3_key: str
):
    s3 = get_s3_client()

    if s3 is None:
        raise RuntimeError(
            "AWS credentials are not configured."
        )

    s3.upload_file(
        local_file_path,
        AWS_BUCKET_NAME,
        s3_key,
        ExtraArgs={
            "ContentType": "application/octet-stream"
        }
    )

    return {
        "bucket": AWS_BUCKET_NAME,
        "key": s3_key
    }


def download_encrypted_file(
    s3_key: str,
    local_file_path: str
):
    s3 = get_s3_client()

    if s3 is None:
        raise RuntimeError(
            "AWS credentials are not configured."
        )

    s3.download_file(
        AWS_BUCKET_NAME,
        s3_key,
        local_file_path
    )

    return local_file_path


def delete_encrypted_file(
    s3_key: str
):
    s3 = get_s3_client()

    if s3 is None:
        raise RuntimeError(
            "AWS credentials are not configured."
        )

    s3.delete_object(
        Bucket=AWS_BUCKET_NAME,
        Key=s3_key
    )

    return True


def check_bucket():
    s3 = get_s3_client()

    if s3 is None:
        return {
            "connected": False,
            "error": "AWS credentials are not configured."
        }

    try:
        s3.head_bucket(
            Bucket=AWS_BUCKET_NAME
        )

        return {
            "connected": True,
            "bucket": AWS_BUCKET_NAME,
            "region": AWS_REGION
        }

    except (ClientError, BotoCoreError) as e:
        return {
            "connected": False,
            "error": str(e)
        }