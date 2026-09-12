"""
test_crypto.py – Comprehensive unit tests for AES-256-GCM encryption and Envelope Key Management.
"""

import os
import pytest
from fastapi import HTTPException
from app.services.crypto_service import CryptoService, crypto_service
from app.services.key_manager import EnvelopeKeyManager, key_manager


def test_aes_gcm_encrypt_decrypt_success():
    """Verify AES-256-GCM encrypts plaintext and decrypts accurately."""
    key = os.urandom(32)
    plaintext = b"Top secret confidential report data for TrustShare"
    
    ciphertext, nonce = crypto_service.encrypt(plaintext, key=key)
    
    assert len(nonce) == 12
    assert ciphertext != plaintext
    
    decrypted = crypto_service.decrypt(ciphertext, key=key, nonce=nonce)
    assert decrypted == plaintext


def test_aes_gcm_tamper_detection():
    """Tampering with even 1 byte in ciphertext should trigger authentication tag failure."""
    key = os.urandom(32)
    plaintext = b"Sensitive financial records"
    ciphertext, nonce = crypto_service.encrypt(plaintext, key=key)
    
    # Tamper with the ciphertext
    tampered = bytearray(ciphertext)
    tampered[0] ^= 0xFF
    
    with pytest.raises(HTTPException) as exc_info:
        crypto_service.decrypt(bytes(tampered), key=key, nonce=nonce)
    assert exc_info.value.status_code == 400
    assert "Integrity check failed" in exc_info.value.detail


def test_aes_gcm_invalid_key_rejection():
    """Decrypting with wrong key must fail integrity check."""
    key1 = os.urandom(32)
    key2 = os.urandom(32)
    plaintext = b"Hello TrustShare"
    
    ciphertext, nonce = crypto_service.encrypt(plaintext, key=key1)
    
    with pytest.raises(HTTPException) as exc_info:
        crypto_service.decrypt(ciphertext, key=key2, nonce=nonce)
    assert exc_info.value.status_code == 400


def test_nonce_uniqueness():
    """Each encryption operation must generate a unique nonce."""
    nonces = {crypto_service.generate_nonce() for _ in range(100)}
    assert len(nonces) == 100


def test_envelope_key_manager():
    """Verify Envelope Encryption generates unique DEKs and securely encrypts/decrypts them."""
    mgr = EnvelopeKeyManager(master_key_hex="0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef")
    
    dek1 = mgr.generate_dek()
    dek2 = mgr.generate_dek()
    assert len(dek1) == 32
    assert dek1 != dek2
    
    encrypted_dek_str = mgr.encrypt_dek(dek1)
    assert isinstance(encrypted_dek_str, str)
    assert encrypted_dek_str != dek1.hex()
    
    decrypted_dek = mgr.decrypt_dek(encrypted_dek_str)
    assert decrypted_dek == dek1
