from fastapi import (
    APIRouter,
    UploadFile,
    File as FastAPIFile,
    HTTPException,
    Depends
)

from fastapi.responses import FileResponse

from pathlib import Path
import uuid
import json

import requests

from sqlalchemy.orm import Session

from database import SessionLocal
from models import File as FileModel, User

from security import get_current_user

from mongodb import create_activity_log

from redis_client import redis_client

from encryption import encrypt_file, decrypt_file

from cloudinary_storage import (
    upload_encrypted_file,
    get_encrypted_file_url
)


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
    # READ ORIGINAL FILE
    # -----------------------------------------------------

    try:

        file_data = await file.read()

        if not file_data:

            raise HTTPException(
                status_code=400,
                detail="Uploaded file is empty"
            )

    except HTTPException:

        raise

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=(
                "Unable to read uploaded file: "
                f"{error}"
            )
        )


    # -----------------------------------------------------
    # ENCRYPT FILE USING AES-256-GCM
    # -----------------------------------------------------

    try:

        encrypted_data = encrypt_file(
            file_data
        )

        print(
            "File encrypted successfully."
        )

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=(
                "Unable to encrypt file: "
                f"{error}"
            )
        )


    # -----------------------------------------------------
    # SAVE ENCRYPTED FILE LOCALLY
    #
    # Kept temporarily as a local backup while we test
    # Cloudinary integration.
    # -----------------------------------------------------

    try:

        with open(
            file_path,
            "wb"
        ) as buffer:

            buffer.write(
                encrypted_data
            )

        print(
            "Encrypted file saved locally."
        )

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=(
                "Unable to save encrypted file: "
                f"{error}"
            )
        )


    # -----------------------------------------------------
    # UPLOAD ENCRYPTED FILE TO CLOUDINARY
    # -----------------------------------------------------

    cloudinary_public_id = (
        f"trust_share_{file_id}"
    )

    try:

        cloudinary_result = upload_encrypted_file(

            encrypted_data,

            cloudinary_public_id

        )

        cloudinary_public_id = (

            cloudinary_result.get(
                "public_id"
            )

            or cloudinary_public_id

        )

        print(
            "Encrypted file uploaded to Cloudinary."
        )

        print(
            "Cloudinary Public ID:",
            cloudinary_public_id
        )

        print(
            "Cloudinary Resource Type:",
            cloudinary_result.get(
                "resource_type"
            )
        )

    except Exception as error:

        # Remove local encrypted file
        # if Cloudinary upload fails

        if file_path.exists():

            file_path.unlink()

        raise HTTPException(
            status_code=500,
            detail=(
                "Unable to upload encrypted file "
                f"to Cloudinary: {error}"
            )
        )


    # -----------------------------------------------------
    # SAVE FILE INFORMATION TO POSTGRESQL
    # -----------------------------------------------------

    try:

        new_file = FileModel(

            filename=original_filename,

            stored_filename=stored_filename,

            file_path=str(file_path),

            owner_id=current_user.id,

            cloudinary_public_id=(
                cloudinary_public_id
            )

        )

        db.add(new_file)

        db.commit()

        db.refresh(new_file)

        print(
            "File information saved to PostgreSQL."
        )

    except Exception as error:

        db.rollback()

        # Remove local encrypted file

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

        print(
            "Upload activity saved to MongoDB."
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
            "File uploaded, encrypted, and stored in Cloudinary successfully",

        "file_id":
            new_file.id,

        "filename":
            new_file.filename,

        "stored_filename":
            new_file.stored_filename,

        "owner_id":
            new_file.owner_id,

        "cloudinary_public_id":
            new_file.cloudinary_public_id

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
                    file.owner_id,

                "cloudinary_public_id":
                    file.cloudinary_public_id

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
    # CHECK CLOUDINARY PUBLIC ID
    # -----------------------------------------------------

    if not file.cloudinary_public_id:

        raise HTTPException(
            status_code=404,
            detail=(
                "Cloudinary file information "
                "is not available"
            )
        )


    # -----------------------------------------------------
    # GENERATE CLOUDINARY URL
    # -----------------------------------------------------

    try:

        cloudinary_url = get_encrypted_file_url(

            file.cloudinary_public_id

        )

        print(
            "Cloudinary URL generated successfully."
        )

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=(
                "Unable to generate Cloudinary "
                f"file URL: {error}"
            )
        )


    # -----------------------------------------------------
    # RETRIEVE ENCRYPTED FILE FROM CLOUDINARY
    # -----------------------------------------------------

    try:

        response = requests.get(

            cloudinary_url,

            timeout=30

        )

        if response.status_code != 200:

            raise HTTPException(

                status_code=500,

                detail=(
                    "Unable to retrieve encrypted "
                    "file from Cloudinary"
                )

            )

        encrypted_data = response.content

        print(
            "Encrypted file retrieved from Cloudinary."
        )

        print(
            "Encrypted bytes:",
            len(encrypted_data)
        )

    except HTTPException:

        raise

    except Exception as error:

        raise HTTPException(

            status_code=500,

            detail=(
                "Unable to download encrypted "
                f"file from Cloudinary: {error}"
            )

        )


    # -----------------------------------------------------
    # DECRYPT FILE
    # -----------------------------------------------------

    try:

        decrypted_data = decrypt_file(

            encrypted_data

        )

        print(
            "File decrypted successfully."
        )

    except Exception as error:

        raise HTTPException(

            status_code=500,

            detail=(
                "Unable to decrypt file: "
                f"{error}"
            )

        )


    # -----------------------------------------------------
    # CREATE TEMPORARY DECRYPTED FILE
    # -----------------------------------------------------

    temp_file_path = (

        UPLOAD_DIR /

        f"temp_{uuid.uuid4().hex}_{file.filename}"

    )

    try:

        with open(

            temp_file_path,

            "wb"

        ) as decrypted_file:

            decrypted_file.write(

                decrypted_data

            )

        print(
            "Temporary decrypted file created."
        )

    except Exception as error:

        raise HTTPException(

            status_code=500,

            detail=(
                "Unable to create decrypted file: "
                f"{error}"
            )

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
    # RETURN ORIGINAL FILE
    # -----------------------------------------------------

    return FileResponse(

        path=str(temp_file_path),

        filename=file.filename,

        media_type="application/octet-stream"

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


    # -----------------------------------------------------
    # SAVE FILE INFORMATION
    # -----------------------------------------------------

    filename = file.filename

    cloudinary_public_id = (
        file.cloudinary_public_id
    )


    # -----------------------------------------------------
    # DELETE LOCAL ENCRYPTED FILE
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
    # DELETE CLOUDINARY FILE
    # -----------------------------------------------------
    #
    # NOTE:
    # Cloudinary deletion will be added after the
    # download workflow is fully tested.
    #
    # We intentionally keep the Cloudinary asset for
    # now so testing is safe.
    # -----------------------------------------------------


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