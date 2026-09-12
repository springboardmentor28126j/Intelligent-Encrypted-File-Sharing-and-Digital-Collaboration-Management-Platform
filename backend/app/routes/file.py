import os
import uuid
import shutil
from typing import Optional, List
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, status, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.db.models import FileModel, FolderModel, User, UserFileAccess
from app.schemas.file import FileOut, FolderCreate, FolderOut, ExplorerContentResponse
from app.core.deps import get_current_user
from app.core.supabase_client import (
    upload_to_supabase,
    get_signed_url,
    remove_from_supabase,
    remove_multiple_from_supabase,
)

router = APIRouter(prefix="/files", tags=["File Management"])

UPLOAD_DIR = "Uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs("uploads", exist_ok=True)

MAX_FILE_SIZE = 25 * 1024 * 1024  # 25MB Max limit

# Helper function: MIME Type se category detect karne ke liye
def detect_category(mime_type: str) -> str:
    if not mime_type:
        return "other"
    mime_type = mime_type.lower()
    if mime_type.startswith("image/"):
        return "image"
    elif mime_type == "application/pdf":
        return "pdf"
    elif mime_type.startswith("video/"):
        return "video"
    elif mime_type.startswith("audio/"):
        return "audio"
    elif any(doc in mime_type for doc in ["word", "document", "text", "csv", "excel", "spreadsheet"]):
        return "document"
    elif any(arch in mime_type for arch in ["zip", "rar", "tar", "compressed", "7z"]):
        return "archive"
    return "other"


# 1. Upload File (With Auto-Category & Optional Folder ID)
@router.post("/upload", response_model=FileOut, status_code=status.HTTP_201_CREATED)
async def upload_file(
    file: UploadFile = File(...),
    folder_id: Optional[int] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Size Validation Check
    file.file.seek(0, os.SEEK_END)
    file_size = file.file.tell()
    file.file.seek(0)

    if file_size > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File size exceeds maximum limit of 25MB")

    if file_size == 0:
        raise HTTPException(status_code=400, detail="Empty file cannot be uploaded")

    # Generate Unique File Name
    ext = os.path.splitext(file.filename)[1]
    unique_filename = f"{uuid.uuid4().hex}{ext}"
    
    # Read file bytes
    file_bytes = await file.read()

    # Always save to local storage first (guarantees file upload never fails)
    local_path = os.path.join(UPLOAD_DIR, unique_filename)
    with open(local_path, "wb") as f:
        f.write(file_bytes)

    # Attempt upload to Supabase Storage
    try:
        upload_to_supabase(
            path=unique_filename,
            file_bytes=file_bytes,
            content_type=file.content_type
        )
    except Exception as e:
        print(f"Supabase Storage notice: {e}. File stored locally at {local_path}")

    # Detect Category
    file_mime = file.content_type or "unknown"
    category = detect_category(file_mime)

    # Save Metadata to PostgreSQL
    new_file = FileModel(
        original_filename=file.filename,
        stored_filename=unique_filename,
        file_path=unique_filename,  # storing object name in file_path
        file_size=file_size,
        file_type=file_mime,
        category=category,
        folder_id=folder_id,
        owner_id=current_user.id
    )

    db.add(new_file)
    db.commit()
    db.refresh(new_file)

    return new_file


# 2. Create New Folder API
@router.post("/folder/create", response_model=FolderOut, status_code=status.HTTP_201_CREATED)
def create_folder(
    folder_data: FolderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    new_folder = FolderModel(
        name=folder_data.name,
        parent_id=folder_data.parent_id,
        owner_id=current_user.id
    )
    db.add(new_folder)
    db.commit()
    db.refresh(new_folder)
    return new_folder


# 3. Get Files and Folders List (With Folder Navigation, Category Filter & Search)
@router.get("/list", response_model=ExplorerContentResponse)
def list_explorer_content(
    folder_id: Optional[int] = Query(None),
    category: Optional[str] = Query("all"),
    search: Optional[str] = Query(""),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Logged-in user ke Folders fetch karein
    folders_query = db.query(FolderModel).filter(FolderModel.owner_id == current_user.id)

    # Logged-in user ki Files fetch karein
    files_query = db.query(FileModel).filter(FileModel.owner_id == current_user.id)

    # Agar search hai toh global search apply karein (ignore folder navigation)
    if search and search.strip():
        search_term = f"%{search.strip()}%"
        folders_query = folders_query.filter(FolderModel.name.ilike(search_term))
        files_query = files_query.filter(FileModel.original_filename.ilike(search_term))
    else:
        # Normal folder navigation
        folders_query = folders_query.filter(FolderModel.parent_id == folder_id)
        files_query = files_query.filter(FileModel.folder_id == folder_id)

    # Category filter apply karein agar "all" na ho
    if category and category != "all":
        files_query = files_query.filter(FileModel.category == category)

    return {
        "folders": folders_query.all(),
        "files": files_query.all()
    }


from datetime import timedelta
from fastapi.responses import RedirectResponse

# 4. View / Download File API
@router.get("/view/{file_id}")
def view_file(
    file_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    file_record = db.query(FileModel).filter(FileModel.id == file_id).first()

    if not file_record:
        raise HTTPException(status_code=404, detail="File not found")

    # Verify authorization: Owner OR user with granted internal access
    if file_record.owner_id != current_user.id:
        has_access = db.query(UserFileAccess).filter(
            UserFileAccess.file_id == file_id,
            UserFileAccess.shared_with_user_id == current_user.id
        ).first()
        if not has_access:
            raise HTTPException(status_code=403, detail="You do not have permission to view this file")

    # 1. Check if the file physically exists on local disk (for existing/local files)
    potential_paths = [
        file_record.file_path,
        os.path.join("Uploads", file_record.stored_filename),
        os.path.join("uploads", file_record.stored_filename),
        os.path.join("Uploads", os.path.basename(file_record.file_path)),
        os.path.join("uploads", os.path.basename(file_record.file_path)),
    ]
    for p in potential_paths:
        if p and os.path.exists(p) and os.path.isfile(p):
            return FileResponse(
                path=p,
                filename=file_record.original_filename,
                media_type=file_record.file_type
            )

    # 2. Otherwise generate signed URL from Supabase Storage
    try:
        url = get_signed_url(file_record.file_path, expires_in=7200)
        return RedirectResponse(url)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to access file storage: {str(e)}")


# 5. Download File API (Enforces 'can_download' permission for shared users)
@router.get("/download/{file_id}")
def download_file(
    file_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    file_record = db.query(FileModel).filter(FileModel.id == file_id).first()

    if not file_record:
        raise HTTPException(status_code=404, detail="File not found")

    # Verify authorization & permission
    if file_record.owner_id != current_user.id:
        has_access = db.query(UserFileAccess).filter(
            UserFileAccess.file_id == file_id,
            UserFileAccess.shared_with_user_id == current_user.id
        ).first()
        if not has_access:
            raise HTTPException(status_code=403, detail="You do not have access to this file")
        if has_access.permission != "can_download":
            raise HTTPException(status_code=403, detail="Download permission denied. You only have view access for this file.")

    # 1. Check if the file physically exists on local disk
    potential_paths = [
        file_record.file_path,
        os.path.join("Uploads", file_record.stored_filename),
        os.path.join("uploads", file_record.stored_filename),
        os.path.join("Uploads", os.path.basename(file_record.file_path)),
        os.path.join("uploads", os.path.basename(file_record.file_path)),
    ]
    for p in potential_paths:
        if p and os.path.exists(p) and os.path.isfile(p):
            return FileResponse(
                path=p,
                filename=file_record.original_filename,
                media_type="application/octet-stream"
            )

    # 2. Otherwise generate signed URL from Supabase Storage
    try:
        url = get_signed_url(file_record.file_path, expires_in=7200)
        return RedirectResponse(url)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to access file storage: {str(e)}")


# 6. Delete File API
@router.delete("/delete/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_file(
    file_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    file_record = db.query(FileModel).filter(
        FileModel.id == file_id,
        FileModel.owner_id == current_user.id
    ).first()

    if not file_record:
        raise HTTPException(status_code=404, detail="File not found")

    # Delete physical file from local disk if it exists
    potential_paths = [
        file_record.file_path,
        os.path.join("Uploads", file_record.stored_filename),
        os.path.join("uploads", file_record.stored_filename),
    ]
    for p in potential_paths:
        if p and os.path.exists(p) and os.path.isfile(p):
            try:
                os.remove(p)
            except Exception as e:
                print(f"Error removing local file: {e}")

    # Delete file from Supabase Storage
    try:
        remove_from_supabase(file_record.file_path)
    except Exception as e:
        print(f"Error removing from Supabase Storage: {e}")

    # Delete db record
    db.delete(file_record)
    db.commit()

    return {"message": "File deleted successfully"}


class FolderRenameRequest(BaseModel):
    name: str

# 6. Rename Folder API
@router.put("/folder/rename/{folder_id}")
def rename_folder(
    folder_id: int,
    rename_data: FolderRenameRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    folder = db.query(FolderModel).filter(
        FolderModel.id == folder_id,
        FolderModel.owner_id == current_user.id
    ).first()
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    
    folder.name = rename_data.name
    db.commit()
    db.refresh(folder)
    return folder


# 7. Delete Folder API
@router.delete("/folder/delete/{folder_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_folder(
    folder_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    folder = db.query(FolderModel).filter(
        FolderModel.id == folder_id,
        FolderModel.owner_id == current_user.id
    ).first()
    
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")

    def delete_recursive(f_id: int):
        # Find subfolders
        subfolders = db.query(FolderModel).filter(FolderModel.parent_id == f_id).all()
        for sf in subfolders:
            delete_recursive(sf.id)
            
        # Find and delete files in this folder
        files_in_folder = db.query(FileModel).filter(FileModel.folder_id == f_id).all()
        paths_to_delete = [f.file_path for f in files_in_folder if f.file_path]
        if paths_to_delete:
            try:
                remove_multiple_from_supabase(paths_to_delete)
            except Exception as e:
                print(f"Error removing from Supabase Storage: {e}")
        for f in files_in_folder:
            db.delete(f)
            
        # Delete the folder itself
        f_to_delete = db.query(FolderModel).filter(FolderModel.id == f_id).first()
        if f_to_delete:
            db.delete(f_to_delete)

    delete_recursive(folder_id)
    db.commit()
    return {"message": "Folder and its contents deleted successfully"}
