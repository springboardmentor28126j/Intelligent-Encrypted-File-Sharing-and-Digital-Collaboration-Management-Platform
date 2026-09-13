import os
import json
import base64
from pathlib import Path

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from decouple import config

from app.database import engine
from sqlalchemy import text


# ============================================================
# ENCRYPTED LOCAL KEY STORE
# ============================================================

KEY_STORE_DIR = (
    Path(__file__).resolve().parent / "key_store"
)

KEY_STORE_FILE = (
    KEY_STORE_DIR / "protected_keys.enc"
)


# ============================================================
# MASTER ENCRYPTION KEY
# ============================================================

MASTER_ENCRYPTION_KEY = config(
    "MASTER_ENCRYPTION_KEY",
    default=""
)

if not MASTER_ENCRYPTION_KEY:
    raise RuntimeError(
        "MASTER_ENCRYPTION_KEY is missing from .env"
    )


try:
    MASTER_KEY_BYTES = base64.b64decode(
        MASTER_ENCRYPTION_KEY
    )

except Exception as e:
    raise RuntimeError(
        "MASTER_ENCRYPTION_KEY is not valid Base64"
    ) from e


if len(MASTER_KEY_BYTES) != 32:
    raise RuntimeError(
        "MASTER_ENCRYPTION_KEY must decode to exactly 32 bytes"
    )


# ============================================================
# LOAD KEY STORE
# ============================================================

def _load_store():
    """
    Loads the encrypted local key store.

    The key store contains:
        reference -> protected file key
    """

    if not KEY_STORE_FILE.exists():
        return {}

    raw = KEY_STORE_FILE.read_bytes()

    if len(raw) < 13:
        raise RuntimeError(
            "Key store file is invalid or corrupted"
        )

    nonce = raw[:12]
    ciphertext = raw[12:]

    plaintext = AESGCM(
        MASTER_KEY_BYTES
    ).decrypt(
        nonce,
        ciphertext,
        b"trustshare-key-store"
    )

    return json.loads(
        plaintext.decode("utf-8")
    )


# ============================================================
# SAVE KEY STORE
# ============================================================

def _save_store(store):
    """
    Encrypts and saves the complete key store.
    """

    KEY_STORE_DIR.mkdir(
        parents=True,
        exist_ok=True
    )

    plaintext = json.dumps(
        store
    ).encode("utf-8")

    nonce = os.urandom(12)

    ciphertext = AESGCM(
        MASTER_KEY_BYTES
    ).encrypt(
        nonce,
        plaintext,
        b"trustshare-key-store"
    )

    temp_file = KEY_STORE_FILE.with_suffix(
        ".tmp"
    )

    temp_file.write_bytes(
        nonce + ciphertext
    )

    temp_file.replace(
        KEY_STORE_FILE
    )


# ============================================================
# SAVE PROTECTED KEY
# ============================================================

def save_protected_key(
    reference: str,
    protected_key: str
):
    """
    Stores a protected file encryption key.

    The actual AES file key is never stored directly.
    """

    store = _load_store()

    store[reference] = protected_key

    _save_store(store)


# ============================================================
# GET PROTECTED KEY
# ============================================================

def get_protected_key(
    reference: str
):
    """
    Retrieves a protected file key.
    """

    store = _load_store()

    return store.get(reference)


# ============================================================
# DELETE PROTECTED KEY
# ============================================================

def delete_protected_key(
    reference: str
):
    """
    Removes a protected key from the local key store.
    """

    store = _load_store()

    if reference in store:
        del store[reference]
        _save_store(store)

        return True

    return False


# ============================================================
# COMPATIBILITY FUNCTIONS
# ============================================================
#
# These functions allow main.py to use simple names:
#
#     save_file_key()
#     get_file_key()
#     delete_file_key()
#
# while keeping the original key-store implementation.
# ============================================================

def save_file_key(
    reference: str,
    protected_key: str
):
    save_protected_key(
        reference,
        protected_key
    )


def get_file_key(
    reference: str
):
    return get_protected_key(
        reference
    )


def delete_file_key(
    reference: str
):
    return delete_protected_key(
        reference
    )


# ============================================================
# INITIALIZE LEGACY KEY STORE
# ============================================================

def initialize_legacy_key_store():
    """
    Migrates protected keys from legacy_files
    into the encrypted local key store.

    The new files table uses references such as:

        legacy-key:<new UUID>

    The old legacy file is matched with the
    new file using storage_key.
    """

    with engine.connect() as conn:

        rows = conn.execute(
            text(
                """
                SELECT
                    lf.id AS legacy_id,
                    lf.encrypted_key,
                    f.id AS new_file_id

                FROM legacy_files lf

                JOIN files f
                  ON f.storage_key =
                     CONCAT(
                         'trustshare/',
                         lf.owner_id,
                         '/',
                         lf.stored_filename
                     )

                WHERE lf.encrypted_key IS NOT NULL
                """
            )
        ).mappings().all()

    if not rows:
        return 0

    store = _load_store()

    added = 0

    for row in rows:

        reference = (
            f"legacy-key:{row['new_file_id']}"
        )

        if reference not in store:

            store[reference] = (
                row["encrypted_key"]
            )

            added += 1

    if added:
        _save_store(store)

    return added


# ============================================================
# MAIN TEST
# ============================================================

if __name__ == "__main__":

    count = initialize_legacy_key_store()

    print(
        f"Legacy key-store entries added: {count}"
    )

    print(
        f"Key store: {KEY_STORE_FILE}"
    )