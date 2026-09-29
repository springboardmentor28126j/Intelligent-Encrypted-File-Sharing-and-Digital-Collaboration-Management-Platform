from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import os

KEY_DIR = "encryption_keys"
os.makedirs(KEY_DIR, exist_ok=True)


def generate_key():
    """Generate a true AES-256 key (32 bytes = 256 bits)."""
    return AESGCM.generate_key(bit_length=256)


def save_key(stored_name, key):
    """Save the encryption key to a local key store, keyed by the stored filename.
    Keys are only ever kept on the server, never sent to the client."""
    key_path = os.path.join(KEY_DIR, f"{stored_name}.key")
    with open(key_path, "wb") as f:
        f.write(key)


def load_key(stored_name):
    """Load the encryption key for a given stored filename."""
    key_path = os.path.join(KEY_DIR, f"{stored_name}.key")
    if not os.path.exists(key_path):
        return None
    with open(key_path, "rb") as f:
        return f.read()


def delete_key(stored_name):
    """Remove a key file (used when a file is deleted)."""
    key_path = os.path.join(KEY_DIR, f"{stored_name}.key")
    if os.path.exists(key_path):
        os.remove(key_path)


def encrypt_file_bytes(file_bytes, key):
    """
    Encrypt raw file bytes with AES-256-GCM.
    A random 12-byte nonce is generated per file and stored alongside
    the ciphertext (prepended) so it can be retrieved for decryption.
    GCM also provides integrity/authentication, not just confidentiality.
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