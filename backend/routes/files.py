from fastapi import (
    APIRouter,
    UploadFile,
    File as FastAPIFile,
    HTTPException,
    Depends
)
from fastapi.responses import FileResponse
from pathlib import Path
import shutil
import uuid

from database import SessionLocal
from models import File as FileModel, User
from security import get_current_user


# ==========================================
# ROUTER
# ==========================================

router = APIRouter(
    prefix="/files",
    tags=["Files"]
)


# ==========================================
# UPLOAD DIRECTORY
# ==========================================

UPLOAD_DIR = Path("uploads")

UPLOAD_DIR.mkdir(
    parents=True,
    exist_ok=True
)


# ==========================================
# UPLOAD FILE
# ==========================================

@router.post("/upload")
async def upload_file(
    file: UploadFile = FastAPIFile(...),
    current_user: User = Depends(get_current_user)
):
    # Check filename
    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="File name is required"
        )

    # Get original filename safely
    original_filename = Path(
        file.filename
    ).name

    # Create unique stored filename
    unique_id = uuid.uuid4().hex

    stored_filename = (
        f"{unique_id}_{original_filename}"
    )

    file_path = UPLOAD_DIR / stored_filename

    try:

        # ==================================
        # SAVE FILE TO DISK
        # ==================================

        with open(
            file_path,
            "wb"
        ) as buffer:

            shutil.copyfileobj(
                file.file,
                buffer
            )

        # ==================================
        # SAVE FILE INFORMATION
        # TO DATABASE
        # ==================================

        db = SessionLocal()

        try:

            new_file = FileModel(
                filename=original_filename,
                stored_filename=stored_filename,
                file_path=str(file_path),
                owner_id=current_user.id
            )

            db.add(new_file)

            db.commit()

            db.refresh(new_file)

            return {
                "message": "File uploaded successfully",
                "file_id": new_file.id,
                "filename": new_file.filename,
                "stored_filename": new_file.stored_filename,
                "owner_id": new_file.owner_id
            }

        except Exception as database_error:

            db.rollback()

            # Remove physical file if
            # database insertion fails
            if file_path.exists():
                file_path.unlink()

            print("================================")
            print("DATABASE ERROR:")
            print(repr(database_error))
            print("================================")

            raise HTTPException(
                status_code=500,
                detail=str(database_error)
            )

        finally:
            db.close()

    except HTTPException:
        raise

    except Exception as error:

        print("================================")
        print("UPLOAD ERROR:")
        print(repr(error))
        print("================================")

        if file_path.exists():
            file_path.unlink()

        raise HTTPException(
            status_code=500,
            detail=str(error)
        )

    finally:
        await file.close()


# ==========================================
# GET MY FILES
# ==========================================

@router.get("/")
def get_files(
    current_user: User = Depends(get_current_user)
):

    db = SessionLocal()

    try:

        files = (
            db.query(FileModel)
            .filter(
                FileModel.owner_id == current_user.id
            )
            .all()
        )

        return [
            {
                "id": file.id,
                "filename": file.filename,
                "stored_filename": file.stored_filename,
                "file_path": file.file_path,
                "owner_id": file.owner_id
            }
            for file in files
        ]

    except Exception as error:

        print("================================")
        print("GET FILES ERROR:")
        print(repr(error))
        print("================================")

        raise HTTPException(
            status_code=500,
            detail=str(error)
        )

    finally:
        db.close()


# ==========================================
# DOWNLOAD FILE
# ==========================================

@router.get("/download/{file_id}")
def download_file(
    file_id: int,
    current_user: User = Depends(get_current_user)
):

    db = SessionLocal()

    try:

        # Only allow owner to download
        file = (
            db.query(FileModel)
            .filter(
                FileModel.id == file_id,
                FileModel.owner_id == current_user.id
            )
            .first()
        )

        if file is None:

            raise HTTPException(
                status_code=404,
                detail="File not found"
            )

        path = Path(
            file.file_path
        )

        if not path.exists():

            raise HTTPException(
                status_code=404,
                detail="File does not exist on the server"
            )

        return FileResponse(
            path=str(path),
            filename=file.filename
        )

    except HTTPException:
        raise

    except Exception as error:

        print("================================")
        print("DOWNLOAD ERROR:")
        print(repr(error))
        print("================================")

        raise HTTPException(
            status_code=500,
            detail=str(error)
        )

    finally:
        db.close()


# ==========================================
# DELETE FILE
# ==========================================

@router.delete("/{file_id}")
def delete_file(
    file_id: int,
    current_user: User = Depends(get_current_user)
):

    db = SessionLocal()

    try:

        # Only allow owner to delete
        file = (
            db.query(FileModel)
            .filter(
                FileModel.id == file_id,
                FileModel.owner_id == current_user.id
            )
            .first()
        )

        if file is None:

            raise HTTPException(
                status_code=404,
                detail="File not found"
            )

        path = Path(
            file.file_path
        )

        # Delete physical file
        if path.exists():
            path.unlink()

        # Delete database record
        db.delete(file)

        db.commit()

        return {
            "message": "File deleted successfully",
            "file_id": file_id
        }

    except HTTPException:
        raise

    except Exception as error:

        db.rollback()

        print("================================")
        print("DELETE ERROR:")
        print(repr(error))
        print("================================")

        raise HTTPException(
            status_code=500,
            detail=str(error)
        )

    finally:
        db.close()