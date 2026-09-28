from encryption import (
    generate_key,
    encrypt_data,
    decrypt_data
)


# Original file data
original_data = b"TrustShare AES-256 encryption test"


# Generate unique AES-256 key
key = generate_key()

print("Key generated successfully.")
print("Key size:", len(key) * 8, "bits")


# Encrypt
encrypted_data = encrypt_data(
    original_data,
    key
)

print("Encryption successful.")
print("Original size:", len(original_data))
print("Encrypted size:", len(encrypted_data))


# Decrypt
decrypted_data = decrypt_data(
    encrypted_data,
    key
)

print("Decryption successful.")
print("Decrypted data:", decrypted_data)


# Verify
if decrypted_data == original_data:
    print("AES-256 TEST PASSED")
else:
    print("AES-256 TEST FAILED")