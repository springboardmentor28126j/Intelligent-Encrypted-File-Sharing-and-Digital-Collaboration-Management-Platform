import base64
import os
from src.core.config import settings
from src.crypto.cipher import AESGCMCipher

class KeyManager:
    """
    Key Management Service:
    - Generates unique Data Encryption Keys (DEKs) per file.
    - Encrypts DEK using Master Key Encryption Key (KEK) via envelope encryption.
    - Stores encrypted DEK and IV safely in PostgreSQL.
    """
    def __init__(self, master_kek_hex_or_b64: str = settings.MASTER_KEK):
        try:
            if len(master_kek_hex_or_b64) == 64:
                self.master_kek = bytes.fromhex(master_kek_hex_or_b64)
            else:
                self.master_kek = base64.b64decode(master_kek_hex_or_b64)
        except Exception:
            # Fallback 32-byte key derived if formatted incorrectly
            self.master_kek = master_kek_hex_or_b64.encode().ljust(32, b"0")[:32]

    def create_file_key(self) -> tuple[bytes, bytes]:
        """
        Generates a fresh 256-bit DEK and returns (raw_dek, encrypted_dek).
        """
        raw_dek = AESGCMCipher.generate_key()
        encrypted_dek = AESGCMCipher.encrypt_bytes(self.master_kek, raw_dek, associated_data=b"DEK_WRAP")
        return raw_dek, encrypted_dek

    def unwrap_file_key(self, encrypted_dek: bytes) -> bytes:
        """
        Decrypts an envelope-wrapped DEK using the Master KEK.
        """
        return AESGCMCipher.decrypt_bytes(self.master_kek, encrypted_dek, associated_data=b"DEK_WRAP")

key_manager = KeyManager()
