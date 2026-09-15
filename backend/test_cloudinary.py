from encryption import encrypt_file
from cloudinary_storage import upload_encrypted_file


# Test file data
data = b"Hello Trust Share Cloudinary"


# Encrypt the data using AES-256-GCM
encrypted_data = encrypt_file(data)

print("File encrypted successfully.")


# Upload encrypted data to Cloudinary
result = upload_encrypted_file(
    encrypted_data,
    "trust_share_test"
)


print("Cloudinary upload successful.")
print("Public ID:", result.get("public_id"))
print("Resource type:", result.get("resource_type"))