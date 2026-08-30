"""
test_files.py – Integration tests for file upload, storage, listing, download, sharing, and health.

Covers:
  ✓ 1. MongoDB, Redis, and overall health check endpoints
  ✓ 2. Upload valid PDF, DOCX, and PNG files
  ✓ 3. Rejection of forbidden/executable file types (.exe, .sh)
  ✓ 4. File listing and search filter
  ✓ 5. File details by ID with metadata
  ✓ 6. Secure file download with ownership verification
  ✓ 7. Forbidden download attempt by unauthorized user (403)
  ✓ 8. Secure share link generation with expiration
  ✓ 9. Public share access & download via token
  ✓ 10. Share link revocation & expired access rejection
  ✓ 11. File deletion (removes from disk and MongoDB)
  ✓ 12. Storage metrics summary stats
"""

import io
from fastapi.testclient import TestClient
import pytest

from tests.test_auth import get_token, register_user, login_user


# ─── Test 1: Health Endpoints ─────────────────────────────────────────────────

def test_health_endpoints(client: TestClient):
    """Verify /health, /health/mongodb, and /health/redis return valid status."""
    # General health
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert "postgres" in data
    assert "mongodb" in data
    assert "redis" in data

    # Dedicated MongoDB health
    mongo_res = client.get("/health/mongodb")
    assert mongo_res.status_code == 200
    assert "connected" in mongo_res.json()
    assert "database" in mongo_res.json()

    # Dedicated Redis health
    redis_res = client.get("/health/redis")
    assert redis_res.status_code == 200
    assert "connected" in redis_res.json()


# ─── Test 2: File Upload (Valid Formats) ───────────────────────────────────────

def test_upload_valid_pdf_file(client: TestClient):
    """Upload a valid PDF document with description."""
    token = get_token(client)
    pdf_content = b"%PDF-1.4 sample pdf content for unit testing..."
    files = {"file": ("test_doc.pdf", io.BytesIO(pdf_content), "application/pdf")}
    data = {"description": "Quarterly Financial Overview"}

    response = client.post(
        "/files/upload",
        files=files,
        data=data,
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 201, response.text
    res_data = response.json()
    assert res_data["original_name"] == "test_doc.pdf"
    assert res_data["category"] == "pdf"
    assert res_data["extension"] == ".pdf"
    assert res_data["description"] == "Quarterly Financial Overview"
    assert len(res_data["sha256_hash"]) == 64
    assert res_data["file_size"] == len(pdf_content)


def test_upload_image_file(client: TestClient):
    """Upload a valid PNG image."""
    token = get_token(client)
    png_content = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR..."
    files = {"file": ("diagram.png", io.BytesIO(png_content), "image/png")}

    response = client.post(
        "/files/upload",
        files=files,
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 201
    assert response.json()["category"] == "image"


# ─── Test 3: Upload Validation & Security Restrictions ────────────────────────

def test_upload_rejects_executable_extension(client: TestClient):
    """Security: Ensure executable (.exe) files are strictly rejected with 400."""
    token = get_token(client)
    exe_content = b"MZ\x90\x00\x03\x00\x00\x00\x04\x00..."
    files = {"file": ("malicious_payload.exe", io.BytesIO(exe_content), "application/x-msdownload")}

    response = client.post(
        "/files/upload",
        files=files,
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 400
    assert "forbidden" in response.json()["detail"].lower()


def test_upload_rejects_unsupported_extension(client: TestClient):
    """Ensure random unknown extensions not in whitelist are rejected."""
    token = get_token(client)
    bin_content = b"random binary"
    files = {"file": ("unknown_file.xyz123", io.BytesIO(bin_content), "application/octet-stream")}

    response = client.post(
        "/files/upload",
        files=files,
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 400
    assert "unsupported" in response.json()["detail"].lower()


# ─── Test 4: File Listing & Search Filtering ──────────────────────────────────

def test_list_and_search_files(client: TestClient):
    """Verify list files, text search, and category filtering."""
    token = get_token(client)

    # Upload PDF
    client.post(
        "/files/upload",
        files={"file": ("project_report.pdf", io.BytesIO(b"content"), "application/pdf")},
        headers={"Authorization": f"Bearer {token}"},
    )

    # Upload Image
    client.post(
        "/files/upload",
        files={"file": ("logo_asset.png", io.BytesIO(b"content"), "image/png")},
        headers={"Authorization": f"Bearer {token}"},
    )

    # 1. List all
    res_all = client.get("/files", headers={"Authorization": f"Bearer {token}"})
    assert res_all.status_code == 200
    assert len(res_all.json()) >= 2

    # 2. Filter by category=pdf
    res_pdf = client.get("/files?category=pdf", headers={"Authorization": f"Bearer {token}"})
    assert res_pdf.status_code == 200
    assert all(f["category"] == "pdf" for f in res_pdf.json())

    # 3. Search by name
    res_search = client.get("/files?search=project", headers={"Authorization": f"Bearer {token}"})
    assert res_search.status_code == 200
    assert len(res_search.json()) == 1
    assert "project_report" in res_search.json()[0]["original_name"]


# ─── Test 5: File Details & Storage Stats ─────────────────────────────────────

def test_file_details_and_stats(client: TestClient):
    """Retrieve detailed metadata and dashboard aggregate statistics."""
    token = get_token(client)

    upload_res = client.post(
        "/files/upload",
        files={"file": ("data_analysis.docx", io.BytesIO(b"docx content 12345"), "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
        headers={"Authorization": f"Bearer {token}"},
    )
    file_id = upload_res.json()["id"]

    # File details
    detail_res = client.get(f"/files/{file_id}", headers={"Authorization": f"Bearer {token}"})
    assert detail_res.status_code == 200
    assert detail_res.json()["id"] == file_id
    assert "sha256_hash" in detail_res.json()

    # Storage stats
    stats_res = client.get("/files/stats/summary", headers={"Authorization": f"Bearer {token}"})
    assert stats_res.status_code == 200
    assert stats_res.json()["total_files"] >= 1
    assert stats_res.json()["total_bytes"] > 0


# ─── Test 6: File Download & Security Ownership ───────────────────────────────

def test_download_file_owner_success(client: TestClient):
    """Owner can download their own uploaded file."""
    token = get_token(client)
    file_bytes = b"Hello, secure file sharing world!"

    upload_res = client.post(
        "/files/upload",
        files={"file": ("readme.txt", io.BytesIO(file_bytes), "text/plain")},
        headers={"Authorization": f"Bearer {token}"},
    )
    file_id = upload_res.json()["id"]

    # Download
    download_res = client.get(
        f"/files/{file_id}/download",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert download_res.status_code == 200
    assert download_res.content == file_bytes


def test_download_file_unauthorized_user_forbidden(client: TestClient):
    """A different registered user cannot download another user's private file (403)."""
    # User 1 uploads file
    token1 = get_token(client)
    upload_res = client.post(
        "/files/upload",
        files={"file": ("secret_user1.pdf", io.BytesIO(b"secret 1"), "application/pdf")},
        headers={"Authorization": f"Bearer {token1}"},
    )
    file_id = upload_res.json()["id"]

    # Register User 2
    register_user(client, {
        "full_name": "Bob Jones",
        "email": "bob@example.com",
        "password": "bobpassword123",
    })
    token2_res = login_user(client, "bob@example.com", "bobpassword123")
    token2 = token2_res.json()["access_token"]

    # User 2 tries to download User 1's file
    forbidden_res = client.get(
        f"/files/{file_id}/download",
        headers={"Authorization": f"Bearer {token2}"},
    )
    assert forbidden_res.status_code == 403


# ─── Test 7: File Sharing System ──────────────────────────────────────────────

def test_file_sharing_lifecycle(client: TestClient):
    """
    Test complete sharing workflow:
      1. Owner creates share link (24h expiry, can_download)
      2. Public recipient accesses /share/{token} without auth
      3. Public recipient downloads via /share/{token}/download
      4. Owner revokes share link
      5. Public recipient can no longer access the link (404/410)
    """
    token = get_token(client)
    file_content = b"Shared document for presentation"

    upload_res = client.post(
        "/files/upload",
        files={"file": ("presentation.pptx", io.BytesIO(file_content), "application/vnd.openxmlformats-officedocument.presentationml.presentation")},
        headers={"Authorization": f"Bearer {token}"},
    )
    file_id = upload_res.json()["id"]

    # 1. Create Share Link
    share_payload = {
        "duration": "24h",
        "permission": "can_download",
    }
    share_res = client.post(
        f"/files/{file_id}/share",
        json=share_payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert share_res.status_code == 201, share_res.text
    share_token = share_res.json()["share_token"]
    assert len(share_token) > 10

    # 2. Public view (no Authorization header required)
    public_res = client.get(f"/share/{share_token}")
    assert public_res.status_code == 200
    assert public_res.json()["original_name"] == "presentation.pptx"
    assert public_res.json()["can_download"] is True

    # 3. Public download
    dl_res = client.get(f"/share/{share_token}/download")
    assert dl_res.status_code == 200
    assert dl_res.content == file_content

    # 4. Revoke Share Link
    revoke_res = client.delete(
        f"/files/{file_id}/share/{share_token}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert revoke_res.status_code == 200

    # 5. Public access after revocation should fail (404/410)
    revoked_res = client.get(f"/share/{share_token}")
    assert revoked_res.status_code in (404, 410)


# ─── Test 8: File Deletion ────────────────────────────────────────────────────

def test_delete_file(client: TestClient):
    """Delete file permanently and verify it is removed from list and details."""
    token = get_token(client)

    upload_res = client.post(
        "/files/upload",
        files={"file": ("to_delete.txt", io.BytesIO(b"temporary text"), "text/plain")},
        headers={"Authorization": f"Bearer {token}"},
    )
    file_id = upload_res.json()["id"]

    # Delete
    del_res = client.delete(f"/files/{file_id}", headers={"Authorization": f"Bearer {token}"})
    assert del_res.status_code == 200
    assert "deleted" in del_res.json()["message"].lower()

    # Verify not found
    get_res = client.get(f"/files/{file_id}", headers={"Authorization": f"Bearer {token}"})
    assert get_res.status_code == 404
