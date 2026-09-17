import os
from pathlib import Path

from dotenv import load_dotenv
from cryptography.hazmat.primitives.ciphers.aead import AESGCM


# Load backend/.env explicitly
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


def get_encryption_key():
    key = os.getenv("TRUSTSHARE_ENCRYPTION_KEY")

    if not key:
        raise RuntimeError(
            "TRUSTSHARE_ENCRYPTION_KEY is not configured"
        )

    key_bytes = bytes.fromhex(key)

    if len(key_bytes) != 32:
        raise RuntimeError(
            "TRUSTSHARE_ENCRYPTION_KEY must be exactly 32 bytes"
        )

    return key_bytes


def encrypt_file(data: bytes):
    key = get_encryption_key()
    aesgcm = AESGCM(key)

    nonce = os.urandom(12)

    encrypted_data = aesgcm.encrypt(
        nonce,
        data,
        None
    )

    return nonce, encrypted_data


def decrypt_file(nonce: bytes, encrypted_data: bytes):
    key = get_encryption_key()
    aesgcm = AESGCM(key)

    return aesgcm.decrypt(
        nonce,
        encrypted_data,
        None
    )