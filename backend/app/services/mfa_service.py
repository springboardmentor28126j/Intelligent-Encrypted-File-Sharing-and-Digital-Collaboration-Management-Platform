import pyotp

ISSUER_NAME = "TrustShare"


def generate_mfa_secret() -> str:
    return pyotp.random_base32()


def build_provisioning_uri(email: str, secret: str) -> str:
    return pyotp.TOTP(secret).provisioning_uri(name=email, issuer_name=ISSUER_NAME)


def verify_totp_code(secret: str | None, code: str | None) -> bool:
    if not secret or not code:
        return False
    normalized = str(code).strip()
    if not normalized.isdigit() or len(normalized) != 6:
        return False
    return pyotp.TOTP(secret).verify(normalized, valid_window=1)
