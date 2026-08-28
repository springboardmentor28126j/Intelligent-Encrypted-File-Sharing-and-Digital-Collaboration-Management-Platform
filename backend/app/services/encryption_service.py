"""
Encryption service implementing the spec's Server-Side Encryption Architecture:

  1. Generate a unique AES-256 key per uploaded file.
  2. Encrypt the file with AES-256-GCM (authenticated encryption -> tamper-evident).
  3. "Wrap" (encrypt) that per-file key with a master key, so the DB never stores
     a raw usable key.
  4. Store only the encrypted file + wrapped key + nonce/tag metadata.
  5. Decryption happens only in-memory, on demand, for authorized requests.

In production, MASTER_ENCRYPTION_KEY should come from a real KMS instead of an
env var, and key rotation should re-wrap (not re-encrypt) file keys.
"""
import base64
import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.core.config import settings


def _master_key_bytes() -> bytes:
    """
    Derive a 32-byte key from the configured master key string.
    Accepts either raw text or base64; always returns exactly 32 bytes.
    """
    raw = settings.MASTER_ENCRYPTION_KEY.encode()
    try:
        decoded = base64.urlsafe_b64decode(raw)
        if len(decoded) == 32:
            return decoded
    except Exception:
        pass
    # Fallback: pad/truncate to 32 bytes (dev convenience only)
    return (raw * 32)[:32]


def generate_file_key() -> bytes:
    """Generate a fresh, random 256-bit key for a single file."""
    return AESGCM.generate_key(bit_length=256)


def wrap_key(file_key: bytes) -> str:
    """Encrypt (wrap) a per-file key with the master key. Returns base64 string."""
    aesgcm = AESGCM(_master_key_bytes())
    nonce = os.urandom(12)
    wrapped = aesgcm.encrypt(nonce, file_key, None)
    return base64.urlsafe_b64encode(nonce + wrapped).decode()


def unwrap_key(wrapped_key_b64: str) -> bytes:
    """Decrypt (unwrap) a per-file key using the master key."""
    aesgcm = AESGCM(_master_key_bytes())
    raw = base64.urlsafe_b64decode(wrapped_key_b64)
    nonce, wrapped = raw[:12], raw[12:]
    return aesgcm.decrypt(nonce, wrapped, None)


def encrypt_bytes(plaintext: bytes) -> tuple[bytes, str, bytes]:
    """
    Encrypt file bytes with a fresh AES-256-GCM key.

    Returns:
        ciphertext: the encrypted bytes (safe to store in S3/local disk)
        wrapped_key: base64 wrapped per-file key (safe to store in DB)
        nonce: the 12-byte nonce used (stored alongside ciphertext, not secret)
    """
    file_key = generate_file_key()
    nonce = os.urandom(12)
    aesgcm = AESGCM(file_key)
    ciphertext = aesgcm.encrypt(nonce, plaintext, None)
    wrapped_key = wrap_key(file_key)
    return ciphertext, wrapped_key, nonce


def decrypt_bytes(ciphertext: bytes, wrapped_key: str, nonce: bytes) -> bytes:
    """Decrypt file bytes in-memory. Never persists the raw key or plaintext."""
    file_key = unwrap_key(wrapped_key)
    aesgcm = AESGCM(file_key)
    return aesgcm.decrypt(nonce, ciphertext, None)
