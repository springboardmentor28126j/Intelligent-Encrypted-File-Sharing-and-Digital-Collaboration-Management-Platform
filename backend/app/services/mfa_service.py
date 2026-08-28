"""
Multi-factor authentication using TOTP (Time-based One-Time Password) -
compatible with Google Authenticator, Authy, 1Password, etc.
No external SMS/email provider needed, so it works fully offline for a demo.
"""
import base64
import io

import pyotp
import qrcode

from app.core.config import settings


def generate_secret() -> str:
    return pyotp.random_base32()


def get_provisioning_uri(secret: str, email: str) -> str:
    return pyotp.totp.TOTP(secret).provisioning_uri(
        name=email, issuer_name=settings.APP_NAME
    )


def verify_code(secret: str, code: str) -> bool:
    totp = pyotp.TOTP(secret)
    # valid_window=1 allows the previous/next 30s window for clock drift
    return totp.verify(code, valid_window=1)


def qr_code_data_uri(provisioning_uri: str) -> str:
    """Returns a base64 PNG data URI the frontend can drop straight into an <img> tag."""
    img = qrcode.make(provisioning_uri)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    encoded = base64.b64encode(buf.getvalue()).decode()
    return f"data:image/png;base64,{encoded}"
