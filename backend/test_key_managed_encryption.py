
from encryption import (
    encrypt_data,
    decrypt_data
)


# =========================================================
# ORIGINAL DATA
# =========================================================

original_data = (
    b"TrustShare key management test"
)


# =========================================================
# ENCRYPT
# =========================================================

encrypted_data = encrypt_data(
    original_data
)

print("Encryption successful.")
print("Encrypted size:", len(encrypted_data))


# =========================================================
# DECRYPT
# =========================================================

decrypted_data = decrypt_data(
    encrypted_data
)

print("Decryption successful.")
print(
    "Decrypted data:",
    decrypted_data
)


# =========================================================
# VERIFY
# =========================================================

if decrypted_data == original_data:
    print(
        "KEY-MANAGED AES-256 TEST PASSED"
    )
else:
    print(
        "KEY-MANAGED AES-256 TEST FAILED"
    )