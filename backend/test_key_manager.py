from key_manager import (
    generate_file_key,
    generate_new_master_key,
    get_key_fingerprint
)


# Generate key for File 1
key1 = generate_file_key()

# Generate key for File 2
key2 = generate_file_key()

print("File 1 key length:", len(key1) * 8, "bits")
print("File 2 key length:", len(key2) * 8, "bits")

print(
    "File 1 fingerprint:",
    get_key_fingerprint(key1)
)

print(
    "File 2 fingerprint:",
    get_key_fingerprint(key2)
)

if key1 != key2:
    print("Unique file keys: PASSED")
else:
    print("Unique file keys: FAILED")


# Test master-key rotation
new_master_key = generate_new_master_key()

print(
    "New master key generated successfully."
)

if len(new_master_key) > 0:
    print("Key rotation generation: PASSED")
    