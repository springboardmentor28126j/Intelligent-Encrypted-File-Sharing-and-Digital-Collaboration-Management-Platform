import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
BUCKET_NAME = "trustshare-files"

supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)


def upload_to_storage(stored_name: str, file_bytes: bytes):
    """Upload encrypted bytes to the shared Supabase Storage bucket."""
    supabase_client.storage.from_(BUCKET_NAME).upload(
        path=stored_name,
        file=file_bytes,
        file_options={"content-type": "application/octet-stream"}
    )


def download_from_storage(stored_name: str) -> bytes:
    """Download encrypted bytes from Supabase Storage."""
    return supabase_client.storage.from_(BUCKET_NAME).download(stored_name)


def delete_from_storage(stored_name: str):
    """Remove a file from Supabase Storage (called when a file record is deleted)."""
    supabase_client.storage.from_(BUCKET_NAME).remove([stored_name])