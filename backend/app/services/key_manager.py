"""
key_manager.py – Encryption Key Management & Envelope Encryption Service.

Implements:
  - Envelope encryption pattern:
      1. Generates unique 256-bit Data Encryption Keys (DEKs) per uploaded file.
      2. Protects per-file DEKs using a Master Key / Key Encryption Key (KEK).
      3. Stores encrypted DEKs alongside file metadata.
  - Abstract KeyManager interface enabling seamless transition to AWS KMS / Azure Key Vault / HashiCorp Vault.
  - Clean separation: Encryption keys are strictly server-side and never returned through API endpoints.
"""

from abc import ABC, abstractmethod
import base64
import os
import secrets
from typing import Optional
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from app.config import settings


class KeyManagerBase(ABC):
    """Abstract Base Class for Key Management Services."""

    @abstractmethod
    def generate_dek(self) -> bytes:
        """Generate a cryptographically secure 256-bit Data Encryption Key (DEK)."""
        pass

    @abstractmethod
    def encrypt_dek(self, dek: bytes) -> str:
        """
        Encrypt a DEK using the Key Encryption Key (KEK) / Master Key.
        Returns a base64-encoded encrypted payload string (nonce + encrypted DEK).
        """
        pass

    @abstractmethod
    def decrypt_dek(self, encrypted_dek_str: str) -> bytes:
        """
        Decrypt an encrypted DEK payload using the Key Encryption Key (KEK).
        Returns the original 32-byte plaintext DEK.
        """
        pass


class EnvelopeKeyManager(KeyManagerBase):
    """
    Standard Envelope Key Manager using AES-256-GCM Master Key.
    Loads 256-bit KEK from MASTER_KEY_HEX environment variable.
    """

    def __init__(self, master_key_hex: Optional[str] = None):
        hex_key = master_key_hex or settings.MASTER_KEY_HEX
        try:
            self._kek = bytes.fromhex(hex_key.strip())
        except Exception:
            # Fallback if invalid hex: derive 32 bytes via sha256
            import hashlib
            self._kek = hashlib.sha256(hex_key.encode("utf-8")).digest()

        if len(self._kek) != 32:
            import hashlib
            self._kek = hashlib.sha256(self._kek).digest()

        self._aesgcm = AESGCM(self._kek)

    def generate_dek(self) -> bytes:
        """Generate a random 32-byte (256-bit) Data Encryption Key."""
        return secrets.token_bytes(32)

    def encrypt_dek(self, dek: bytes) -> str:
        """
        Encrypt the 32-byte DEK with the Master KEK.
        Format: base64( 12-byte-nonce + ciphertext-with-tag )
        """
        if len(dek) != 32:
            raise ValueError(f"DEK must be 32 bytes, got {len(dek)}")

        nonce = os.urandom(12)
        encrypted_bytes = self._aesgcm.encrypt(nonce, dek, None)
        combined = nonce + encrypted_bytes
        return base64.b64encode(combined).decode("utf-8")

    def decrypt_dek(self, encrypted_dek_str: str) -> bytes:
        """
        Decrypt the base64-encoded payload to retrieve the 32-byte DEK.
        """
        combined = base64.b64decode(encrypted_dek_str.encode("utf-8"))
        if len(combined) < 12 + 16:
            raise ValueError("Invalid encrypted DEK length.")

        nonce = combined[:12]
        ciphertext = combined[12:]
        return self._aesgcm.decrypt(nonce, ciphertext, None)


# Singleton key manager instance
key_manager: KeyManagerBase = EnvelopeKeyManager()
