import os
import sys

from dotenv import load_dotenv

load_dotenv()


def main():
    bucket = os.environ.get("S3_BUCKET_NAME")
    region = os.environ.get("AWS_REGION")

    if not bucket or not region:
        print("ERROR: S3_BUCKET_NAME and AWS_REGION must both be set in .env")
        sys.exit(1)

    try:
        import boto3
        from botocore.exceptions import ClientError, NoCredentialsError
    except ImportError:
        print("ERROR: boto3 is not installed. Run: pip install boto3")
        sys.exit(1)

    print(f"Testing connection to bucket '{bucket}' in region '{region}'...")
    print()

    client = boto3.client("s3", region_name=region)

    test_key = "trustshare_connectivity_test.txt"
    test_content = b"If you can read this, your S3 setup is working correctly."

    # ---- Upload ----
    try:
        client.put_object(Bucket=bucket, Key=test_key, Body=test_content)
        print("PASS: Upload succeeded")
    except NoCredentialsError:
        print("FAIL: No AWS credentials found.")
        print("      Check that AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are set in .env")
        sys.exit(1)
    except ClientError as error:
        code = error.response.get("Error", {}).get("Code")
        if code == "NoSuchBucket":
            print(f"FAIL: Bucket '{bucket}' does not exist (check S3_BUCKET_NAME and AWS_REGION).")
        elif code == "AccessDenied":
            print("FAIL: Access denied. Check your IAM policy allows s3:PutObject on this bucket.")
        else:
            print(f"FAIL: Upload failed with error: {error}")
        sys.exit(1)

    # ---- Download ----
    try:
        response = client.get_object(Bucket=bucket, Key=test_key)
        downloaded = response["Body"].read()
        if downloaded == test_content:
            print("PASS: Download succeeded and content matches exactly")
        else:
            print("FAIL: Downloaded content does not match what was uploaded")
            sys.exit(1)
    except ClientError as error:
        print(f"FAIL: Download failed with error: {error}")
        sys.exit(1)

    # ---- Delete (cleanup) ----
    try:
        client.delete_object(Bucket=bucket, Key=test_key)
        print("PASS: Delete succeeded")
    except ClientError as error:
        print(f"FAIL: Delete failed with error: {error}")
        sys.exit(1)

    print()
    print("ALL CHECKS PASSED. Your S3 bucket and credentials are correctly configured.")
    print("You can now set STORAGE_BACKEND=s3 in your .env and restart the backend.")


if __name__ == "__main__":
    main()