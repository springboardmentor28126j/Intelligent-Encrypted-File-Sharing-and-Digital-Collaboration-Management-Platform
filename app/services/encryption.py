import os

from app.core.config import settings
from cryptography.hazmat.primitives.ciphers.aead import AESGCM


def get_encryption_key() -> bytes:
    key = settings.FILE_ENCRYPTION_KEY.encode()

    # Derive exactly 32 bytes for AES-256.
    return key[:32]


def encrypt_file(data: bytes) -> bytes:
    key = get_encryption_key()

    nonce = os.urandom(12)

    aesgcm = AESGCM(key)

    encrypted_data = aesgcm.encrypt(
        nonce,
        data,
        None,
    )

    # Store nonce together with ciphertext.
    return nonce + encrypted_data


def decrypt_file(data: bytes) -> bytes:
    key = get_encryption_key()

    nonce = data[:12]
    encrypted_data = data[12:]

    aesgcm = AESGCM(key)

    return aesgcm.decrypt(
        nonce,
        encrypted_data,
        None,
    )