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
import json

from sqlalchemy.orm import Session

from database import SessionLocal
from models import File as FileModel, User

from security import get_current_user

from mongodb import create_activity_log

from redis_client import redis_client


# =========================================================
# FILE ROUTER
# =========================================================

router = APIRouter(
    prefix="/files",
    tags=["Files"]
)


# =========================================================
# UPLOAD DIRECTORY
# =========================================================

UPLOAD_DIR = Path("uploads")

UPLOAD_DIR.mkdir(
    parents=True,
    exist_ok=True
)


# =========================================================
# DATABASE DEPENDENCY
# =========================================================

def get_db():

    db = SessionLocal()

    try:
        yield db

    finally:
        db.close()


# =========================================================
# UPLOAD FILE
# =========================================================

@router.post("/upload")
async def upload_file(
    file: UploadFile = FastAPIFile(...),

    current_user: User = Depends(
        get_current_user
    ),

    db: Session = Depends(
        get_db
    )
):

    # -----------------------------------------------------
    # CHECK FILE NAME
    # -----------------------------------------------------

    if not file.filename:

        raise HTTPException(
            status_code=400,
            detail="File name is required"
        )


    # -----------------------------------------------------
    # CREATE UNIQUE FILE NAME
    # -----------------------------------------------------

    file_id = uuid.uuid4().hex

    original_filename = Path(
        file.filename
    ).name

    stored_filename = (
        f"{file_id}_{original_filename}"
    )

    file_path = (
        UPLOAD_DIR /
        stored_filename
    )


    # -----------------------------------------------------
    # SAVE PHYSICAL FILE
    # -----------------------------------------------------

    try:

        with open(
            file_path,
            "wb"
        ) as buffer:

            shutil.copyfileobj(
                file.file,
                buffer
            )

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=f"Unable to save file: {error}"
        )


    # -----------------------------------------------------
    # SAVE FILE INFORMATION TO POSTGRESQL
    # -----------------------------------------------------

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

    except Exception as error:

        db.rollback()

        # Remove physical file if database fails

        if file_path.exists():

            file_path.unlink()

        raise HTTPException(
            status_code=500,
            detail=(
                "Unable to save file information "
                f"to database: {error}"
            )
        )


    # -----------------------------------------------------
    # CLEAR REDIS CACHE
    # -----------------------------------------------------

    try:

        redis_client.delete(
            f"user_files:{current_user.id}"
        )

        print(
            "Redis file cache cleared after upload."
        )

    except Exception as error:

        print(
            "Redis cache clear failed:",
            error
        )


    # -----------------------------------------------------
    # SAVE ACTIVITY TO MONGODB
    # -----------------------------------------------------

    try:

        create_activity_log(

            user_id=current_user.id,

            action="upload",

            filename=original_filename

        )

    except Exception as error:

        print(
            "MongoDB activity log failed:",
            error
        )


    # -----------------------------------------------------
    # RESPONSE
    # -----------------------------------------------------

    return {

        "message":
            "File uploaded successfully",

        "file_id":
            new_file.id,

        "filename":
            new_file.filename,

        "stored_filename":
            new_file.stored_filename,

        "owner_id":
            new_file.owner_id

    }


# =========================================================
# GET FILES
# =========================================================

@router.get("/")
def get_files(
    current_user: User = Depends(
        get_current_user
    ),

    db: Session = Depends(
        get_db
    )
):

    cache_key = (
        f"user_files:{current_user.id}"
    )


    # -----------------------------------------------------
    # CHECK REDIS CACHE
    # -----------------------------------------------------

    try:

        cached_files = redis_client.get(
            cache_key
        )

        if cached_files:

            print(
                "Returning files from Redis cache."
            )

            return json.loads(
                cached_files
            )

    except Exception as error:

        print(
            "Redis cache read failed:",
            error
        )


    # -----------------------------------------------------
    # GET FILES FROM POSTGRESQL
    # -----------------------------------------------------

    try:

        files = (

            db.query(FileModel)

            .filter(
                FileModel.owner_id
                == current_user.id
            )

            .all()

        )

        file_list = [

            {

                "id":
                    file.id,

                "filename":
                    file.filename,

                "stored_filename":
                    file.stored_filename,

                "file_path":
                    file.file_path,

                "owner_id":
                    file.owner_id

            }

            for file in files

        ]


    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=(
                "Unable to retrieve files: "
                f"{error}"
            )
        )


    # -----------------------------------------------------
    # SAVE FILE LIST TO REDIS
    # -----------------------------------------------------

    try:

        redis_client.setex(

            cache_key,

            300,

            json.dumps(file_list)

        )

        print(
            "Files stored in Redis cache."
        )

    except Exception as error:

        print(
            "Redis cache write failed:",
            error
        )


    return file_list


# =========================================================
# DOWNLOAD FILE
# =========================================================

@router.get(
    "/download/{file_id}"
)
def download_file(
    file_id: int,

    current_user: User = Depends(
        get_current_user
    ),

    db: Session = Depends(
        get_db
    )
):

    # -----------------------------------------------------
    # FIND ONLY CURRENT USER'S FILE
    # -----------------------------------------------------

    file = (

        db.query(FileModel)

        .filter(

            FileModel.id == file_id,

            FileModel.owner_id
            == current_user.id

        )

        .first()

    )


    # -----------------------------------------------------
    # FILE NOT FOUND
    # -----------------------------------------------------

    if file is None:

        raise HTTPException(
            status_code=404,
            detail="File not found"
        )


    # -----------------------------------------------------
    # CHECK PHYSICAL FILE
    # -----------------------------------------------------

    path = Path(
        file.file_path
    )

    if not path.exists():

        raise HTTPException(
            status_code=404,
            detail="File does not exist"
        )


    # -----------------------------------------------------
    # SAVE DOWNLOAD ACTIVITY TO MONGODB
    # -----------------------------------------------------

    try:

        create_activity_log(

            user_id=current_user.id,

            action="download",

            filename=file.filename

        )

    except Exception as error:

        print(
            "MongoDB activity log failed:",
            error
        )


    # -----------------------------------------------------
    # RETURN FILE
    # -----------------------------------------------------

    return FileResponse(

        path=str(path),

        filename=file.filename

    )


# =========================================================
# DELETE FILE
# =========================================================

@router.delete(
    "/{file_id}"
)
def delete_file(
    file_id: int,

    current_user: User = Depends(
        get_current_user
    ),

    db: Session = Depends(
        get_db
    )
):

    # -----------------------------------------------------
    # FIND ONLY CURRENT USER'S FILE
    # -----------------------------------------------------

    file = (

        db.query(FileModel)

        .filter(

            FileModel.id == file_id,

            FileModel.owner_id
            == current_user.id

        )

        .first()

    )


    # -----------------------------------------------------
    # FILE NOT FOUND
    # -----------------------------------------------------

    if file is None:

        raise HTTPException(
            status_code=404,
            detail="File not found"
        )


    # Save filename before deleting

    filename = file.filename


    # -----------------------------------------------------
    # DELETE PHYSICAL FILE
    # -----------------------------------------------------

    path = Path(
        file.file_path
    )

    if path.exists():

        try:

            path.unlink()

        except Exception as error:

            raise HTTPException(
                status_code=500,
                detail=(
                    "Unable to delete physical file: "
                    f"{error}"
                )
            )


    # -----------------------------------------------------
    # DELETE DATABASE RECORD
    # -----------------------------------------------------

    try:

        db.delete(file)

        db.commit()

    except Exception as error:

        db.rollback()

        raise HTTPException(
            status_code=500,
            detail=(
                "Unable to delete file information: "
                f"{error}"
            )
        )


    # -----------------------------------------------------
    # CLEAR REDIS CACHE
    # -----------------------------------------------------

    try:

        redis_client.delete(
            f"user_files:{current_user.id}"
        )

        print(
            "Redis file cache cleared after delete."
        )

    except Exception as error:

        print(
            "Redis cache clear failed:",
            error
        )


    # -----------------------------------------------------
    # SAVE DELETE ACTIVITY TO MONGODB
    # -----------------------------------------------------

    try:

        create_activity_log(

            user_id=current_user.id,

            action="delete",

            filename=filename

        )

    except Exception as error:

        print(
            "MongoDB activity log failed:",
            error
        )


    # -----------------------------------------------------
    # RESPONSE
    # -----------------------------------------------------

    return {

        "message":
            "File deleted successfully",

        "file_id":
            file_id

    }