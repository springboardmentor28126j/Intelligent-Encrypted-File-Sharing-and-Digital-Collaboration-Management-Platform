import pytest
import httpx

@pytest.mark.asyncio
async def test_file_upload_and_list_contract(client: httpx.AsyncClient, auth_headers: dict):
    # 1. Create a folder
    folder_resp = await client.post(
        "/api/v1/folders",
        headers=auth_headers,
        json={"name": "Engineering Specs"}
    )
    assert folder_resp.status_code in [200, 201]
    folder_id = folder_resp.json().get("id")

    # 2. Upload file to folder
    file_content = b"Specification details for secure file sharing system."
    files = {"file": ("architecture.pdf", file_content, "application/pdf")}
    data = {"category": "architecture", "folder_id": folder_id}
    
    upload_resp = await client.post(
        "/api/v1/files/upload",
        headers=auth_headers,
        files=files,
        data=data
    )
    assert upload_resp.status_code == 201
    file_data = upload_resp.json()
    assert file_data["name"] == "architecture.pdf"
    assert file_data["current_version"] == 1
    file_id = file_data["id"]

    # 3. List files
    list_resp = await client.get("/api/v1/files", headers=auth_headers)
    assert list_resp.status_code == 200
    files_list = list_resp.json()
    assert len(files_list) >= 1
    assert any(f["id"] == file_id for f in files_list)

    # 4. Download file
    download_resp = await client.get(f"/api/v1/files/{file_id}/download", headers=auth_headers)
    assert download_resp.status_code == 200
    assert download_resp.content == file_content
