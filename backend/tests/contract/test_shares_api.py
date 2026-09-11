import pytest
import httpx

@pytest.mark.asyncio
async def test_create_and_access_share_link(client: httpx.AsyncClient, auth_headers: dict):
    # Upload test file
    upload_resp = await client.post(
        "/api/v1/files/upload",
        headers=auth_headers,
        files={"file": ("shared_doc.txt", b"Confidential shared data", "text/plain")}
    )
    file_id = upload_resp.json()["id"]

    # Create share link with passphrase
    share_resp = await client.post(
        "/api/v1/shares",
        headers=auth_headers,
        json={
            "file_id": file_id,
            "permission_type": "download_allowed",
            "passphrase": "SecretPassphrase123!",
            "expires_in_hours": 12,
            "max_downloads": 3
        }
    )
    assert share_resp.status_code == 201
    share_data = share_resp.json()
    token = share_data["token"]
    assert share_data["requires_passphrase"] is True

    # Access with wrong passphrase -> 401
    bad_access = await client.post(f"/api/v1/shares/{token}/access", json={"passphrase": "Wrong"})
    assert bad_access.status_code == 401

    # Access with correct passphrase -> 200
    good_access = await client.post(f"/api/v1/shares/{token}/access", json={"passphrase": "SecretPassphrase123!"})
    assert good_access.status_code == 200
    assert good_access.json()["file_name"] == "shared_doc.txt"
