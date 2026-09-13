import boto3
from botocore.client import Config
from decouple import config


B2_KEY_ID = config("B2_KEY_ID")
B2_APPLICATION_KEY = config("B2_APPLICATION_KEY")
B2_BUCKET_NAME = config("B2_BUCKET_NAME")
B2_ENDPOINT_URL = config("B2_ENDPOINT_URL")


s3_client = boto3.client(
    "s3",
    endpoint_url=B2_ENDPOINT_URL,
    aws_access_key_id=B2_KEY_ID,
    aws_secret_access_key=B2_APPLICATION_KEY,
    config=Config(signature_version="s3v4"),
)


def upload_to_b2(data: bytes, storage_key: str, content_type: str):
    s3_client.put_object(
        Bucket=B2_BUCKET_NAME,
        Key=storage_key,
        Body=data,
        ContentType=content_type,
    )


def download_from_b2(storage_key: str) -> bytes:
    response = s3_client.get_object(
        Bucket=B2_BUCKET_NAME,
        Key=storage_key,
    )

    return response["Body"].read()


def delete_from_b2(storage_key: str):
    s3_client.delete_object(
        Bucket=B2_BUCKET_NAME,
        Key=storage_key,
    )