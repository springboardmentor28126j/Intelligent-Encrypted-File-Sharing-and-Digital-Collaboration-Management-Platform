import os
import struct
from typing import AsyncGenerator
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

MAGIC_HEADER = b"TSENC10\x00"  # TrustShare Encryption v1.0
NONCE_LENGTH = 12
TAG_LENGTH = 16
DEFAULT_CHUNK_SIZE = 65536  # 64 KB

class AESGCMCipher:
    @staticmethod
    def generate_key() -> bytes:
        """Generates a cryptographically secure 256-bit (32 bytes) AES key."""
        return AESGCM.generate_key(bit_length=256)

    @staticmethod
    def encrypt_bytes(key: bytes, plaintext: bytes, associated_data: bytes = b"") -> bytes:
        """Encrypts small data payload in memory using AES-256-GCM."""
        aesgcm = AESGCM(key)
        nonce = os.urandom(NONCE_LENGTH)
        ciphertext = aesgcm.encrypt(nonce, plaintext, associated_data)
        return MAGIC_HEADER + nonce + ciphertext

    @staticmethod
    def decrypt_bytes(key: bytes, encrypted_payload: bytes, associated_data: bytes = b"") -> bytes:
        """Decrypts payload encrypted with encrypt_bytes."""
        if not encrypted_payload.startswith(MAGIC_HEADER):
            raise ValueError("Invalid ciphertext header: magic bytes mismatch")
        
        header_len = len(MAGIC_HEADER)
        nonce = encrypted_payload[header_len : header_len + NONCE_LENGTH]
        ciphertext = encrypted_payload[header_len + NONCE_LENGTH :]
        
        aesgcm = AESGCM(key)
        return aesgcm.decrypt(nonce, ciphertext, associated_data)

    @classmethod
    async def encrypt_stream(
        cls,
        key: bytes,
        plaintext_stream: AsyncGenerator[bytes, None],
        chunk_size: int = DEFAULT_CHUNK_SIZE
    ) -> AsyncGenerator[bytes, None]:
        """
        Encrypts a stream of bytes chunk-by-chunk using AES-256-GCM.
        Yields:
        1. Magic Header (8 bytes) + Base Nonce (12 bytes) + Chunk Size (4 bytes)
        2. Sequence Chunks: [Payload (Encrypted) + Tag (16 bytes)]
        """
        aesgcm = AESGCM(key)
        base_nonce = os.urandom(NONCE_LENGTH)
        
        # Header: MAGIC (8 bytes) + BASE_NONCE (12 bytes) + CHUNK_SIZE (4 bytes uint32)
        yield MAGIC_HEADER + base_nonce + struct.pack(">I", chunk_size)
        
        chunk_index = 0
        async for chunk in plaintext_stream:
            if not chunk:
                continue
            # Construct deterministic unique nonce per chunk by XORing sequence index into last 4 bytes
            chunk_nonce = bytearray(base_nonce)
            for i in range(4):
                chunk_nonce[8 + i] ^= (chunk_index >> (8 * (3 - i))) & 0xFF
            
            # Encrypt chunk with associated data = chunk index
            aad = struct.pack(">Q", chunk_index)
            encrypted_chunk = aesgcm.encrypt(bytes(chunk_nonce), chunk, aad)
            
            # Prefix each chunk with its encrypted length (4 bytes uint32)
            chunk_len = len(encrypted_chunk)
            yield struct.pack(">I", chunk_len) + encrypted_chunk
            chunk_index += 1

    @classmethod
    async def decrypt_stream(
        cls,
        key: bytes,
        encrypted_stream: AsyncGenerator[bytes, None]
    ) -> AsyncGenerator[bytes, None]:
        """
        Decrypts an encrypted stream produced by encrypt_stream.
        Decryption occurs purely in-memory chunk-by-chunk.
        """
        aesgcm = AESGCM(key)
        buffer = bytearray()
        
        header_read = False
        base_nonce = b""
        chunk_size = DEFAULT_CHUNK_SIZE
        chunk_index = 0
        
        header_size = len(MAGIC_HEADER) + NONCE_LENGTH + 4

        async for raw_bytes in encrypted_stream:
            buffer.extend(raw_bytes)
            
            if not header_read:
                if len(buffer) < header_size:
                    continue
                header = bytes(buffer[:header_size])
                del buffer[:header_size]
                
                magic = header[:len(MAGIC_HEADER)]
                if magic != MAGIC_HEADER:
                    raise ValueError("Invalid encrypted stream: magic header mismatch")
                    
                base_nonce = header[len(MAGIC_HEADER) : len(MAGIC_HEADER) + NONCE_LENGTH]
                chunk_size = struct.unpack(">I", header[len(MAGIC_HEADER) + NONCE_LENGTH:])[0]
                header_read = True

            # Process chunks in buffer
            while len(buffer) >= 4:
                expected_len = struct.unpack(">I", buffer[:4])[0]
                total_needed = 4 + expected_len
                if len(buffer) < total_needed:
                    break
                
                encrypted_chunk = bytes(buffer[4:total_needed])
                del buffer[:total_needed]
                
                chunk_nonce = bytearray(base_nonce)
                for i in range(4):
                    chunk_nonce[8 + i] ^= (chunk_index >> (8 * (3 - i))) & 0xFF
                    
                aad = struct.pack(">Q", chunk_index)
                decrypted_chunk = aesgcm.decrypt(bytes(chunk_nonce), encrypted_chunk, aad)
                yield decrypted_chunk
                chunk_index += 1
