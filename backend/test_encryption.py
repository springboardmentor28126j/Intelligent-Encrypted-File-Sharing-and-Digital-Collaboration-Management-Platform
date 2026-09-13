from app.encryption import generate_key, encrypt_data, decrypt_data


# Original data
original_data = b"Hello, this is a TrustShare test file."


# Generate AES-256 key
key = generate_key()

print("AES-256 key generated successfully.")


# Encrypt
encrypted_data = encrypt_data(
    original_data,
    key
)

print("File encrypted successfully.")
print("Original data:", original_data)
print("Encrypted data:", encrypted_data)


# Decrypt
decrypted_data = decrypt_data(
    encrypted_data,
    key
)

print("File decrypted successfully.")
print("Decrypted data:", decrypted_data)


# Verify
if original_data == decrypted_data:
    print("SUCCESS: Original and decrypted data are the same.")
else:
    print("ERROR: Data does not match.")