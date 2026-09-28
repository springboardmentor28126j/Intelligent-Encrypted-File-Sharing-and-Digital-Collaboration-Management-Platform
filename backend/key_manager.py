import os
import base64
import secrets
import hashlib

from dotenv import load_dotenv

load_dotenv()


from cryptography.hazmat.primitives.ciphers.aead import AESGCM


MASTER_KEY_ENV = "TRUSTSHARE_MASTER_KEY"


def get_master_key() -> bytes:
    value = os.getenv(MASTER_KEY_ENV)

    if not value:
        raise RuntimeError(
            "TRUSTSHARE_MASTER_KEY is not configured in .env"
        )

    try:
        key = base64.b64decode(value, validate=True)

        if len(key) != 32:
            raise ValueError

        return key

    except Exception:
        raise RuntimeError(
            "TRUSTSHARE_MASTER_KEY must be "
            "base64-encoded 32-byte value"
        )


def generate_file_key() -> bytes:
    """Generate a unique 256-bit key for one file."""
    return secrets.token_bytes(32)


def wrap_file_key(file_key: bytes):
    """
    Encrypt a per-file key with the server master key.
    The master key never leaves the server.
    """
    if len(file_key) != 32:
        raise ValueError("File key must be 32 bytes")

    master_key = get_master_key()
    aes = AESGCM(master_key)

    nonce = secrets.token_bytes(12)
    wrapped_key = aes.encrypt(
        nonce,
        file_key,
        None
    )

    return nonce, wrapped_key


def unwrap_file_key(
    nonce: bytes,
    wrapped_key: bytes
) -> bytes:
    """Recover the per-file key using the server master key."""

    master_key = get_master_key()
    aes = AESGCM(master_key)

    return aes.decrypt(
        nonce,
        wrapped_key,
        None
    )


def get_key_fingerprint(key: bytes) -> str:
    """Return only a non-secret identifier for a key."""
    return hashlib.sha256(key).hexdigest()[:16]


def generate_new_master_key() -> str:
    """Generate a new 256-bit master key for rotation."""
    return base64.b64encode(
        secrets.token_bytes(32)
    ).decode("utf-8")