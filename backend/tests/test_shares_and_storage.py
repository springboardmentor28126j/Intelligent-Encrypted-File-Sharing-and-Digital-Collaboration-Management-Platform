"""
test_shares_and_storage.py – Tests for temporary share link controls, storage abstraction, and email dispatch on share.
"""

import io
from datetime import datetime, timedelta, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import File, FileShare, User
from app.services.storage_service import LocalStorageBackend, SupabaseStorageBackend, get_storage_backend


def test_share_link_creation_with_email_delivery(client: TestClient, db_session: Session):
    """Verify creating a share link with recipient_email dispatches email and returns email status."""
    # 1. Register and login
    user_email = "owner_share@trustshare.io"
    client.post("/register", json={
        "full_name": "Share Owner",
        "email": user_email,
        "password": "Password123!",
    })
    login_res = client.post("/login", json={"email": user_email, "password": "Password123!"})
    token = login_res.json()["access_token"]
    auth_headers = {"Authorization": f"Bearer {token}"}

    # 2. Upload file
    file_bytes = b"Encrypted test file content for share link testing"
    upload_res = client.post(
        "/files/upload",
        headers=auth_headers,
        files={"file": ("shared_doc.txt", io.BytesIO(file_bytes), "text/plain")},
        data={"description": "File to share with recipient"},
    )
    assert upload_res.status_code == 201
    file_id = upload_res.json()["id"]

    # 3. Create share link with recipient email
    rec_email = "recipient_friend@trustshare.io"
    share_res = client.post(
        f"/files/{file_id}/share",
        headers=auth_headers,
        json={
            "duration": "24h",
            "permission": "can_download",
            "max_downloads": 5,
            "recipient_email": rec_email,
        },
    )
    assert share_res.status_code == 201
    share_data = share_res.json()
    assert share_data["recipient_email"] == rec_email
    assert share_data["max_downloads"] == 5
    assert share_data["email_sent"] is True
    assert "Sent via" in share_data["email_status"] or "Delivery" in share_data["email_status"]

    share_token = share_data["share_token"]

    # 4. Access public share endpoint
    public_res = client.get(f"/share/{share_token}")
    assert public_res.status_code == 200
    pub_data = public_res.json()
    assert pub_data["original_name"] == "shared_doc.txt"
    assert pub_data["can_download"] is True

    # 5. Download public share
    dl_res = client.get(f"/share/{share_token}/download")
    assert dl_res.status_code == 200
    assert dl_res.content == file_bytes


def test_share_link_presets_duration(client: TestClient):
    """Verify 1h, 24h, 7d presets compute correct expiration datetime."""
    user_email = "preset_user@trustshare.io"
    client.post("/register", json={
        "full_name": "Preset User",
        "email": user_email,
        "password": "Password123!",
    })
    token = client.post("/login", json={"email": user_email, "password": "Password123!"}).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    upload_res = client.post(
        "/files/upload",
        headers=headers,
        files={"file": ("test_preset.txt", io.BytesIO(b"preset content"), "text/plain")},
    )
    file_id = upload_res.json()["id"]

    for dur in ["1h", "24h", "7d"]:
        s_res = client.post(
            f"/files/{file_id}/share",
            headers=headers,
            json={"duration": dur, "permission": "can_download"},
        )
        assert s_res.status_code == 201
        exp_str = s_res.json()["expires_at"]
        assert exp_str is not None
        exp_dt = datetime.fromisoformat(exp_str)
        assert exp_dt > datetime.now(timezone.utc)


def test_share_link_revocation(client: TestClient):
    """Verify revoking a share link makes it immediately inaccessible."""
    user_email = "revoke_owner@trustshare.io"
    client.post("/register", json={
        "full_name": "Revoke Owner",
        "email": user_email,
        "password": "Password123!",
    })
    token = client.post("/login", json={"email": user_email, "password": "Password123!"}).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    upload_res = client.post(
        "/files/upload",
        headers=headers,
        files={"file": ("revoke_doc.pdf", io.BytesIO(b"confidential content"), "application/pdf")},
    )
    file_id = upload_res.json()["id"]

    share_res = client.post(
        f"/files/{file_id}/share",
        headers=headers,
        json={"duration": "24h", "permission": "can_download"},
    )
    share_token = share_res.json()["share_token"]

    # Revoke
    rev_res = client.delete(f"/files/{file_id}/share/{share_token}", headers=headers)
    assert rev_res.status_code == 200

    # Public access must now return 410 Gone
    pub_res = client.get(f"/share/{share_token}")
    assert pub_res.status_code == 410


def test_storage_backends():
    """Verify LocalStorageBackend interface and behavior."""
    local_backend = LocalStorageBackend()
    assert local_backend.backend_name == "local"

    test_key = "test_object_123.bin"
    test_data = b"Encrypted test binary payload"

    local_backend.save_file(test_key, test_data)
    assert local_backend.file_exists(test_key) is True
    retrieved = local_backend.get_file(test_key)
    assert retrieved == test_data

    # Presigned/signed URL returns None for local storage
    assert local_backend.generate_signed_url(test_key) is None

    # Delete
    assert local_backend.delete_file(test_key) is True
    assert local_backend.file_exists(test_key) is False
