"""
Day 2/3 end-to-end verification script.

Covers:
 - Access-level share permissions (view vs download enforcement)
 - Owner notifications on share creation and share access
 - Failed-login tracking and account lockout (suspicious activity detection)
 - Security audit feed for admins

Usage:
    cd backend
    python test_day2_flow.py
"""
import os

if os.path.exists("trustshare_demo2.db"):
    os.remove("trustshare_demo2.db")
os.environ["DATABASE_URL"] = "sqlite:///./trustshare_demo2.db"
os.environ.setdefault("MASTER_ENCRYPTION_KEY", "demo-master-key-for-testing-only-32b")
os.environ.setdefault("JWT_SECRET_KEY", "demo-jwt-secret-for-testing-only")
os.environ["LOCAL_STORAGE_DIR"] = "./storage/demo_encrypted2"

from fastapi.testclient import TestClient  # noqa: E402
from app.main import app  # noqa: E402
from app.core.database import SessionLocal  # noqa: E402
from app.models.user import User  # noqa: E402

client = TestClient(app)


def step(label):
    print(f"\n=== {label} ===")


# ---------------------------------------------------------------------------
step("1. Register owner + upload a file")
r = client.post(
    "/api/auth/register",
    json={"email": "owner@trustshare.example", "full_name": "Owner", "password": "SuperSecret123"},
)
assert r.status_code == 201, r.text

r = client.post("/api/auth/login", data={"username": "owner@trustshare.example", "password": "SuperSecret123"})
owner_token = r.json()["access_token"]
owner_headers = {"Authorization": f"Bearer {owner_token}"}

r = client.post(
    "/api/files/upload",
    headers=owner_headers,
    files={"upload": ("confidential.txt", b"Board meeting notes.", "text/plain")},
)
assert r.status_code == 201, r.text
file_id = r.json()["id"]
print(f"Uploaded file id={file_id}")

# ---------------------------------------------------------------------------
step("2. Create a VIEW-only share link and confirm it CANNOT download raw bytes")
r = client.post(f"/api/files/{file_id}/share", headers=owner_headers, json={"permission": "view", "expires_in_hours": 1})
assert r.status_code == 201, r.text
view_token = r.json()["token"]

r = client.get(f"/api/shared/{view_token}/info")
assert r.status_code == 200, r.text
print("view link /info:", r.json())

r = client.get(f"/api/shared/{view_token}")
assert r.status_code == 403, f"SECURITY FAILURE: view-only link allowed full download! {r.text}"
print(f"Correctly blocked full download on a view-only link: {r.status_code} {r.json()}")

# ---------------------------------------------------------------------------
step("3. Create a DOWNLOAD share link and confirm it works")
r = client.post(f"/api/files/{file_id}/share", headers=owner_headers, json={"permission": "download", "expires_in_hours": 1})
assert r.status_code == 201, r.text
download_token = r.json()["token"]

r = client.get(f"/api/shared/{download_token}")
assert r.status_code == 200
assert r.content == b"Board meeting notes."
print("Download-permission link correctly served file content.")

# ---------------------------------------------------------------------------
step("4. Confirm owner received notifications (share created + share accessed)")
r = client.get("/api/notifications", headers=owner_headers)
assert r.status_code == 200
notifications = r.json()
for n in notifications:
    print(f"  [{n['type']}] {n['title']} — {n['message']}")
types = {n["type"] for n in notifications}
assert "file.shared" in types, "Missing 'file.shared' notification"
assert "share.accessed" in types, "Missing 'share.accessed' notification"
print("Notification module working: owner was alerted on share creation and access.")

# ---------------------------------------------------------------------------
step("5. Suspicious activity: trigger account lockout with repeated bad passwords")
r = client.post(
    "/api/auth/register",
    json={"email": "victim@trustshare.example", "full_name": "Victim", "password": "CorrectPassword123"},
)
assert r.status_code == 201, r.text

for attempt in range(1, 6):
    r = client.post("/api/auth/login", data={"username": "victim@trustshare.example", "password": "wrongpass"})
    print(f"  attempt {attempt}: status={r.status_code} detail={r.json().get('detail')}")

# 6th attempt (even with correct password) should now be blocked - account locked
r = client.post("/api/auth/login", data={"username": "victim@trustshare.example", "password": "CorrectPassword123"})
assert r.status_code == 403, f"SECURITY FAILURE: account should be locked! got {r.status_code}"
print(f"Account correctly locked after 5 failed attempts: {r.status_code} {r.json()['detail']}")

step("6. Confirm the locked-out user received a security notification")
db = SessionLocal()
victim = db.query(User).filter(User.email == "victim@trustshare.example").first()
victim_id = victim.id
db.close()

# Log in as victim isn't possible while locked, so we check notifications
# were created by querying the DB directly (in a real app the victim would
# see this the next time they successfully authenticate).
db = SessionLocal()
from app.models.notification import Notification  # noqa: E402
notes = db.query(Notification).filter(Notification.user_id == victim_id).all()
db.close()
assert any(n.type == "security.account_locked" for n in notes), "Missing lockout notification"
print(f"Victim received {len(notes)} notification(s), including account-locked alert.")

step("7. Admin security dashboard shows the failed-login and lockout events")
# Promote owner to admin directly in DB for this test (see README for how to
# do this for a real demo user via SQL/DB browser).
db = SessionLocal()
owner = db.query(User).filter(User.email == "owner@trustshare.example").first()
owner.role = "admin"
db.commit()
db.close()

r = client.get("/api/audit/security", headers=owner_headers)
assert r.status_code == 200, r.text
print(f"Security events visible to admin: {len(r.json())}")
for e in r.json()[:5]:
    print(f"  {e['created_at']}  {e['action']}  {e['detail']}")

print("\n✅ ALL DAY 2/3 CHECKS PASSED")
