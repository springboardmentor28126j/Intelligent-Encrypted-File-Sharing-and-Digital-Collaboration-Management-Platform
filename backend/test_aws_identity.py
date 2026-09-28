import os
import boto3
from botocore.exceptions import ClientError
from dotenv import load_dotenv

load_dotenv()

region = os.getenv("AWS_REGION", "ap-south-1")
access_key = os.getenv("AWS_ACCESS_KEY_ID")
secret_key = os.getenv("AWS_SECRET_ACCESS_KEY")

print("Checking AWS credentials...")

if not access_key:
    print("AWS_ACCESS_KEY_ID is missing in .env")

elif not secret_key:
    print("AWS_SECRET_ACCESS_KEY is missing in .env")

else:
    try:
        sts = boto3.client(
            "sts",
            region_name=region,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key
        )

        result = sts.get_caller_identity()

        print("AWS CREDENTIALS ARE VALID")
        print("Account:", result["Account"])
        print("ARN:", result["Arn"])

    except ClientError as e:
        print("AWS CREDENTIALS CHECK FAILED")
        print(e)