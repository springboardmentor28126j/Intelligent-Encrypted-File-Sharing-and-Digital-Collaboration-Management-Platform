from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pathlib import Path

from database import SessionLocal
from models import User, File as FileModel
from security import get_current_user


router = APIRouter(
    prefix="/analytics",
    tags=["Storage Analytics"]
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/storage")
def get_storage_analytics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    files = (
        db.query(FileModel)
        .filter(FileModel.owner_id == current_user.id)
        .all()
    )

    total_files = len(files)
    total_bytes = 0

    file_details = []

    for file in files:
        size_bytes = 0

        try:
            if file.file_path:
                path = Path(file.file_path)

                if path.exists():
                    size_bytes = path.stat().st_size

        except Exception as error:
            print(
                f"Unable to calculate size for {file.filename}:",
                error
            )

        total_bytes += size_bytes

        file_details.append({
            "id": file.id,
            "filename": file.filename,
            "size_bytes": size_bytes,
            "size_kb": round(size_bytes / 1024, 2),
            "size_mb": round(size_bytes / (1024 * 1024), 2),
            "storage_type": (
                "Cloud Storage"
                if file.cloudinary_public_id
                else "Server Storage"
            )
        })

    total_kb = total_bytes / 1024
    total_mb = total_bytes / (1024 * 1024)
    total_gb = total_bytes / (1024 * 1024 * 1024)

    return {
        "success": True,
        "total_files": total_files,
        "total_bytes": total_bytes,
        "total_kb": round(total_kb, 2),
        "total_mb": round(total_mb, 2),
        "total_gb": round(total_gb, 4),
        "files": file_details
    }