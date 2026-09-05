"""
AES-256 encryption for file contents, using envelope encryption:

  - Every file gets its own randomly generated 256-bit AES key ("data key").
  - That data key is itself encrypted ("wrapped") with a single master key
    read from the environment, before being stored in Postgres.
  - The master key never touches the database and the raw per-file key
    is never stored anywhere — only its encrypted form.

AES-256-GCM is used for both layers because it's authenticated encryption:
tampering with the ciphertext (file bytes or wrapped key) is detected on
decrypt, not just silently accepted.
"""

import base64
import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.core.config import settings

NONCE_SIZE = 12  # 96-bit nonce, standard for AES-GCM


def _master_key_bytes() -> bytes:
    key = base64.b64decode(settings.MASTER_ENCRYPTION_KEY)
    if len(key) != 32:
        raise ValueError("MASTER_ENCRYPTION_KEY must decode to exactly 32 bytes")
    return key


def generate_data_key() -> bytes:
    """A fresh random AES-256 key, unique per file."""
    return AESGCM.generate_key(bit_length=256)


def encrypt_bytes(plaintext: bytes, key: bytes) -> tuple[bytes, bytes]:
    """Encrypt bytes with the given key. Returns (ciphertext, nonce)."""
    nonce = os.urandom(NONCE_SIZE)
    aesgcm = AESGCM(key)
    ciphertext = aesgcm.encrypt(nonce, plaintext, None)
    return ciphertext, nonce


def decrypt_bytes(ciphertext: bytes, key: bytes, nonce: bytes) -> bytes:
    """Decrypt bytes with the given key and nonce."""
    aesgcm = AESGCM(key)
    return aesgcm.decrypt(nonce, ciphertext, None)


def wrap_key(data_key: bytes) -> tuple[bytes, bytes]:
    """Encrypt a per-file data key with the master key before storing it."""
    return encrypt_bytes(data_key, _master_key_bytes())


def unwrap_key(wrapped_key: bytes, key_nonce: bytes) -> bytes:
    """Decrypt a stored, wrapped data key back into the raw AES key."""
    return decrypt_bytes(wrapped_key, _master_key_bytes(), key_nonce)
