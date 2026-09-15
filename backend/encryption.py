import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from key_manager import get_encryption_key


# =========================================================
# LOAD AES-256 KEY
# =========================================================

key = get_encryption_key()


# =========================================================
# CREATE AES-256-GCM CIPHER
# =========================================================

aesgcm = AESGCM(key)


# =========================================================
# ENCRYPT FILE
# =========================================================

def encrypt_file(file_data: bytes) -> bytes:

    # Generate a unique 12-byte nonce
    nonce = os.urandom(12)

    # Encrypt the file
    encrypted_data = aesgcm.encrypt(
        nonce,
        file_data,
        None
    )

    # Store nonce together with encrypted data
    return nonce + encrypted_data


# =========================================================
# DECRYPT FILE
# =========================================================

def decrypt_file(encrypted_data: bytes) -> bytes:

    # Check that encrypted data contains nonce
    if len(encrypted_data) < 12:
        raise ValueError(
            "Invalid encrypted file data."
        )

    # First 12 bytes are the nonce
    nonce = encrypted_data[:12]

    # Remaining bytes are ciphertext + authentication tag
    ciphertext = encrypted_data[12:]

    # Decrypt the file
    decrypted_data = aesgcm.decrypt(
        nonce,
        ciphertext,
        None
    )

    return decrypted_data