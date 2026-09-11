import pytest
import httpx

@pytest.mark.asyncio
async def test_file_versioning_and_rollback(client: httpx.AsyncClient, auth_headers: dict):
    # Upload Version 1
    v1_content = b"Version 1 Content"
    upload_resp = await client.post(
        "/api/v1/files/upload",
        headers=auth_headers,
        files={"file": ("report.txt", v1_content, "text/plain")}
    )
    assert upload_resp.status_code == 201
    file_id = upload_resp.json()["id"]

    # Upload Version 2 of same file
    v2_content = b"Version 2 Updated Content"
    v2_resp = await client.post(
        f"/api/v1/files/{file_id}/versions",
        headers=auth_headers,
        files={"file": ("report.txt", v2_content, "text/plain")}
    )
    assert v2_resp.status_code == 201
    assert v2_resp.json()["current_version"] == 2

    # List versions
    versions_resp = await client.get(f"/api/v1/files/{file_id}/versions", headers=auth_headers)
    assert versions_resp.status_code == 200
    versions = versions_resp.json()
    assert len(versions) == 2
    assert versions[0]["version_number"] == 2
    assert versions[1]["version_number"] == 1

    # Download latest version (V2)
    download_v2 = await client.get(f"/api/v1/files/{file_id}/download", headers=auth_headers)
    assert download_v2.status_code == 200
    assert download_v2.content == v2_content

    # Download historical version (V1)
    download_v1 = await client.get(f"/api/v1/files/{file_id}/download?version=1", headers=auth_headers)
    assert download_v1.status_code == 200
    assert download_v1.content == v1_content

    # Delete file
    del_resp = await client.delete(f"/api/v1/files/{file_id}", headers=auth_headers)
    assert del_resp.status_code == 200
    assert del_resp.json()["deleted"] is True


@pytest.mark.asyncio
async def test_folder_lifecycle(client: httpx.AsyncClient, auth_headers: dict):
    # Create folder
    create_resp = await client.post(
        "/api/v1/folders",
        headers=auth_headers,
        json={"name": "Confidential Research"}
    )
    assert create_resp.status_code == 201
    folder_id = create_resp.json()["id"]

    # List folders
    list_resp = await client.get("/api/v1/folders", headers=auth_headers)
    assert list_resp.status_code == 200
    folder_names = [f["name"] for f in list_resp.json()]
    assert "Confidential Research" in folder_names

    # Delete folder
    del_resp = await client.delete(f"/api/v1/folders/{folder_id}", headers=auth_headers)
    assert del_resp.status_code == 200
    assert del_resp.json()["deleted"] is True

