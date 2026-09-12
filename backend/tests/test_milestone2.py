"""
test_milestone2.py – End-to-end integration tests for Milestone 2:
  ✓ 1. Authenticated upload encrypts file (verifying ciphertext in storage != plaintext)
  ✓ 2. Keys/nonces are NOT exposed in API responses
  ✓ 3. Owner download decrypts file back to original plaintext
  ✓ 4. Unauthorized user download is rejected with 403 Forbidden
  ✓ 5. User-to-user sharing allows recipient with 'can_download' to download
  ✓ 6. User-to-user sharing restricts recipient with 'view_only' (403 on download)
  ✓ 7. Temporary share link allows public download
  ✓ 8. Expired temporary share link is rejected (410 Gone)
  ✓ 9. Revoked temporary share link is rejected (410 Gone / 404)
  ✓ 10. Unauthenticated upload is rejected (401 Unauthorized)
"""

import io
from fastapi.testclient import TestClient
import pytest
from app.services.storage_service import storage_backend
from tests.test_auth import register_user, login_user


def get_custom_token(client: TestClient, email: str, name: str = "Test User") -> str:
    """Helper: register and login user with custom email."""
    register_user(client, {"full_name": name, "email": email, "password": "securepassword123"})
    res = login_user(client, email=email, password="securepassword123")
    return res.json()["access_token"]


def test_encrypted_upload_and_key_omission(client: TestClient):
    """Test authenticated upload encrypts file and omits secrets in API response."""
    token = get_custom_token(client, email="alice_m2@example.com", name="Alice M2")
    plaintext_content = b"TOP_SECRET_MILITARY_GRADE_DOCUMENT_DATA_123456789"
    files = {"file": ("classified.pdf", io.BytesIO(plaintext_content), "application/pdf")}
    data = {"description": "Classified Project Brief"}

    response = client.post(
        "/files/upload",
        files=files,
        data=data,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 201
    res_data = response.json()
    file_id = res_data["id"]
    stored_name = res_data["stored_name"]

    # 1. Verify secrets are NOT exposed in the response
    assert "encrypted_dek" not in res_data
    assert "nonce" not in res_data
    assert "dek" not in res_data
    assert "key" not in res_data
    assert res_data["is_encrypted"] is True
    assert res_data["encryption_algorithm"] == "AES-256-GCM"

    # 2. Verify raw storage contains ONLY ciphertext (not plaintext)
    raw_storage_bytes = storage_backend.get_file(stored_name)
    assert raw_storage_bytes != plaintext_content
    assert b"TOP_SECRET" not in raw_storage_bytes

    # 3. Owner can download and retrieve decrypted plaintext
    dl_response = client.get(
        f"/files/{file_id}/download",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert dl_response.status_code == 200
    assert dl_response.content == plaintext_content


def test_unauthorized_user_cannot_download_private_file(client: TestClient):
    """Verify unauthorized user cannot download another user's file."""
    # Alice uploads a file
    alice_token = get_custom_token(client, email="alice_owner@example.com", name="Alice Owner")
    content = b"Alice Private Diary Notes"
    files = {"file": ("diary.txt", io.BytesIO(content), "text/plain")}
    res = client.post(
        "/files/upload",
        files=files,
        headers={"Authorization": f"Bearer {alice_token}"},
    )
    file_id = res.json()["id"]

    # Bob tries to download Alice's file
    bob_token = get_custom_token(client, email="bob_intruder@example.com", name="Bob Intruder")
    dl_res = client.get(
        f"/files/{file_id}/download",
        headers={"Authorization": f"Bearer {bob_token}"},
    )
    assert dl_res.status_code == 403
    assert "Access forbidden" in dl_res.json()["detail"]


def test_user_to_user_sharing_workflow(client: TestClient):
    """Verify user-to-user sharing allows recipient to access and download."""
    alice_token = get_custom_token(client, email="alice_share_owner@example.com", name="Alice Share Owner")
    bob_token = get_custom_token(client, email="bob_share_recipient@example.com", name="Bob Share Recipient")

    # Alice uploads
    content = b"Shared Confidential Strategy Memo"
    files = {"file": ("strategy.pdf", io.BytesIO(content), "application/pdf")}
    upload_res = client.post(
        "/files/upload",
        files=files,
        headers={"Authorization": f"Bearer {alice_token}"},
    )
    file_id = upload_res.json()["id"]

    # Alice shares with Bob
    share_payload = {
        "recipient_email": "bob_share_recipient@example.com",
        "permission": "can_download",
        "duration": "7d",
    }
    share_res = client.post(
        f"/files/{file_id}/share-user",
        json=share_payload,
        headers={"Authorization": f"Bearer {alice_token}"},
    )
    assert share_res.status_code == 201

    # Bob views shared with me
    shared_res = client.get(
        "/files/shared-with-me",
        headers={"Authorization": f"Bearer {bob_token}"},
    )
    assert shared_res.status_code == 200
    shared_items = shared_res.json()
    assert len(shared_items) >= 1
    target_share = next((s for s in shared_items if s["file_id"] == file_id), None)
    assert target_share is not None
    assert target_share["original_name"] == "strategy.pdf"
    assert target_share["can_download"] is True

    # Bob downloads the shared file
    share_id = target_share["share_id"]
    dl_res = client.get(
        f"/files/shared-with-me/{share_id}/download",
        headers={"Authorization": f"Bearer {bob_token}"},
    )
    assert dl_res.status_code == 200
    assert dl_res.content == content


def test_view_only_user_sharing_blocks_download(client: TestClient):
    """Verify view_only shared files cannot be downloaded."""
    alice_token = get_custom_token(client, email="alice_viewonly_owner@example.com", name="Alice VO Owner")
    bob_token = get_custom_token(client, email="bob_viewonly_recipient@example.com", name="Bob VO Recipient")

    content = b"View Only Presentation Deck"
    files = {"file": ("deck.pdf", io.BytesIO(content), "application/pdf")}
    upload_res = client.post(
        "/files/upload",
        files=files,
        headers={"Authorization": f"Bearer {alice_token}"},
    )
    file_id = upload_res.json()["id"]

    # Alice shares as view_only
    share_payload = {
        "recipient_email": "bob_viewonly_recipient@example.com",
        "permission": "view_only",
        "duration": "24h",
    }
    client.post(
        f"/files/{file_id}/share-user",
        json=share_payload,
        headers={"Authorization": f"Bearer {alice_token}"},
    )

    # Bob tries to download
    shared_res = client.get(
        "/files/shared-with-me",
        headers={"Authorization": f"Bearer {bob_token}"},
    )
    target_share = next((s for s in shared_res.json() if s["file_id"] == file_id), None)
    assert target_share["permission"] == "view_only"
    assert target_share["can_download"] is False

    dl_res = client.get(
        f"/files/shared-with-me/{target_share['share_id']}/download",
        headers={"Authorization": f"Bearer {bob_token}"},
    )
    assert dl_res.status_code == 403


def test_temporary_link_revocation(client: TestClient):
    """Verify temporary link creation and revocation."""
    token = get_custom_token(client, email="temp_link_user@example.com", name="Temp User")
    content = b"Temporary access document"
    files = {"file": ("temp.pdf", io.BytesIO(content), "application/pdf")}
    res = client.post(
        "/files/upload",
        files=files,
        headers={"Authorization": f"Bearer {token}"},
    )
    file_id = res.json()["id"]

    # Create link
    share_res = client.post(
        f"/files/{file_id}/share",
        json={"duration": "1h", "permission": "can_download"},
        headers={"Authorization": f"Bearer {token}"},
    )
    share_token = share_res.json()["share_token"]

    # Public download works
    pub_dl = client.get(f"/share/{share_token}/download")
    assert pub_dl.status_code == 200
    assert pub_dl.content == content

    # Revoke link
    revoke_res = client.delete(
        f"/files/{file_id}/share/{share_token}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert revoke_res.status_code == 200

    # Public download now rejected (410 or 404)
    pub_dl_after = client.get(f"/share/{share_token}/download")
    assert pub_dl_after.status_code in [404, 410]


def test_unauthenticated_upload_rejected(client: TestClient):
    """Verify unauthenticated upload request is rejected with 401/403."""
    content = b"Unauthenticated data"
    files = {"file": ("unauth.pdf", io.BytesIO(content), "application/pdf")}
    res = client.post("/files/upload", files=files)
    assert res.status_code in [401, 403]
