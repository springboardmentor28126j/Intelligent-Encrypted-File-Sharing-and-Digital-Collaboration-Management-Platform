from app.encryption import generate_key
from app.key_manager import encrypt_file_key, decrypt_file_key


# Generate a new AES-256 file key
original_key = generate_key()

print("AES-256 file key generated successfully.")


# Protect the file key using the master key
protected_key = encrypt_file_key(original_key)

print("File key protected successfully.")


# Recover the original file key
recovered_key = decrypt_file_key(protected_key)

print("File key recovered successfully.")


# Check whether both keys match
if original_key == recovered_key:
    print("SUCCESS: Original and recovered keys match.")
else:
    print("ERROR: Keys do not match.")