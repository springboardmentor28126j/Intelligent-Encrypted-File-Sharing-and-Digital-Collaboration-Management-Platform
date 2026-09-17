import os

from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
SUPABASE_BUCKET = os.getenv(
    "SUPABASE_BUCKET",
    "encrypted-files"
)

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    raise RuntimeError(
        "Supabase credentials are not configured"
    )

supabase: Client = create_client(
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY
)


def upload_encrypted_file(
    storage_path: str,
    encrypted_data: bytes
):
    return supabase.storage.from_(
        SUPABASE_BUCKET
    ).upload(
        storage_path,
        encrypted_data,
        {
            "content-type": "application/octet-stream",
            "upsert": False
        }
    )


def download_encrypted_file(
    storage_path: str
):
    return supabase.storage.from_(
        SUPABASE_BUCKET
    ).download(storage_path)


def delete_encrypted_file(
    storage_path: str
):
    return supabase.storage.from_(
        SUPABASE_BUCKET
    ).remove([storage_path])