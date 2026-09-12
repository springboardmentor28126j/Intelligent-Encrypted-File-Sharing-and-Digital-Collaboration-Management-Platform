"""
crypto_service.py – AES-256-GCM Server-Side Encryption and Decryption Service.

Implements:
  - NIST-approved AES-256 in Galois/Counter Mode (AES-256-GCM) authenticated encryption.
  - 256-bit (32-byte) symmetric key support.
  - 96-bit (12-byte) standard unique nonce generation per encryption operation.
  - Integrated authentication tag validation (tamper protection).
  - Stream and in-memory byte encryption/decryption.
"""

import os
from typing import Optional, Tuple
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.exceptions import InvalidTag
from fastapi import HTTPException, status


class CryptoService:
    """
    AES-256-GCM Cryptographic Service.
    Provides authenticated encryption and decryption for file contents.
    """

    NONCE_LENGTH_BYTES = 12  # Standard 96-bit nonce for AES-GCM
    KEY_LENGTH_BYTES = 32    # 256 bits

    @staticmethod
    def generate_nonce() -> bytes:
        """Generate a cryptographically secure 96-bit (12-byte) random nonce."""
        return os.urandom(CryptoService.NONCE_LENGTH_BYTES)

    @classmethod
    def encrypt(
        cls,
        plaintext: bytes,
        key: bytes,
        associated_data: Optional[bytes] = None,
        nonce: Optional[bytes] = None,
    ) -> Tuple[bytes, bytes]:
        """
        Encrypt plaintext using AES-256-GCM.

        Args:
            plaintext: Raw data bytes to encrypt.
            key: 256-bit (32-byte) Data Encryption Key (DEK).
            associated_data: Optional authenticated data (AAD) bound to the ciphertext.
            nonce: Optional 12-byte nonce (if not provided, a secure random one is generated).

        Returns:
            Tuple of (ciphertext_with_auth_tag, nonce_bytes).
        """
        if len(key) != cls.KEY_LENGTH_BYTES:
            raise ValueError(f"AES-256 requires a 32-byte key, got {len(key)} bytes.")

        if nonce is None:
            nonce = cls.generate_nonce()
        elif len(nonce) != cls.NONCE_LENGTH_BYTES:
            raise ValueError(f"AES-GCM requires a 12-byte nonce, got {len(nonce)} bytes.")

        aesgcm = AESGCM(key)
        ciphertext = aesgcm.encrypt(nonce, plaintext, associated_data)
        return ciphertext, nonce

    @classmethod
    def decrypt(
        cls,
        ciphertext: bytes,
        key: bytes,
        nonce: bytes,
        associated_data: Optional[bytes] = None,
    ) -> bytes:
        """
        Decrypt ciphertext using AES-256-GCM and verify authenticity tag.

        Args:
            ciphertext: Encrypted payload bytes (including 16-byte GCM tag).
            key: 256-bit (32-byte) Data Encryption Key (DEK).
            nonce: 12-byte nonce used during encryption.
            associated_data: Optional authenticated data (AAD).

        Returns:
            Decrypted plaintext bytes.

        Raises:
            HTTPException 400/500 if decryption or tag verification fails.
        """
        if len(key) != cls.KEY_LENGTH_BYTES:
            raise ValueError(f"AES-256 requires a 32-byte key, got {len(key)} bytes.")

        if len(nonce) != cls.NONCE_LENGTH_BYTES:
            raise ValueError(f"AES-GCM requires a 12-byte nonce, got {len(nonce)} bytes.")

        aesgcm = AESGCM(key)
        try:
            plaintext = aesgcm.decrypt(nonce, ciphertext, associated_data)
            return plaintext
        except InvalidTag:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Decryption failed: Integrity check failed. Ciphertext has been altered or key is invalid.",
            )
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Cryptographic decryption error: {exc}",
            )


# Default singleton instance
crypto_service = CryptoService()
