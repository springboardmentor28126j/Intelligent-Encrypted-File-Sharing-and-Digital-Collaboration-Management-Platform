from __future__ import annotations

import base64
import hashlib
import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.core.config import settings

NONCE_SIZE = 12
KEY_SIZE = 32
MAGIC = b"TS2"


def _master_key() -> bytes:
    """Load a 32-byte master key from base64/hex/raw configuration."""
    raw = settings.FILE_ENCRYPTION_KEY.strip().encode()
    for decoder in (base64.urlsafe_b64decode, base64.b64decode):
        try:
            padded = raw + b"=" * (-len(raw) % 4)
            key = decoder(padded)
            if len(key) == KEY_SIZE:
                return key
        except Exception:
            pass
    try:
        key = bytes.fromhex(settings.FILE_ENCRYPTION_KEY.strip())
        if len(key) == KEY_SIZE:
            return key
    except ValueError:
        pass
    if len(raw) == KEY_SIZE:
        return raw
    raise ValueError("FILE_ENCRYPTION_KEY must decode to 32 bytes")


def generate_file_key() -> bytes:
    return os.urandom(KEY_SIZE)


def wrap_file_key(file_key: bytes) -> str:
    if len(file_key) != KEY_SIZE:
        raise ValueError("File key must be 32 bytes")
    nonce = os.urandom(NONCE_SIZE)
    encrypted = AESGCM(_master_key()).encrypt(nonce, file_key, b"TrustShare:file-key:v2")
    return base64.urlsafe_b64encode(nonce + encrypted).decode()


def unwrap_file_key(wrapped_key: str) -> bytes:
    data = base64.urlsafe_b64decode(wrapped_key.encode())
    if len(data) <= NONCE_SIZE:
        raise ValueError("Invalid wrapped file key")
    nonce, ciphertext = data[:NONCE_SIZE], data[NONCE_SIZE:]
    key = AESGCM(_master_key()).decrypt(nonce, ciphertext, b"TrustShare:file-key:v2")
    if len(key) != KEY_SIZE:
        raise ValueError("Invalid file key")
    return key


def encrypt_file_v2(plaintext: bytes, file_key: bytes) -> bytes:
    nonce = os.urandom(NONCE_SIZE)
    ciphertext = AESGCM(file_key).encrypt(nonce, plaintext, b"TrustShare:file:v2")
    return MAGIC + nonce + ciphertext


def decrypt_file_v2(encrypted_data: bytes, file_key: bytes) -> bytes:
    if not encrypted_data.startswith(MAGIC):
        raise ValueError("Unsupported encryption format")
    data = encrypted_data[len(MAGIC):]
    if len(data) <= NONCE_SIZE:
        raise ValueError("Invalid encrypted file")
    nonce, ciphertext = data[:NONCE_SIZE], data[NONCE_SIZE:]
    return AESGCM(file_key).decrypt(nonce, ciphertext, b"TrustShare:file:v2")


def derive_file_key(file_identifier: str) -> bytes:
    # Legacy V1 compatibility only. New uploads use random per-file keys.
    return hashlib.sha256(
        _master_key() + file_identifier.encode("utf-8")
    ).digest()


def encrypt_file(plaintext: bytes, file_identifier: str) -> bytes:
    key = derive_file_key(file_identifier)
    nonce = os.urandom(NONCE_SIZE)
    ciphertext = AESGCM(key).encrypt(nonce, plaintext, None)
    return nonce + ciphertext


def decrypt_file(encrypted_data: bytes, file_identifier: str) -> bytes:
    if len(encrypted_data) <= NONCE_SIZE:
        raise ValueError("Invalid encrypted file")
    key = derive_file_key(file_identifier)
    nonce = encrypted_data[:NONCE_SIZE]
    return AESGCM(key).decrypt(nonce, encrypted_data[NONCE_SIZE:], None)
