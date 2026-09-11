import pytest
import httpx

@pytest.mark.asyncio
async def test_view_only_share_restriction_and_revocation(client: httpx.AsyncClient, auth_headers: dict):
    upload_resp = await client.post(
        "/api/v1/files/upload",
        headers=auth_headers,
        files={"file": ("view_only.pdf", b"Sensitive PDF contents", "application/pdf")}
    )
    file_id = upload_resp.json()["id"]

    # Create view-only share link
    share_resp = await client.post(
        "/api/v1/shares",
        headers=auth_headers,
        json={
            "file_id": file_id,
            "permission_type": "view_only",
            "expires_in_hours": 1
        }
    )
    assert share_resp.status_code == 201
    token = share_resp.json()["token"]
    share_id = share_resp.json()["id"]

    # Metadata check
    meta_resp = await client.get(f"/api/v1/shares/{token}/meta")
    assert meta_resp.status_code == 200
    assert meta_resp.json()["permission_type"] == "view_only"
    assert meta_resp.json()["requires_passphrase"] is False

    # Preview stream succeeds on view_only
    preview_resp = await client.post(f"/api/v1/shares/{token}/preview", json={})
    assert preview_resp.status_code == 200
    assert preview_resp.content == b"Sensitive PDF contents"
    assert preview_resp.headers["Content-Disposition"].startswith("inline")

    # Attempt download on view-only link -> 403 Forbidden
    download_attempt = await client.post(f"/api/v1/shares/{token}/download", json={})
    assert download_attempt.status_code == 403

    # Revoke link
    revoke_resp = await client.delete(f"/api/v1/shares/{share_id}/revoke", headers=auth_headers)
    assert revoke_resp.status_code == 200

    # Metadata shows revoked
    meta_after_revoke = await client.get(f"/api/v1/shares/{token}/meta")
    assert meta_after_revoke.status_code == 200
    assert meta_after_revoke.json()["is_revoked"] is True

    # Verify link access is now denied -> 404
    access_after_revoke = await client.post(f"/api/v1/shares/{token}/access", json={})
    assert access_after_revoke.status_code == 404


@pytest.mark.asyncio
async def test_passphrase_protected_and_max_downloads_share(client: httpx.AsyncClient, auth_headers: dict):
    upload_resp = await client.post(
        "/api/v1/files/upload",
        headers=auth_headers,
        files={"file": ("quota_test.txt", b"Download Limit Data", "text/plain")}
    )
    file_id = upload_resp.json()["id"]

    # Create passphrase-protected link with download limit of 2
    share_resp = await client.post(
        "/api/v1/shares",
        headers=auth_headers,
        json={
            "file_id": file_id,
            "permission_type": "download_allowed",
            "passphrase": "supersecretpassword",
            "expires_in_hours": 24,
            "max_downloads": 2
        }
    )
    assert share_resp.status_code == 201
    token = share_resp.json()["token"]

    # Check metadata requires passphrase
    meta_resp = await client.get(f"/api/v1/shares/{token}/meta")
    assert meta_resp.status_code == 200
    assert meta_resp.json()["requires_passphrase"] is True
    assert meta_resp.json()["has_download_limit"] is True

    # Access without passphrase -> 401
    fail_access = await client.post(f"/api/v1/shares/{token}/access", json={})
    assert fail_access.status_code == 401

    # Access with wrong passphrase -> 401
    wrong_access = await client.post(f"/api/v1/shares/{token}/access", json={"passphrase": "wrong"})
    assert wrong_access.status_code == 401

    # Access with correct passphrase -> 200
    ok_access = await client.post(f"/api/v1/shares/{token}/access", json={"passphrase": "supersecretpassword"})
    assert ok_access.status_code == 200

    # Download #1 -> 200
    dl_1 = await client.post(f"/api/v1/shares/{token}/download", json={"passphrase": "supersecretpassword"})
    assert dl_1.status_code == 200
    assert dl_1.content == b"Download Limit Data"

    # Download #2 -> 200
    dl_2 = await client.post(f"/api/v1/shares/{token}/download", json={"passphrase": "supersecretpassword"})
    assert dl_2.status_code == 200

    # Download #3 -> 403 Quota exceeded
    dl_3 = await client.post(f"/api/v1/shares/{token}/download", json={"passphrase": "supersecretpassword"})
    assert dl_3.status_code == 403

    # Metadata reflects limit reached
    meta_limit = await client.get(f"/api/v1/shares/{token}/meta")
    assert meta_limit.json()["is_download_limit_reached"] is True
