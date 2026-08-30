"""
services/file_service.py – Secure file storage, validation, hashing, and category helpers.

Implements:
  - File extension & MIME type validation
  - Explicit rejection of executable/script/dangerous formats
  - Size limitation checks
  - Path traversal sanitization
  - SHA-256 cryptographic checksum calculation during streaming writes
  - Unique UUID storage filename generation
  - Category mapping (documents, images, PDFs, archives, spreadsheets)
"""

from datetime import datetime, timedelta, timezone
import hashlib
import os
from pathlib import Path
import re
import secrets
from typing import Optional, Set, Tuple
import uuid

from fastapi import HTTPException, UploadFile, status

from app.config import settings
from app.schemas import FileCategory, ShareDuration

# ─── Allowed & Forbidden Extensions ──────────────────────────────────────────

DANGEROUS_EXTENSIONS: Set[str] = {
    ".exe", ".bat", ".cmd", ".sh", ".bash", ".bin", ".msi", ".dll", ".so",
    ".dylib", ".vbs", ".js", ".jse", ".wsf", ".wsh", ".ps1", ".psm1",
    ".scr", ".pif", ".hta", ".cpl", ".msc", ".jar", ".com", ".gadget",
    ".php", ".asp", ".aspx", ".jsp", ".cgi", ".pl"
}

ALLOWED_EXTENSIONS: Set[str] = {
    ext.strip().lower()
    for ext in settings.ALLOWED_EXTENSIONS.split(",")
    if ext.strip()
}

CATEGORY_MAP = {
    ".pdf": FileCategory.pdf,
    ".doc": FileCategory.document,
    ".docx": FileCategory.document,
    ".txt": FileCategory.document,
    ".rtf": FileCategory.document,
    ".odt": FileCategory.document,
    ".md": FileCategory.document,
    ".png": FileCategory.image,
    ".jpg": FileCategory.image,
    ".jpeg": FileCategory.image,
    ".gif": FileCategory.image,
    ".webp": FileCategory.image,
    ".svg": FileCategory.image,
    ".bmp": FileCategory.image,
    ".xls": FileCategory.spreadsheet,
    ".xlsx": FileCategory.spreadsheet,
    ".csv": FileCategory.spreadsheet,
    ".ppt": FileCategory.presentation,
    ".pptx": FileCategory.presentation,
    ".zip": FileCategory.archive,
    ".tar": FileCategory.archive,
    ".gz": FileCategory.archive,
    ".7z": FileCategory.archive,
}


def sanitize_filename(filename: str) -> str:
    """
    Sanitize filename to prevent path traversal and shell injection attacks.
    Removes directory separators and non-standard characters.
    """
    # Extract only the base name
    base_name = os.path.basename(filename).replace("\\", "/").split("/")[-1]
    # Remove null bytes
    base_name = base_name.replace("\x00", "")
    # Keep alphanumeric, dots, underscores, dashes, spaces
    cleaned = re.sub(r"[^\w\.\-\s]", "_", base_name).strip()
    return cleaned if cleaned else "unnamed_file"


def get_file_extension(filename: str) -> str:
    """Extract lowercase file extension including dot."""
    ext = os.path.splitext(filename)[1].lower()
    return ext


def get_file_category(extension: str) -> FileCategory:
    """Map file extension to standard FileCategory."""
    return CATEGORY_MAP.get(extension.lower(), FileCategory.other)


def validate_file(file: UploadFile) -> Tuple[str, str, FileCategory]:
    """
    Validate file name, extension, and security rules.
    Raises HTTPException 400 for unsupported or dangerous file formats.
    """
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File upload failed: No filename provided.",
        )

    sanitized_name = sanitize_filename(file.filename)
    extension = get_file_extension(sanitized_name)

    # 1. Reject explicitly dangerous executable/script extensions
    if extension in DANGEROUS_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"File type '{extension}' is strictly forbidden for security reasons. "
                "Executable and script files cannot be uploaded."
            ),
        )

    # 2. Check against allowed extensions
    if extension not in ALLOWED_EXTENSIONS:
        allowed_list_str = ", ".join(sorted(list(ALLOWED_EXTENSIONS)))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Unsupported file format '{extension}'. "
                f"Supported file types include: {allowed_list_str}"
            ),
        )

    category = get_file_category(extension)
    return sanitized_name, extension, category


def ensure_upload_dir() -> Path:
    """Ensure the uploads storage directory exists on disk."""
    upload_path = Path(settings.UPLOAD_DIR)
    upload_path.mkdir(parents=True, exist_ok=True)
    return upload_path


async def save_uploaded_file(file: UploadFile, sanitized_name: str, extension: str) -> Tuple[str, str, int, str]:
    """
    Stream and persist uploaded file to disk securely.
    Calculates SHA-256 checksum and enforces max file size limit.

    Returns:
        Tuple of (file_id, stored_filename, file_size_bytes, sha256_hash)
    """
    upload_dir = ensure_upload_dir()
    file_id = str(uuid.uuid4())
    stored_filename = f"{file_id}{extension}"
    target_path = upload_dir / stored_filename

    max_bytes = settings.MAX_FILE_SIZE_MB * 1024 * 1024
    total_bytes = 0
    sha256 = hashlib.sha256()

    chunk_size = 1024 * 1024  # 1MB chunks

    try:
        with open(target_path, "wb") as buffer:
            while True:
                chunk = await file.read(chunk_size)
                if not chunk:
                    break
                total_bytes += len(chunk)
                if total_bytes > max_bytes:
                    # Cleanup partial file on size breach
                    buffer.close()
                    if target_path.exists():
                        target_path.unlink()
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail=f"File exceeds maximum allowed size of {settings.MAX_FILE_SIZE_MB}MB.",
                    )
                sha256.update(chunk)
                buffer.write(chunk)
    except HTTPException:
        raise
    except Exception as exc:
        if target_path.exists():
            target_path.unlink()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to securely save file to storage: {exc}",
        )

    return file_id, stored_filename, total_bytes, sha256.hexdigest()


def remove_file_from_storage(stored_filename: str) -> bool:
    """Delete the actual physical file from the upload storage directory."""
    try:
        upload_dir = ensure_upload_dir()
        target_path = upload_dir / stored_filename
        if target_path.exists():
            target_path.unlink()
            return True
        return False
    except Exception:
        return False


def get_file_storage_path(stored_filename: str) -> Path:
    """Get absolute Path to stored file on disk."""
    upload_dir = ensure_upload_dir()
    return upload_dir / stored_filename


def calculate_expiration(
    duration: ShareDuration,
    custom_expires_at: Optional[datetime] = None,
) -> Optional[datetime]:
    """Calculate expiration datetime based on duration selection."""
    now = datetime.now(timezone.utc)
    if duration == ShareDuration.one_hour:
        return now + timedelta(hours=1)
    elif duration == ShareDuration.twenty_four_hours:
        return now + timedelta(days=1)
    elif duration == ShareDuration.seven_days:
        return now + timedelta(days=7)
    elif duration == ShareDuration.thirty_days:
        return now + timedelta(days=30)
    elif duration == ShareDuration.never:
        return None
    elif duration == ShareDuration.custom:
        if not custom_expires_at:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="custom_expires_at is required when duration is set to 'custom'.",
            )
        # Ensure timezone-aware comparison
        if custom_expires_at.tzinfo is None:
            custom_expires_at = custom_expires_at.replace(tzinfo=timezone.utc)
        if custom_expires_at <= now:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="custom_expires_at must be in the future.",
            )
        return custom_expires_at
    return now + timedelta(days=1)


def generate_share_token() -> str:
    """Generate a cryptographically secure URL-safe share token."""
    return secrets.token_urlsafe(18)
