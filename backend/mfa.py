"""
TrustShare MFA helpers (TOTP / authenticator-app based).

Compatible with Google Authenticator, Microsoft Authenticator, Authy,
1Password, etc. Also provides one-time backup (recovery) codes.
"""

import base64
import hashlib
import io
import json
import re
import secrets

import pyotp
import qrcode

ISSUER = "TrustShare"
BACKUP_CODE_COUNT = 8


# ---------------------------------------------------------
# TOTP
# ---------------------------------------------------------

def generate_secret() -> str:
    """New random base32 secret (32 chars)."""
    return pyotp.random_base32()


def provisioning_uri(secret: str, email: str) -> str:
    return pyotp.TOTP(secret).provisioning_uri(
        name=email,
        issuer_name=ISSUER
    )


def qr_data_uri(uri: str) -> str:
    """QR code for the otpauth:// URI as a data: URI (PNG)."""
    image = qrcode.make(uri)
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
    return f"data:image/png;base64,{encoded}"


def normalize_code(code: str | None) -> str:
    return re.sub(r"[\s-]", "", code or "")


def verify_totp(secret: str | None, code: str | None) -> bool:
    """Accept the current 30s code +/- one step (clock drift)."""
    if not secret:
        return False

    code = normalize_code(code)

    if not (code.isdigit() and len(code) == 6):
        return False

    return bool(pyotp.TOTP(secret).verify(code, valid_window=1))


# ---------------------------------------------------------
# BACKUP CODES (stored only as SHA-256 hashes)
# ---------------------------------------------------------

def _hash_backup_code(code: str) -> str:
    return hashlib.sha256(
        normalize_code(code).lower().encode("utf-8")
    ).hexdigest()


def generate_backup_codes():
    """
    Returns (plain_codes, json_of_hashes).
    Plain codes look like 'a3f9-82c1' and are shown to the user once.
    """
    plain = []

    for _ in range(BACKUP_CODE_COUNT):
        raw = secrets.token_hex(4)
        plain.append(f"{raw[:4]}-{raw[4:]}")

    hashes = [_hash_backup_code(c) for c in plain]

    return plain, json.dumps(hashes)


def consume_backup_code(stored_json: str | None, code: str | None):
    """
    If `code` matches an unused backup code, returns the updated JSON
    (with that code removed). Otherwise returns None.
    """
    if not stored_json or not code:
        return None

    try:
        hashes = json.loads(stored_json)
    except ValueError:
        return None

    candidate = _hash_backup_code(code)

    for stored in hashes:
        if secrets.compare_digest(stored, candidate):
            hashes.remove(stored)
            return json.dumps(hashes)

    return None


def remaining_backup_codes(stored_json: str | None) -> int:
    try:
        return len(json.loads(stored_json)) if stored_json else 0
    except ValueError:
        return 0
