import os

from dotenv import load_dotenv


# =========================================================
# LOAD ENVIRONMENT VARIABLES
# =========================================================

load_dotenv(override=True)


# =========================================================
# GET AES-256 KEY
# =========================================================

def get_encryption_key() -> bytes:

    aes_key = os.getenv("AES_KEY")

    if not aes_key:
        raise ValueError(
            "AES_KEY is not configured in .env"
        )

    # Convert hexadecimal key to bytes
    try:
        key = bytes.fromhex(aes_key)

    except ValueError:
        raise ValueError(
            "AES_KEY must contain only hexadecimal characters"
        )

    # AES-256 requires exactly 32 bytes
    if len(key) != 32:
        raise ValueError(
            f"AES_KEY must be exactly 32 bytes. "
            f"Current size: {len(key)} bytes"
        )

    return key