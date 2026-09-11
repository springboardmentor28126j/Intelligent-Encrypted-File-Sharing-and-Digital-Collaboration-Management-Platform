import pytest
import os
from src.crypto.cipher import AESGCMCipher, MAGIC_HEADER
from src.crypto.key_manager import KeyManager

@pytest.mark.asyncio
async def test_aes_gcm_byte_encryption_decryption():
    key = AESGCMCipher.generate_key()
    plaintext = b"TrustShare confidential collaboration document 2026."
    
    ciphertext = AESGCMCipher.encrypt_bytes(key, plaintext, associated_data=b"AUTH_HEADER")
    assert ciphertext.startswith(MAGIC_HEADER)
    assert ciphertext != plaintext
    
    decrypted = AESGCMCipher.decrypt_bytes(key, ciphertext, associated_data=b"AUTH_HEADER")
    assert decrypted == plaintext

@pytest.mark.asyncio
async def test_aes_gcm_streaming_encryption_decryption():
    key = AESGCMCipher.generate_key()
    original_data = b"Chunk payload data " * 5000  # ~95 KB payload
    
    async def plaintext_gen():
        chunk_size = 16384
        for i in range(0, len(original_data), chunk_size):
            yield original_data[i : i + chunk_size]
            
    # Encrypt stream
    encrypted_chunks = []
    async for enc_chunk in AESGCMCipher.encrypt_stream(key, plaintext_gen(), chunk_size=16384):
        encrypted_chunks.append(enc_chunk)
        
    encrypted_payload = b"".join(encrypted_chunks)
    assert encrypted_payload.startswith(MAGIC_HEADER)
    
    # Decrypt stream
    async def encrypted_gen():
        chunk_size = 8192
        for i in range(0, len(encrypted_payload), chunk_size):
            yield encrypted_payload[i : i + chunk_size]
            
    decrypted_chunks = []
    async for dec_chunk in AESGCMCipher.decrypt_stream(key, encrypted_gen()):
        decrypted_chunks.append(dec_chunk)
        
    decrypted_payload = b"".join(decrypted_chunks)
    assert decrypted_payload == original_data

def test_key_manager_envelope_wrapping():
    km = KeyManager()
    raw_dek, encrypted_dek = km.create_file_key()
    assert len(raw_dek) == 32
    assert encrypted_dek != raw_dek
    
    unwrapped = km.unwrap_file_key(encrypted_dek)
    assert unwrapped == raw_dek
