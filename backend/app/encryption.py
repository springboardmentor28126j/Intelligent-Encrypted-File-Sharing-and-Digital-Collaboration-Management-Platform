from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import os


# =========================================================
# Generate AES-256 Key
# =========================================================

def generate_key() -> bytes:
    """
    Generate a secure random 256-bit AES key.

    Returns:
        32-byte AES-256 key.
    """

    return AESGCM.generate_key(
        bit_length=256
    )


# =========================================================
# Encrypt Data
# =========================================================

def encrypt_data(
    data: bytes,
    key: bytes
) -> bytes:
    """
    Encrypt file data using AES-256-GCM.

    The returned data contains:
        nonce + encrypted data

    Args:
        data: Original file data.
        key: 32-byte AES-256 key.

    Returns:
        Encrypted data.
    """

    if len(key) != 32:
        raise ValueError(
            "AES-256 key must be exactly 32 bytes."
        )

    aesgcm = AESGCM(key)

    # AES-GCM uses a 12-byte nonce
    nonce = os.urandom(12)

    # Encrypt the data
    encrypted_data = aesgcm.encrypt(
        nonce,
        data,
        None
    )

    # Store nonce together with ciphertext
    return nonce + encrypted_data


# =========================================================
# Decrypt Data
# =========================================================

def decrypt_data(
    encrypted_data: bytes,
    key: bytes
) -> bytes:
    """
    Decrypt data encrypted using AES-256-GCM.

    The encrypted data must contain:
        nonce + encrypted data

    Args:
        encrypted_data: Encrypted file data.
        key: 32-byte AES-256 key.

    Returns:
        Original decrypted data.
    """

    if len(key) != 32:
        raise ValueError(
            "AES-256 key must be exactly 32 bytes."
        )

    if len(encrypted_data) < 12:
        raise ValueError(
            "Encrypted data is invalid."
        )

    # Extract the 12-byte nonce
    nonce = encrypted_data[:12]

    # Extract the encrypted content
    ciphertext = encrypted_data[12:]

    aesgcm = AESGCM(key)

    # Decrypt and authenticate
    return aesgcm.decrypt(
        nonce,
        ciphertext,
        None
    )