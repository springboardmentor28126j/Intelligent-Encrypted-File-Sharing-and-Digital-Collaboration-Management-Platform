import pytest
import time
import os
from src.crypto.cipher import AESGCMCipher

def test_encryption_throughput_benchmark():
    key = AESGCMCipher.generate_key()
    data = os.urandom(5 * 1024 * 1024)  # 5 MB payload
    
    start = time.time()
    ciphertext = AESGCMCipher.encrypt_bytes(key, data)
    enc_duration = time.time() - start
    
    start = time.time()
    decrypted = AESGCMCipher.decrypt_bytes(key, ciphertext)
    dec_duration = time.time() - start
    
    assert decrypted == data
    # 5MB in under 0.25 seconds => >20MB/s throughput
    assert enc_duration < 0.25
    assert dec_duration < 0.25
