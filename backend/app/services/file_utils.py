import os
import re
import uuid
from pathlib import Path

from app.core.config import settings
from app.services.encryption import (
    decrypt_file,
    decrypt_file_v2,
    encrypt_file,
    encrypt_file_v2,
    generate_file_key,
    unwrap_file_key,
    wrap_file_key,
)
from app.services.storage import delete_encrypted, get_encrypted, put_encrypted

ALLOWED_EXTENSIONS = {
    "pdf",
    "txt",
    "doc",
    "docx",
    "xls",
    "xlsx",
    "csv",
    "ppt",
    "pptx",
    "jpg",
    "jpeg",
    "png",
    "gif",
    "webp",
    "zip",
    "rar",
    "mp4",
    "mp3",
    "mkv",
    "avi",
    "mov",
    "wav",
    "aac",
    "7z",
    "py",
    "js",
    "ts",
    "tsx",
    "jsx",
    "json",
    "md",
}


def ensure_storage_directory() -> Path:

    path = Path(settings.STORAGE_DIR)

    path.mkdir(
        parents=True,
        exist_ok=True,
    )

    return path


def sanitize_filename(filename: str) -> str:

    filename = Path(filename).name

    filename = re.sub(
        r"[^a-zA-Z0-9._ -]",
        "_",
        filename,
    )

    return filename[:255]


def get_extension(filename: str) -> str:

    return Path(filename).suffix.lower().lstrip(".")


def validate_file_type(filename: str) -> bool:

    extension = get_extension(filename)

    return extension in ALLOWED_EXTENSIONS


def get_file_category(
    filename: str,
    content_type: str | None,
) -> str:

    extension = get_extension(filename)

    if extension in {
        "jpg",
        "jpeg",
        "png",
        "gif",
        "webp",
    }:
        return "IMAGE"

    if extension in {
        "pdf",
        "doc",
        "docx",
        "txt",
        "xls",
        "xlsx",
        "csv",
        "ppt",
        "pptx",
    }:
        return "DOCUMENT"

    if extension in {
        "mp4",
        "mkv",
        "avi",
        "mov",
    }:
        return "VIDEO"

    if extension in {
        "mp3",
        "wav",
        "aac",
    }:
        return "AUDIO"

    if extension in {
        "zip",
        "rar",
        "7z",
    }:
        return "ARCHIVE"

    return "OTHER"


def generate_storage_filename(
    original_filename: str,
) -> str:

    extension = get_extension(
        original_filename
    )

    unique_name = uuid.uuid4().hex

    if extension:
        return f"{unique_name}.{extension}.enc"

    return f"{unique_name}.enc"


def save_encrypted_file(
    plaintext: bytes,
    storage_filename: str,
) -> tuple[str, str]:
    """Encrypt with a random per-file AES-256-GCM key and wrap that key."""
    storage_dir = ensure_storage_directory()
    file_key = generate_file_key()
    encrypted = encrypt_file_v2(plaintext, file_key)
    storage_key = storage_filename
    stored = put_encrypted(encrypted, storage_key)
    return stored, wrap_file_key(file_key)


def read_decrypted_file(
    storage_path: str,
    wrapped_key: str | None = None,
) -> bytes:
    try:
        encrypted = get_encrypted(storage_path)
    except (OSError, FileNotFoundError):
        raise FileNotFoundError("Stored file not found")
    if wrapped_key:
        return decrypt_file_v2(encrypted, unwrap_file_key(wrapped_key))
    # Existing V1 files remain readable.
    return decrypt_file(encrypted, Path(storage_path).stem)

def delete_stored_file(
    storage_path: str,
) -> None:

    delete_encrypted(storage_path)


def is_file_size_allowed(
    size: int,
) -> bool:

    return size <= settings.MAX_UPLOAD_SIZE

def rotate_encrypted_file(storage_path: str, wrapped_key: str | None) -> str:
    """Re-encrypt an existing file under a new random per-file key."""
    plaintext = read_decrypted_file(storage_path, wrapped_key)
    new_key = generate_file_key()
    encrypted = encrypt_file_v2(plaintext, new_key)
    put_encrypted(encrypted, storage_path)
    return wrap_file_key(new_key)
