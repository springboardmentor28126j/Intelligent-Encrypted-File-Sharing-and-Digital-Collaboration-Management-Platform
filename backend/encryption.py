from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import os


def generate_key():
    """Generate a true AES-256 key (32 bytes = 256 bits)."""
    return AESGCM.generate_key(bit_length=256)


def encrypt_file_bytes(file_bytes, key):
    """
    Encrypt raw file bytes with AES-256-GCM.
    A random 12-byte nonce is generated per file and stored alongside
    the ciphertext (prepended) so it can be retrieved for decryption.
    """
    aesgcm = AESGCM(key)
    nonce = os.urandom(12)
    ciphertext = aesgcm.encrypt(nonce, file_bytes, None)
    return nonce + ciphertext


def decrypt_file_bytes(encrypted_bytes, key):
    """Split the stored nonce back off and decrypt the ciphertext."""
    aesgcm = AESGCM(key)
    nonce = encrypted_bytes[:12]
    ciphertext = encrypted_bytes[12:]
    return aesgcm.decrypt(nonce, ciphertext, None)