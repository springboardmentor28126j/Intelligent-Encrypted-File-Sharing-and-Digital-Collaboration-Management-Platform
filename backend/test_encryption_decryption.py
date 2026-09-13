from app.encryption import (
    generate_key,
    encrypt_data,
    decrypt_data
)


# Original test data
original_data = b"TrustShare Milestone 2 encryption test."


# Generate AES-256 key
key = generate_key()

print("AES-256 key generated successfully.")


# Encrypt
encrypted_data = encrypt_data(
    original_data,
    key
)

print("File encrypted successfully.")


# Decrypt
decrypted_data = decrypt_data(
    encrypted_data,
    key
)

print("File decrypted successfully.")


# Display results
print("Original data:", original_data)
print("Decrypted data:", decrypted_data)


# Verify
if original_data == decrypted_data:

    print(
        "SUCCESS: Original and decrypted data are the same."
    )

else:

    print(
        "ERROR: Original and decrypted data are different."
    )