import secrets
import struct

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from key_manager import (
    generate_file_key,
    wrap_file_key,
    unwrap_file_key,
)


# =========================================================
# ENCRYPTION FORMAT
# =========================================================

MAGIC = b"TS01"


# =========================================================
# ENCRYPT DATA
# =========================================================

def encrypt_data(data: bytes) -> bytes:
    """
    Encrypt file data using:
    - unique 256-bit key per file
    - AES-256-GCM for file encryption
    - master-key wrapping for the file key

    Stored format:

    MAGIC
    WRAP_NONCE
    WRAPPED_FILE_KEY_LENGTH
    WRAPPED_FILE_KEY
    FILE_NONCE
    CIPHERTEXT
    """

    file_key = generate_file_key()

    wrap_nonce, wrapped_file_key = wrap_file_key(
        file_key
    )

    aes = AESGCM(file_key)

    file_nonce = secrets.token_bytes(12)

    ciphertext = aes.encrypt(
        file_nonce,
        data,
        None
    )

    wrapped_key_length = len(wrapped_file_key)

    return (
        MAGIC
        + wrap_nonce
        + struct.pack(">H", wrapped_key_length)
        + wrapped_file_key
        + file_nonce
        + ciphertext
    )


# =========================================================
# DECRYPT DATA
# =========================================================

def decrypt_data(encrypted_data: bytes) -> bytes:
    """
    Recover the wrapped per-file key using the server
    master key, then decrypt the file.
    """

    minimum_size = (
        len(MAGIC)
        + 12
        + 2
        + 12
    )

    if len(encrypted_data) < minimum_size:
        raise ValueError("Invalid encrypted file")


    # -----------------------------------------------------
    # MAGIC / VERSION
    # -----------------------------------------------------

    if encrypted_data[:4] != MAGIC:
        raise ValueError(
            "Unsupported encrypted file format"
        )


    # -----------------------------------------------------
    # WRAP NONCE
    # -----------------------------------------------------

    position = 4

    wrap_nonce = encrypted_data[
        position:position + 12
    ]

    position += 12


    # -----------------------------------------------------
    # WRAPPED KEY LENGTH
    # -----------------------------------------------------

    wrapped_key_length = struct.unpack(
        ">H",
        encrypted_data[
            position:position + 2
        ]
    )[0]

    position += 2


    # -----------------------------------------------------
    # WRAPPED FILE KEY
    # -----------------------------------------------------

    wrapped_file_key = encrypted_data[
        position:
        position + wrapped_key_length
    ]

    position += wrapped_key_length


    # -----------------------------------------------------
    # FILE NONCE
    # -----------------------------------------------------

    file_nonce = encrypted_data[
        position:position + 12
    ]

    position += 12


    # -----------------------------------------------------
    # CIPHERTEXT
    # -----------------------------------------------------

    ciphertext = encrypted_data[position:]


    # -----------------------------------------------------
    # UNWRAP FILE KEY
    # -----------------------------------------------------

    file_key = unwrap_file_key(
        wrap_nonce,
        wrapped_file_key
    )


    # -----------------------------------------------------
    # DECRYPT FILE
    # -----------------------------------------------------

    aes = AESGCM(file_key)

    return aes.decrypt(
        file_nonce,
        ciphertext,
        None
    )