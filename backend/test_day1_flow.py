"""
Day 1 end-to-end verification script.

Run this against a running server (uvicorn app.main:app --reload) OR
in-process via TestClient — this version uses TestClient so it needs no
running server, making it easy to run right before a demo.

Usage:
    cd backend
    python test_day1_flow.py
"""
import os

# Use a fresh SQLite DB + storage dir for a clean demo run
if os.path.exists("trustshare_demo.db"):
    os.remove("trustshare_demo.db")
os.environ["DATABASE_URL"] = "sqlite:///./trustshare_demo.db"
os.environ.setdefault("MASTER_ENCRYPTION_KEY", "demo-master-key-for-testing-only-32b")
os.environ.setdefault("JWT_SECRET_KEY", "demo-jwt-secret-for-testing-only")
os.environ["LOCAL_STORAGE_DIR"] = "./storage/demo_encrypted"

from fastapi.testclient import TestClient  # noqa: E402
from app.main import app  # noqa: E402

client = TestClient(app)


def step(label):
    print(f"\n=== {label} ===")


step("1. Register user")
r = client.post(
    "/api/auth/register",
    json={"email": "demo@trustshare.example", "full_name": "Demo User", "password": "SuperSecret123"},
)
assert r.status_code == 201, r.text
print(r.json())

step("2. Login")
r = client.post("/api/auth/login", data={"username": "demo@trustshare.example", "password": "SuperSecret123"})
assert r.status_code == 200, r.text
token = r.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}
print("JWT access token acquired.")

step("3. Upload file (will be AES-256 encrypted server-side)")
original_content = b"CONFIDENTIAL: TrustShare final year project report."
r = client.post(
    "/api/files/upload",
    headers=headers,
    files={"upload": ("report.txt", original_content, "text/plain")},
)
assert r.status_code == 201, r.text
file_id = r.json()["id"]
print(r.json())

step("4. Confirm the file stored on disk is ENCRYPTED, not plaintext")
found = None
for root, _, files in os.walk("./storage/demo_encrypted"):
    for f in files:
        found = os.path.join(root, f)
assert found, "Encrypted file not found on disk"
with open(found, "rb") as f:
    raw_on_disk = f.read()
assert original_content not in raw_on_disk, "SECURITY FAILURE: plaintext found on disk!"
print(f"Encrypted file path: {found}")
print(f"First 40 raw bytes on disk (unreadable ciphertext): {raw_on_disk[:40]}")

step("5. Download file (server decrypts in memory) and verify it matches original")
r = client.get(f"/api/files/{file_id}/download", headers=headers)
assert r.status_code == 200
assert r.content == original_content, "Decrypted content does not match original!"
print("Downloaded content matches original exactly.")

step("6. Create a temporary secure share link")
r = client.post(
    f"/api/files/{file_id}/share",
    headers=headers,
    json={"permission": "download", "expires_in_hours": 24},
)
assert r.status_code == 201, r.text
share_token = r.json()["token"]
print(r.json())

step("7. Access shared file WITHOUT authentication (simulates recipient)")
r = client.get(f"/api/shared/{share_token}")
assert r.status_code == 200
assert r.content == original_content
print("Anonymous share access succeeded and content matches original.")

step("8. View audit log for this user")
r = client.get("/api/audit/me", headers=headers)
assert r.status_code == 200
for entry in r.json():
    print(f"  {entry['created_at']}  {entry['action']:20s}  resource={entry['resource_type']}:{entry['resource_id']}")

print("\n✅ ALL DAY 1 CHECKS PASSED")
