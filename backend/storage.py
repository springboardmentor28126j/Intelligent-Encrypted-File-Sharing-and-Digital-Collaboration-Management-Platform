import os

from abc import ABC, abstractmethod


# =========================================================
# STORAGE BACKEND INTERFACE
# =========================================================

class StorageBackend(ABC):

    @abstractmethod
    def save(self, key: str, data: bytes) -> str:
        """Write data under the given key."""
        raise NotImplementedError

    @abstractmethod
    def load(self, location: str) -> bytes:
        """Read and return the stored bytes."""
        raise NotImplementedError

    @abstractmethod
    def delete(self, location: str) -> None:
        """Delete the stored object."""
        raise NotImplementedError


# =========================================================
# LOCAL DISK BACKEND
# =========================================================

class LocalDiskBackend(StorageBackend):

    def __init__(self, base_dir: str = "uploads"):

        self.base_dir = base_dir

        # Create uploads folder if it does not already exist
        os.makedirs(self.base_dir, exist_ok=True)

    def save(self, key: str, data: bytes) -> str:

        # Store the file inside the uploads folder
        path = os.path.join(self.base_dir, key)

        with open(path, "wb") as f:
            f.write(data)

        # IMPORTANT:
        # Return only the filename/key.
        # This keeps the database independent of the current
        # working directory.
        return key

    def load(self, location: str) -> bytes:

        # If database contains only the filename,
        # automatically look inside uploads/.
        if not os.path.isabs(location):
            location = os.path.join(self.base_dir, location)

        with open(location, "rb") as f:
            return f.read()

    def delete(self, location: str) -> None:

        # If database contains only the filename,
        # automatically look inside uploads/.
        if not os.path.isabs(location):
            location = os.path.join(self.base_dir, location)

        if os.path.exists(location):
            os.remove(location)


# =========================================================
# S3 BACKEND
# =========================================================
#
# Optional cloud storage.
#
# To use S3:
#
# 1. pip install boto3
# 2. Set STORAGE_BACKEND=s3
# 3. Set S3_BUCKET_NAME=your-bucket-name
# 4. Configure AWS credentials
#
# Encryption happens BEFORE save(), so S3 receives
# encrypted/ciphertext data only.
# =========================================================

class S3Backend(StorageBackend):

    def __init__(self, bucket_name: str):

        import boto3

        self.bucket_name = bucket_name

        self.client = boto3.client("s3")

    def save(self, key: str, data: bytes) -> str:

        self.client.put_object(
            Bucket=self.bucket_name,
            Key=key,
            Body=data
        )

        return key

    def load(self, location: str) -> bytes:

        response = self.client.get_object(
            Bucket=self.bucket_name,
            Key=location
        )

        return response["Body"].read()

    def delete(self, location: str) -> None:

        self.client.delete_object(
            Bucket=self.bucket_name,
            Key=location
        )


# =========================================================
# STORAGE BACKEND SELECTION
# =========================================================

def get_storage_backend() -> StorageBackend:

    backend_name = os.environ.get(
        "STORAGE_BACKEND",
        "local"
    ).lower()

    # ---------------------------------------------
    # S3 STORAGE
    # ---------------------------------------------

    if backend_name == "s3":

        bucket = os.environ.get("S3_BUCKET_NAME")

        if not bucket:
            raise RuntimeError(
                "S3_BUCKET_NAME must be set when "
                "STORAGE_BACKEND=s3"
            )

        return S3Backend(bucket)

    # ---------------------------------------------
    # LOCAL STORAGE
    # ---------------------------------------------

    return LocalDiskBackend()


# =========================================================
# CREATE ACTIVE STORAGE BACKEND
# =========================================================

storage = get_storage_backend()