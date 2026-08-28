"""
Master key rotation script.

Per the spec's Key Management requirements: "Periodic key rotation improves
security." This does NOT re-encrypt file contents (that would mean
downloading, decrypting, and re-uploading every file - expensive and
unnecessary). Instead, it rotates the MASTER key used to wrap each file's
individual AES-256 key:

  1. Unwrap every file's per-file key using the OLD master key.
  2. Re-wrap it using the NEW master key.
  3. Update the `wrapped_key` column in the database.

The actual file ciphertext on disk/S3 never changes - only the DB-stored
wrapped key does. This limits the blast radius of a compromised master key
without the cost of re-encrypting your entire file storage.

Usage:
    cd backend
    OLD_MASTER_KEY="current-value-from-.env" \
    NEW_MASTER_KEY="freshly-generated-value" \
    python scripts/rotate_master_key.py

Generate a new key with:
    python -c "import base64,os; print(base64.urlsafe_b64encode(os.urandom(32)).decode())"

After running successfully, update MASTER_ENCRYPTION_KEY in your .env / secrets
manager to NEW_MASTER_KEY and restart the backend.
"""
import base64
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from cryptography.hazmat.primitives.ciphers.aead import AESGCM  # noqa: E402

from app.core.database import SessionLocal  # noqa: E402
from app.models.file_record import FileRecord  # noqa: E402


def _key_bytes(raw_value: str) -> bytes:
    raw = raw_value.encode()
    try:
        decoded = base64.urlsafe_b64decode(raw)
        if len(decoded) == 32:
            return decoded
    except Exception:
        pass
    return (raw * 32)[:32]


def unwrap(wrapped_key_b64: str, master_key: bytes) -> bytes:
    aesgcm = AESGCM(master_key)
    raw = base64.urlsafe_b64decode(wrapped_key_b64)
    nonce, wrapped = raw[:12], raw[12:]
    return aesgcm.decrypt(nonce, wrapped, None)


def wrap(file_key: bytes, master_key: bytes) -> str:
    aesgcm = AESGCM(master_key)
    nonce = os.urandom(12)
    wrapped = aesgcm.encrypt(nonce, file_key, None)
    return base64.urlsafe_b64encode(nonce + wrapped).decode()


def main():
    old_key_raw = os.environ.get("OLD_MASTER_KEY")
    new_key_raw = os.environ.get("NEW_MASTER_KEY")
    if not old_key_raw or not new_key_raw:
        print("ERROR: set OLD_MASTER_KEY and NEW_MASTER_KEY environment variables.")
        sys.exit(1)
    if old_key_raw == new_key_raw:
        print("ERROR: OLD_MASTER_KEY and NEW_MASTER_KEY must be different.")
        sys.exit(1)

    old_master = _key_bytes(old_key_raw)
    new_master = _key_bytes(new_key_raw)

    db = SessionLocal()
    files = db.query(FileRecord).all()
    print(f"Found {len(files)} file(s) to rotate.")

    rotated, failed = 0, 0
    for record in files:
        try:
            file_key = unwrap(record.wrapped_key, old_master)
            record.wrapped_key = wrap(file_key, new_master)
            rotated += 1
        except Exception as e:
            print(f"  FAILED to rotate file id={record.id} ({record.filename}): {e}")
            failed += 1

    if failed:
        print(f"\n{failed} file(s) failed to rotate - rolling back ALL changes to be safe.")
        db.rollback()
        sys.exit(1)

    db.commit()
    db.close()
    print(f"\nSuccessfully rotated {rotated} file(s).")
    print("Now update MASTER_ENCRYPTION_KEY in your .env to the NEW_MASTER_KEY value and restart the backend.")


if __name__ == "__main__":
    main()
