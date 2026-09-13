from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from decouple import config
import base64
import os


# =========================================================
# Load Master Encryption Key
# =========================================================

MASTER_ENCRYPTION_KEY = config("MASTER_ENCRYPTION_KEY")


# =========================================================
# Convert Master Key from Base64 to Bytes
# =========================================================

MASTER_KEY_BYTES = base64.urlsafe_b64decode(
    MASTER_ENCRYPTION_KEY
)


# =========================================================
# Validate Master Key
# =========================================================

if len(MASTER_KEY_BYTES) != 32:
    raise RuntimeError(
        "MASTER_ENCRYPTION_KEY must be exactly 32 bytes (256 bits)."
    )


# =========================================================
# Generate AES-256 File Encryption Key
# =========================================================

def generate_file_key() -> bytes:

    # Generate a random 32-byte key
    # 32 bytes = 256 bits
    return AESGCM.generate_key(bit_length=256)


# =========================================================
# Encrypt / Protect File Key
# =========================================================

def encrypt_file_key(file_key: bytes) -> str:

    aesgcm = AESGCM(MASTER_KEY_BYTES)

    # Generate a unique nonce
    nonce = os.urandom(12)

    # Encrypt the file key
    encrypted_key = aesgcm.encrypt(
        nonce,
        file_key,
        None
    )

    # Store nonce + encrypted key together
    protected_key = nonce + encrypted_key

    # Convert to Base64 for PostgreSQL
    return base64.urlsafe_b64encode(
        protected_key
    ).decode("utf-8")


# =========================================================
# Decrypt / Recover File Key
# =========================================================

def decrypt_file_key(protected_key: str) -> bytes:

    try:

        # Convert Base64 back to bytes
        protected_key_bytes = base64.urlsafe_b64decode(
            protected_key
        )

        # First 12 bytes = nonce
        nonce = protected_key_bytes[:12]

        # Remaining bytes = encrypted key
        encrypted_key = protected_key_bytes[12:]

        aesgcm = AESGCM(MASTER_KEY_BYTES)

        # Recover original file key
        file_key = aesgcm.decrypt(
            nonce,
            encrypted_key,
            None
        )

        return file_key

    except Exception:
        raise RuntimeError(
            "Unable to decrypt the file encryption key."
        )