import logging
from typing import Optional, List
from supabase import create_client, Client
from app.core.config import settings

logger = logging.getLogger("trustshare.supabase")

# Initialize Supabase Client
supabase: Client = create_client(
    settings.SUPABASE_URL,
    settings.SUPABASE_SERVICE_ROLE_KEY
)

BUCKET_NAME = settings.SUPABASE_BUCKET


def init_supabase():
    """Ensure the Supabase Storage bucket exists on startup."""
    try:
        buckets = supabase.storage.list_buckets()
        existing_bucket_names = [b.name for b in buckets]
        if BUCKET_NAME not in existing_bucket_names:
            supabase.storage.create_bucket(BUCKET_NAME, options={"public": False})
            print(f"Created Supabase Storage bucket: {BUCKET_NAME}")
        else:
            print(f"Supabase Storage bucket '{BUCKET_NAME}' already exists")
    except Exception as e:
        print(f"Supabase Storage Initialization Notice: {e}")
        print("Note: If the service_role key is invalid, please update SUPABASE_SERVICE_ROLE_KEY in .env")


def upload_to_supabase(path: str, file_bytes: bytes, content_type: Optional[str] = None) -> dict:
    """Upload file binary bytes to Supabase Storage."""
    options = {}
    if content_type:
        options["content-type"] = content_type
    return supabase.storage.from_(BUCKET_NAME).upload(
        path=path,
        file=file_bytes,
        file_options=options
    )


def get_signed_url(path: str, expires_in: int = 7200) -> str:
    """Generate a temporary signed URL for viewing or downloading a file."""
    res = supabase.storage.from_(BUCKET_NAME).create_signed_url(path, expires_in=expires_in)
    if isinstance(res, dict):
        url = res.get("signedURL") or res.get("signedUrl")
        if url:
            return url
    raise ValueError(f"Failed to obtain signed URL from Supabase response: {res}")


def remove_from_supabase(path: str) -> list:
    """Delete a single file from Supabase Storage."""
    return supabase.storage.from_(BUCKET_NAME).remove([path])


def remove_multiple_from_supabase(paths: List[str]) -> list:
    """Delete multiple files from Supabase Storage in a single call."""
    if not paths:
        return []
    return supabase.storage.from_(BUCKET_NAME).remove(paths)


def download_from_supabase(path: str) -> bytes:
    """Download raw file bytes from Supabase Storage."""
    return supabase.storage.from_(BUCKET_NAME).download(path)
