"""
Multi-factor authentication using TOTP.

For the current demo, MFA settings are stored temporarily
in backend memory so the shared database schema is not changed.
"""

import base64
import io

import pyotp
import qrcode

from app.core.config import settings


# Temporary in-memory MFA storage.
# Key = user UUID as string
# Value = {"secret": "...", "enabled": True/False}
MFA_STORE = {}


def generate_secret() -> str:
    return pyotp.random_base32()


def get_provisioning_uri(secret: str, email: str) -> str:
    return pyotp.totp.TOTP(secret).provisioning_uri(
        name=email,
        issuer_name=settings.APP_NAME
    )


def verify_code(secret: str, code: str) -> bool:
    totp = pyotp.TOTP(secret)

    # Allows previous/next 30-second window for small clock differences.
    return totp.verify(code, valid_window=1)


def qr_code_data_uri(provisioning_uri: str) -> str:
    """Return a base64 PNG data URI for the QR code."""
    img = qrcode.make(provisioning_uri)

    buf = io.BytesIO()
    img.save(buf, format="PNG")

    encoded = base64.b64encode(buf.getvalue()).decode()

    return f"data:image/png;base64,{encoded}"


def save_secret(user_id: str, secret: str):
    MFA_STORE[str(user_id)] = {
        "secret": secret,
        "enabled": False,
    }


def get_secret(user_id: str):
    data = MFA_STORE.get(str(user_id))
    if not data:
        return None
    return data["secret"]


def enable_mfa(user_id: str):
    user_id = str(user_id)

    if user_id not in MFA_STORE:
        return False

    MFA_STORE[user_id]["enabled"] = True
    return True


def disable_mfa(user_id: str):
    user_id = str(user_id)

    if user_id in MFA_STORE:
        del MFA_STORE[user_id]


def is_enabled(user_id: str) -> bool:
    data = MFA_STORE.get(str(user_id))
    return bool(data and data.get("enabled"))