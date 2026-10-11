import os
from dotenv import load_dotenv
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

# Load .env file
load_dotenv()

# Get encryption key
ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY")

if not ENCRYPTION_KEY:
    raise Exception("ENCRYPTION_KEY is not set in .env")

# Convert key to bytes
ENCRYPTION_KEY = ENCRYPTION_KEY.encode("utf-8")

# AES-256 requires exactly 32 bytes
if len(ENCRYPTION_KEY) != 32:
    raise Exception(
        f"ENCRYPTION_KEY must be exactly 32 bytes. Current length: {len(ENCRYPTION_KEY)}"
    )


def encrypt_file(data: bytes) -> bytes:
    """Encrypt file using AES-256-GCM."""

    aesgcm = AESGCM(ENCRYPTION_KEY)

    # Generate a unique nonce
    nonce = os.urandom(12)

    # Encrypt
    encrypted_data = aesgcm.encrypt(
        nonce,
        data,
        None
    )

    # Store nonce + encrypted data
    return nonce + encrypted_data


def decrypt_file(encrypted_data: bytes) -> bytes:
    """Decrypt AES-256-GCM encrypted file."""

    aesgcm = AESGCM(ENCRYPTION_KEY)

    # First 12 bytes = nonce
    nonce = encrypted_data[:12]

    # Remaining bytes = encrypted content
    ciphertext = encrypted_data[12:]

    # Decrypt
    decrypted_data = aesgcm.decrypt(
        nonce,
        ciphertext,
        None
    )

    return decrypted_data