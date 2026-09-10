from pathlib import Path

from .encryption_service import decrypt_file_data
from .storage_service import StorageConfigurationError, StorageError, StorageObjectNotFoundError, get_storage_service


def read_file_content(item) -> bytes:
    storage_backend = getattr(item, "storage_backend", None)
    storage_key = getattr(item, "storage_key", None)
    if storage_backend and storage_key:
        encrypted_content = get_storage_service(storage_backend).get_encrypted(storage_key)
    else:
        path = Path(item.file_path)
        if not path.is_file():
            raise StorageObjectNotFoundError("Stored file was not found")
        try:
            encrypted_content = path.read_bytes()
        except OSError as error:
            raise StorageError("Local file could not be read") from error

    if item.encryption:
        return decrypt_file_data(encrypted_content, item.encryption)
    return encrypted_content


__all__ = [
    "StorageConfigurationError",
    "StorageError",
    "StorageObjectNotFoundError",
    "read_file_content",
]
