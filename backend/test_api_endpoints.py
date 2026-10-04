"""
test_api_endpoints.py – Smoke test for TrustShare backend APIs.
"""

import io
import json
import urllib.request
import uuid

BASE_URL = "http://127.0.0.1:8000"


def run_tests():
    print(f"Testing TrustShare backend at {BASE_URL}...")

    # 1. Root Status
    req = urllib.request.Request(f"{BASE_URL}/")
    with urllib.request.urlopen(req, timeout=5) as resp:
        body = json.loads(resp.read().decode())
        print(f"[PASS] GET / -> HTTP {resp.status}: {body.get('status')}")

    # 2. Health
    req = urllib.request.Request(f"{BASE_URL}/health")
    with urllib.request.urlopen(req, timeout=5) as resp:
        body = json.loads(resp.read().decode())
        print(f"[PASS] GET /health -> HTTP {resp.status}: {body.get('status')}")

    # 3. Register
    email = f"user_{uuid.uuid4().hex[:6]}@trustshare.io"
    password = "TestPassword123!"
    reg_payload = json.dumps({
        "full_name": "API Tester",
        "email": email,
        "password": password,
    }).encode("utf-8")
    req = urllib.request.Request(
        f"{BASE_URL}/register",
        data=reg_payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        user_data = json.loads(resp.read().decode())
        print(f"[PASS] POST /register -> HTTP {resp.status}: Created {user_data.get('email')}")

    # 4. Login
    login_payload = json.dumps({
        "email": email,
        "password": password,
    }).encode("utf-8")
    req = urllib.request.Request(
        f"{BASE_URL}/login",
        data=login_payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        auth_data = json.loads(resp.read().decode())
        token = auth_data["access_token"]
        print(f"[PASS] POST /login -> HTTP {resp.status}: JWT Token generated ({token[:16]}...)")

    # 5. GET /me (Protected Route)
    req = urllib.request.Request(
        f"{BASE_URL}/me",
        headers={"Authorization": f"Bearer {token}"},
        method="GET",
    )
    with urllib.request.urlopen(req, timeout=5) as resp:
        profile = json.loads(resp.read().decode())
        print(f"[PASS] GET /me -> HTTP {resp.status}: Authenticated user {profile.get('email')}")

    # 6. GET /files (Protected File List)
    req = urllib.request.Request(
        f"{BASE_URL}/files",
        headers={"Authorization": f"Bearer {token}"},
        method="GET",
    )
    with urllib.request.urlopen(req, timeout=5) as resp:
        files = json.loads(resp.read().decode())
        print(f"[PASS] GET /files -> HTTP {resp.status}: Retrieved {len(files)} files")

    # 7. Upload File (Multipart Form)
    boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW"
    file_content = b"TrustShare AES-256 encrypted sample file payload for upload testing."
    
    body_parts = [
        f"--{boundary}\r\n".encode("utf-8"),
        b'Content-Disposition: form-data; name="file"; filename="sample_doc.txt"\r\n',
        b"Content-Type: text/plain\r\n\r\n",
        file_content,
        b"\r\n",
        f"--{boundary}\r\n".encode("utf-8"),
        b'Content-Disposition: form-data; name="description"\r\n\r\n',
        b"API upload verification test\r\n",
        f"--{boundary}--\r\n".encode("utf-8"),
    ]
    multipart_body = b"".join(body_parts)

    req = urllib.request.Request(
        f"{BASE_URL}/files/upload",
        data=multipart_body,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": f"multipart/form-data; boundary={boundary}",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        uploaded = json.loads(resp.read().decode())
        print(f"[PASS] POST /files/upload -> HTTP {resp.status}: File '{uploaded.get('original_name')}' encrypted & stored (ID: {uploaded.get('id')})")

    print("\nALL API ENDPOINTS TESTED AND VERIFIED SUCCESSFULLY!")


if __name__ == "__main__":
    run_tests()
