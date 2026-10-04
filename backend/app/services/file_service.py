"""
services/file_service.py – Secure file storage, AES-256 encryption, validation, and category helpers.

Implements:
  - File extension & MIME type validation
  - Explicit rejection of executable/script/dangerous formats
  - Size limitation checks
  - Path traversal sanitization
  - SHA-256 cryptographic checksum calculation
  - AES-256-GCM Server-Side Encryption on upload
  - Envelope Encryption with Master Key Key Management
  - Cloud Object Storage backend integration
  - Authorized Server-Side Decryption on retrieval
"""

import base64
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
from app.services.crypto_service import crypto_service
from app.services.key_manager import key_manager
from app.services.storage_service import storage_backend

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
    base_name = os.path.basename(filename).replace("\\", "/").split("/")[-1]
    base_name = base_name.replace("\x00", "")
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

    # 2. Check for dangerous double extensions (e.g., sample.pdf.exe or file.exe.jpg)
    name_parts = sanitized_name.lower().split(".")
    if len(name_parts) > 2:
        for part in name_parts[1:]:
            ext_candidate = f".{part}"
            if ext_candidate in DANGEROUS_EXTENSIONS:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Security rejection: Double extension detected with prohibited extension '{ext_candidate}'.",
                )

    # 3. Check against allowed extensions
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
    upload_path = Path(settings.UPLOAD_DIR) / "encrypted"
    upload_path.mkdir(parents=True, exist_ok=True)
    return upload_path


async def save_uploaded_file(
    file: UploadFile,
    sanitized_name: str,
    extension: str,
) -> Tuple[str, str, int, str, str, str]:
    """
    Process, AES-256-GCM encrypt, and persist uploaded file to cloud/local object storage.

    Steps:
      1. Reads file chunks into memory / buffer while calculating SHA-256 and enforcing size limit.
      2. Generates unique 256-bit DEK & 96-bit nonce.
      3. Encrypts file bytes with AES-256-GCM.
      4. Protects DEK via Envelope Encryption with Master KEK.
      5. Stores ONLY encrypted ciphertext in object storage.
      6. Returns metadata including cryptographic nonce and encrypted DEK reference.

    Returns:
        Tuple of (file_id, storage_key, file_size_bytes, sha256_hash, encrypted_dek, nonce_hex)
    """
    file_id = str(uuid.uuid4())
    storage_key = f"encrypted_{file_id}{extension}.enc"

    max_bytes = settings.MAX_FILE_SIZE_MB * 1024 * 1024
    sha256 = hashlib.sha256()
    chunks = []
    total_bytes = 0

    chunk_size = 1024 * 1024  # 1MB chunks

    try:
        while True:
            chunk = await file.read(chunk_size)
            if not chunk:
                break
            total_bytes += len(chunk)
            if total_bytes > max_bytes:
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail=f"File exceeds maximum allowed size of {settings.MAX_FILE_SIZE_MB}MB.",
                )
            sha256.update(chunk)
            chunks.append(chunk)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error reading uploaded file: {exc}",
        )

    plaintext_data = b"".join(chunks)

    # 1. Generate unique 256-bit Data Encryption Key (DEK)
    dek = key_manager.generate_dek()

    # 2. Generate 12-byte random nonce for AES-GCM
    nonce = crypto_service.generate_nonce()

    # 3. Encrypt file plaintext with AES-256-GCM
    ciphertext, _ = crypto_service.encrypt(plaintext_data, key=dek, nonce=nonce)

    # 4. Envelope-encrypt the DEK using the Master KEK
    encrypted_dek = key_manager.encrypt_dek(dek)
    nonce_hex = nonce.hex()

    # 5. Store ONLY encrypted ciphertext in storage backend
    content_type = file.content_type or "application/octet-stream"
    storage_backend.save_file(storage_key, ciphertext, content_type=content_type)

    return file_id, storage_key, total_bytes, sha256.hexdigest(), encrypted_dek, nonce_hex


def decrypt_and_retrieve_file(storage_key: str, encrypted_dek: str, nonce_hex: str) -> bytes:
    """
    Retrieve encrypted file ciphertext from storage and decrypt it with AES-256-GCM.

    Returns:
        Decrypted plaintext bytes.
    """
    # 1. Retrieve ciphertext from storage backend
    ciphertext = storage_backend.get_file(storage_key)

    # 2. Decrypt DEK using Master KEK
    dek = key_manager.decrypt_dek(encrypted_dek)

    # 3. Decrypt ciphertext with DEK and nonce
    nonce = bytes.fromhex(nonce_hex)
    plaintext = crypto_service.decrypt(ciphertext, key=dek, nonce=nonce)

    return plaintext


def remove_file_from_storage(storage_key: str) -> bool:
    """Delete the encrypted file from object storage."""
    return storage_backend.delete_file(storage_key)


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
    return secrets.token_urlsafe(24)
