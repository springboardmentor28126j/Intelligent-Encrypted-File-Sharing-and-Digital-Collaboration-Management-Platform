from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from fastapi.responses import Response
from pathlib import Path
import uuid

from .auth import get_current_user
from .encryption import encrypt_file, decrypt_file
from .cloud_storage import (
    upload_encrypted_file,
    download_encrypted_file,
    delete_encrypted_file,
    SUPABASE_BUCKET
)

router = APIRouter(prefix="/files", tags=["Files"])

MAX_FILE_SIZE = 50 * 1024 * 1024


@router.post("/upload")
def upload_file(
    file: UploadFile = File(...),
    current_user=Depends(get_current_user)
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file selected")

    file_id = str(uuid.uuid4())
    safe_filename = Path(file.filename).name
    file_data = file.file.read()

    if not file_data:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    if len(file_data) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail="File size exceeds the 50 MB limit"
        )

    nonce, encrypted_data = encrypt_file(file_data)
    encrypted_file_data = nonce + encrypted_data

    storage_path = f"user_{current_user.id}/{file_id}_{safe_filename}"

    try:
        upload_encrypted_file(
            storage_path,
            encrypted_file_data
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Cloud upload failed: {str(e)}"
        )

    return {
        "message": "File encrypted and uploaded to cloud successfully",
        "file_id": file_id,
        "filename": safe_filename,
        "storage_path": storage_path,
        "bucket": SUPABASE_BUCKET,
        "encryption": "AES-256-GCM",
        "storage": "Supabase Storage",
        "uploaded_by": current_user.username
    }


@router.get("/")
def list_files(
    current_user=Depends(get_current_user)
):
    folder = f"user_{current_user.id}"

    try:
        cloud_files = (
            __import__("app.cloud_storage", fromlist=["supabase"])
            .supabase
            .storage
            .from_(SUPABASE_BUCKET)
            .list(folder)
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Cloud listing failed: {str(e)}"
        )

    files = []

    for item in cloud_files:
        if item.get("name"):
            stored_name = item["name"]
            parts = stored_name.split("_", 1)

            original_filename = (
                parts[1] if len(parts) == 2 else stored_name
            )

            files.append({
                "filename": original_filename,
                "storage_path": f"{folder}/{stored_name}",
                "size": item.get("metadata", {}).get("size", 0),
                "encrypted": True,
                "storage": "Supabase Storage"
            })

    return {
        "files": files
    }


@router.get("/download/{filename:path}")
def download_file(
    filename: str,
    current_user=Depends(get_current_user)
):
    safe_path = Path(filename)

    if safe_path.is_absolute() or ".." in safe_path.parts:
        raise HTTPException(
            status_code=400,
            detail="Invalid file path"
        )

    if not filename.startswith(f"user_{current_user.id}/"):
        filename = f"user_{current_user.id}/{filename}"

    try:
        encrypted_file_data = download_encrypted_file(filename)
    except Exception:
        raise HTTPException(
            status_code=404,
            detail="Encrypted file not found"
        )

    if len(encrypted_file_data) < 13:
        raise HTTPException(
            status_code=500,
            detail="Invalid encrypted file"
        )

    nonce = encrypted_file_data[:12]
    encrypted_data = encrypted_file_data[12:]

    try:
        decrypted_data = decrypt_file(
            nonce,
            encrypted_data
        )
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="File decryption failed"
        )

    stored_name = Path(filename).name
    parts = stored_name.split("_", 1)

    original_filename = (
        parts[1] if len(parts) == 2 else stored_name
    )

    return Response(
        content=decrypted_data,
        media_type="application/octet-stream",
        headers={
            "Content-Disposition":
                f'attachment; filename="{original_filename}"'
        }
    )


@router.delete("/{filename:path}")
def delete_file(
    filename: str,
    current_user=Depends(get_current_user)
):
    safe_path = Path(filename)

    if safe_path.is_absolute() or ".." in safe_path.parts:
        raise HTTPException(
            status_code=400,
            detail="Invalid file path"
        )

    expected_prefix = f"user_{current_user.id}/"

    if not filename.startswith(expected_prefix):
        raise HTTPException(
            status_code=403,
            detail="You do not have permission to delete this file"
        )

    try:
        delete_encrypted_file(filename)
    except Exception:
        raise HTTPException(
            status_code=404,
            detail="File not found"
        )

    return {
        "message": "Encrypted cloud file deleted successfully",
        "storage_path": filename
    }