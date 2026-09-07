import base64
import binascii
import secrets
from dataclasses import dataclass

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from ..config import settings

ALGORITHM = "AES-256-GCM"
KEY_VERSION = "v1"
KEY_SIZE_BYTES = 32
NONCE_SIZE_BYTES = 12
KEY_WRAP_ASSOCIATED_DATA = b"trustshare:file-key:v1"


class EncryptionConfigurationError(RuntimeError):
    pass


@dataclass(frozen=True)
class EncryptedFile:
    ciphertext: bytes
    file_nonce: bytes
    wrapped_key: bytes
    key_nonce: bytes
    algorithm: str = ALGORITHM
    key_version: str = KEY_VERSION


def _master_key() -> bytes:
    value = settings.file_encryption_master_key.strip()
    if not value:
        raise EncryptionConfigurationError("FILE_ENCRYPTION_MASTER_KEY is not configured")
    try:
        key = base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))
    except (ValueError, binascii.Error) as error:
        raise EncryptionConfigurationError("FILE_ENCRYPTION_MASTER_KEY is not valid base64") from error
    if len(key) != KEY_SIZE_BYTES:
        raise EncryptionConfigurationError("FILE_ENCRYPTION_MASTER_KEY must decode to 32 bytes")
    return key


def generate_file_key() -> bytes:
    return AESGCM.generate_key(bit_length=256)


def encrypt_file_data(data: bytes) -> EncryptedFile:
    file_key = generate_file_key()
    file_nonce = secrets.token_bytes(NONCE_SIZE_BYTES)
    key_nonce = secrets.token_bytes(NONCE_SIZE_BYTES)
    ciphertext = AESGCM(file_key).encrypt(file_nonce, data, None)
    wrapped_key = AESGCM(_master_key()).encrypt(key_nonce, file_key, KEY_WRAP_ASSOCIATED_DATA)
    return EncryptedFile(ciphertext, file_nonce, wrapped_key, key_nonce)


def decrypt_file_data(data: bytes, metadata) -> bytes:
    if metadata.algorithm != ALGORITHM:
        raise ValueError("Unsupported file encryption algorithm")
    try:
        wrapped_key = bytes.fromhex(metadata.wrapped_key)
        key_nonce = bytes.fromhex(metadata.key_nonce)
        file_nonce = bytes.fromhex(metadata.file_nonce)
        file_key = AESGCM(_master_key()).decrypt(key_nonce, wrapped_key, KEY_WRAP_ASSOCIATED_DATA)
        if len(file_key) != KEY_SIZE_BYTES:
            raise ValueError("Invalid file encryption key")
        return AESGCM(file_key).decrypt(file_nonce, data, None)
    except (InvalidTag, ValueError) as error:
        raise ValueError("Encrypted file integrity check failed") from error


def metadata_for_storage(encrypted: EncryptedFile) -> dict[str, str]:
    return {
        "algorithm": encrypted.algorithm,
        "key_version": encrypted.key_version,
        "wrapped_key": encrypted.wrapped_key.hex(),
        "key_nonce": encrypted.key_nonce.hex(),
        "file_nonce": encrypted.file_nonce.hex(),
    }
