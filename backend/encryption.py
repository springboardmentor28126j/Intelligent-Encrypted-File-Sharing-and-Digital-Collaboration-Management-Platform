import os
import base64

from cryptography.hazmat.primitives.ciphers.aead import AESGCM


# =========================================================
# MASTER KEY (KEY ENCRYPTION KEY)
# =========================================================
#
# The master key wraps (encrypts) each file's individual data key.
# It must be a 32-byte (256-bit) key, base64-encoded, and it must
# NEVER be committed to source control.
#
# Generate one with:
#   python generate_master_key.py
#
# Then add it to your .env file as:
#   MASTER_KEY=<the output>
#
# =========================================================

MASTER_KEY_ENV_VAR = "MASTER_KEY"


def _load_master_key() -> bytes:

    encoded = os.environ.get(MASTER_KEY_ENV_VAR)

    if not encoded:

        raise RuntimeError(
            "MASTER_KEY environment variable is not set. "
            "Run 'python generate_master_key.py' and add the output to your .env file."
        )

    key = base64.b64decode(encoded)

    if len(key) != 32:

        raise RuntimeError(
            "MASTER_KEY must decode to exactly 32 bytes (256 bits)."
        )

    return key


MASTER_KEY = _load_master_key()


# =========================================================
# PER-FILE DATA KEY (DEK) GENERATION
# =========================================================

def generate_data_key() -> bytes:
    """Generates a fresh random 256-bit key for encrypting a single file."""

    return AESGCM.generate_key(bit_length=256)


# =========================================================
# KEY WRAPPING (envelope encryption)
# =========================================================
#
# The data key (DEK) is itself encrypted with the master key before
# being stored in the database, so a database leak alone never
# exposes a usable, plaintext file-encryption key.
#
# =========================================================

def wrap_key(data_key: bytes) -> str:
    """Encrypts a data key with the master key. Returns a base64 string safe for DB storage."""

    aesgcm = AESGCM(MASTER_KEY)

    nonce = os.urandom(12)

    wrapped = aesgcm.encrypt(nonce, data_key, None)

    # Store nonce + wrapped key together so unwrap_key() is self-contained.
    return base64.b64encode(nonce + wrapped).decode("utf-8")


def unwrap_key(wrapped_key_b64: str) -> bytes:
    """Reverses wrap_key(): decrypts a stored wrapped key back into the raw data key."""

    raw = base64.b64decode(wrapped_key_b64)

    nonce = raw[:12]
    wrapped = raw[12:]

    aesgcm = AESGCM(MASTER_KEY)

    return aesgcm.decrypt(nonce, wrapped, None)


# =========================================================
# FILE ENCRYPTION / DECRYPTION (AES-256-GCM)
# =========================================================
#
# GCM is authenticated encryption: any tampering with the ciphertext
# causes decrypt() to raise cryptography.exceptions.InvalidTag instead
# of silently returning corrupted data.
#
# =========================================================

def encrypt_file_bytes(plaintext: bytes, data_key: bytes) -> tuple[bytes, str]:
    """
    Encrypts file bytes with the given data key.

    Returns (ciphertext, nonce_b64). The nonce is not secret, but it must
    be stored alongside the ciphertext -- it's required to decrypt later.
    """

    aesgcm = AESGCM(data_key)

    nonce = os.urandom(12)

    ciphertext = aesgcm.encrypt(nonce, plaintext, None)

    return ciphertext, base64.b64encode(nonce).decode("utf-8")


def decrypt_file_bytes(ciphertext: bytes, data_key: bytes, nonce_b64: str) -> bytes:
    """
    Reverses encrypt_file_bytes().

    Raises cryptography.exceptions.InvalidTag if the ciphertext, nonce,
    or key don't match -- this is how tampering or corruption is caught.
    """

    nonce = base64.b64decode(nonce_b64)

    aesgcm = AESGCM(data_key)

    return aesgcm.decrypt(nonce, ciphertext, None)
