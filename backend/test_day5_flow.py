"""
Day 5 verification: MFA (TOTP) and master key rotation.

Usage:
    cd backend
    python test_day5_flow.py
"""
import base64
import os

if os.path.exists("trustshare_demo5.db"):
    os.remove("trustshare_demo5.db")
os.environ["DATABASE_URL"] = "sqlite:///./trustshare_demo5.db"
os.environ["MASTER_ENCRYPTION_KEY"] = base64.urlsafe_b64encode(os.urandom(32)).decode()
os.environ.setdefault("JWT_SECRET_KEY", "demo-jwt-secret-for-testing-only")
os.environ["LOCAL_STORAGE_DIR"] = "./storage/demo_encrypted5"

import pyotp  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from app.main import app  # noqa: E402

client = TestClient(app)


def step(label):
    print(f"\n=== {label} ===")


step("1. Register + login (MFA not yet enabled)")
r = client.post(
    "/api/auth/register",
    json={"email": "day5@trustshare.example", "full_name": "Day5 User", "password": "SuperSecret123"},
)
assert r.status_code == 201, r.text
r = client.post("/api/auth/login", data={"username": "day5@trustshare.example", "password": "SuperSecret123"})
assert r.status_code == 200 and "access_token" in r.json(), r.text
token = r.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}
print("Logged in normally, no MFA required yet.")

step("2. Set up MFA (get QR code + secret)")
r = client.post("/api/auth/mfa/setup", headers=headers)
assert r.status_code == 200, r.text
secret = r.json()["secret"]
assert r.json()["qr_code_data_uri"].startswith("data:image/png;base64,")
print("MFA secret + QR code generated.")

step("3. Enable MFA with a valid TOTP code")
code = pyotp.TOTP(secret).now()
r = client.post("/api/auth/mfa/enable", headers=headers, json={"code": code})
assert r.status_code == 200 and r.json()["mfa_enabled"] is True, r.text
print("MFA enabled on the account.")

step("4. Login now requires MFA (password alone is not enough)")
r = client.post("/api/auth/login", data={"username": "day5@trustshare.example", "password": "SuperSecret123"})
assert r.status_code == 200
assert r.json().get("mfa_required") is True, r.text
mfa_token = r.json()["mfa_token"]
print("Correctly stopped at MFA step:", r.json())

step("5. Wrong TOTP code is rejected")
r = client.post("/api/auth/mfa/verify-login", json={"mfa_token": mfa_token, "code": "000000"})
assert r.status_code == 401, r.text
print("Wrong code correctly rejected:", r.json())

step("6. Correct TOTP code completes login")
code2 = pyotp.TOTP(secret).now()
r = client.post("/api/auth/mfa/verify-login", json={"mfa_token": mfa_token, "code": code2})
assert r.status_code == 200 and "access_token" in r.json(), r.text
print("MFA login completed, real tokens issued.")

step("7. Upload a file, then rotate the master encryption key")
new_token = r.json()["access_token"]
headers = {"Authorization": f"Bearer {new_token}"}
r = client.post(
    "/api/files/upload",
    headers=headers,
    files={"upload": ("rotate_test.txt", b"content that must survive key rotation", "text/plain")},
)
assert r.status_code == 201, r.text
file_id = r.json()["id"]

r = client.get(f"/api/files/{file_id}/download", headers=headers)
assert r.content == b"content that must survive key rotation"
print("File uploaded and confirmed downloadable before rotation.")

# Run the actual rotation logic in-process (mirrors scripts/rotate_master_key.py)
from app.core.database import SessionLocal  # noqa: E402
from app.models.file_record import FileRecord  # noqa: E402
from cryptography.hazmat.primitives.ciphers.aead import AESGCM  # noqa: E402


def _kb(v):
    raw = v.encode()
    try:
        d = base64.urlsafe_b64decode(raw)
        if len(d) == 32:
            return d
    except Exception:
        pass
    return (raw * 32)[:32]


old_master = _kb(os.environ["MASTER_ENCRYPTION_KEY"])
new_master_raw = base64.urlsafe_b64encode(os.urandom(32)).decode()
new_master = _kb(new_master_raw)

db = SessionLocal()
record = db.query(FileRecord).filter(FileRecord.id == file_id).first()
aesgcm_old = AESGCM(old_master)
raw = base64.urlsafe_b64decode(record.wrapped_key)
nonce, wrapped = raw[:12], raw[12:]
file_key = aesgcm_old.decrypt(nonce, wrapped, None)

aesgcm_new = AESGCM(new_master)
new_nonce = os.urandom(12)
new_wrapped = aesgcm_new.encrypt(new_nonce, file_key, None)
record.wrapped_key = base64.urlsafe_b64encode(new_nonce + new_wrapped).decode()
db.commit()
db.close()
print("Master key rotated (per-file key re-wrapped under new master key).")

step("8. Confirm file still decrypts correctly AFTER rotation")
os.environ["MASTER_ENCRYPTION_KEY"] = new_master_raw
# Force a fresh app import isn't needed since encryption_service reads
# settings.MASTER_ENCRYPTION_KEY dynamically via settings object each call -
# but settings is cached at import; re-read via env override for this check.
from app.core.config import settings as _settings  # noqa: E402
_settings.MASTER_ENCRYPTION_KEY = new_master_raw

r = client.get(f"/api/files/{file_id}/download", headers=headers)
assert r.status_code == 200, r.text
assert r.content == b"content that must survive key rotation", r.content
print("File correctly decrypts under the NEW master key after rotation.")

print("\n✅ ALL DAY 5 CHECKS PASSED")
