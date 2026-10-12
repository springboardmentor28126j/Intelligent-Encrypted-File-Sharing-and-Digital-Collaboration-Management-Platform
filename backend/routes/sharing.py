import secrets

from datetime import datetime, timedelta, timezone

from fastapi import (

    APIRouter,

    Depends,

    HTTPException,

    Request

)

from fastapi.security import (

    HTTPBearer,

    HTTPAuthorizationCredentials

)

from sqlalchemy.orm import Session

from database import SessionLocal

from models import File, FileShare, User, Notification

from pathlib import Path

import uuid

import requests

from fastapi.responses import FileResponse

from starlette.background import BackgroundTask

from encryption import decrypt_file

from cloudinary_storage import get_encrypted_file_url

from mongodb import (

    create_activity_log,

    create_security_alert

)

# =========================================================

# ROUTER

# =========================================================

router = APIRouter(

    prefix="/sharing",

    tags=["File Sharing"]

)

# =========================================================

# SECURITY

# =========================================================

security = HTTPBearer()

# =========================================================

# DATABASE

# =========================================================

def get_db():

    db = SessionLocal()

    try:

        yield db

    finally:

        db.close()

# =========================================================

# CURRENT USER

# =========================================================

def get_current_user(

    credentials: HTTPAuthorizationCredentials = Depends(

        security

    ),

    db: Session = Depends(

        get_db

    )

):

    token = credentials.credentials

    from security import decode_access_token

    try:

        payload = decode_access_token(

            token

        )

    except Exception:

        raise HTTPException(

            status_code=401,

            detail="Invalid or expired token"

        )

    user_id = payload.get(

        "user_id"

    )

    if not user_id:

        raise HTTPException(

            status_code=401,

            detail="Invalid token"

        )

    user = (

        db.query(User)

        .filter(

            User.id == user_id

        )

        .first()

    )

    if not user:

        raise HTTPException(

            status_code=401,

            detail="User not found"

        )

    return user

# =========================================================

def create_file_shared_notification(

    db: Session,

    recipient_id: int,

    sender_name: str,

    filename: str,

):

    """Create a notification for the recipient after a share is saved."""

    try:

        notification = Notification(

            user_id=recipient_id,

            message=f"{sender_name} shared a file with you: {filename}",

            type="file_shared",

            is_read=False,

        )

        db.add(notification)

        db.commit()

        print(f"Notification created for user_id={recipient_id}")

    except Exception as error:

        db.rollback()

        # A notification failure should not undo a successful file share.

        print(f"Failed to create file-share notification: {error}")





def create_share_expired_notification(

    db: Session,

    recipient_id: int,

    filename: str,

    share_id: int,

    expires_at: datetime,

):

    """Create one expiration notification per share, on the first request after expiry."""

    try:

        message = f"The shared link for {filename} has expired."



        # Avoid duplicates while allowing a later share of the same filename

        # to generate its own expiration notification.

        existing_notifications = (

            db.query(Notification)

            .filter(

                Notification.user_id == recipient_id,

                Notification.type == "share_link_expired",

                Notification.message == message,

            )

            .all()

        )



        expiry_time = expires_at

        if expiry_time.tzinfo is None:

            expiry_time = expiry_time.replace(tzinfo=timezone.utc)



        for existing in existing_notifications:

            created_time = existing.created_at

            if created_time is None:

                continue

            if created_time.tzinfo is None:

                created_time = created_time.replace(tzinfo=timezone.utc)

            if created_time >= expiry_time:

                print(

                    f"Expiration notification already exists for "

                    f"user_id={recipient_id}, share_id={share_id}"

                )

                return



        db.add(

            Notification(

                user_id=recipient_id,

                message=message,

                type="share_link_expired",

                is_read=False,

            )

        )

        db.commit()

        print(

            f"Expiration notification created for "

            f"user_id={recipient_id}, share_id={share_id}"

        )

    except Exception as error:

        db.rollback()

        # Notification failure must not block file-list access.

        print(f"Failed to create share-expired notification: {error}")

# SHARE FILE

# =========================================================

@router.post(

    "/files/{file_id}/share"

)

def share_file(

    request: Request,

    file_id: int,

    recipient_email: str,

    permission: str = "download",

    expires_in_minutes: int | None = None,

    db: Session = Depends(

        get_db

    ),

    current_user: User = Depends(

        get_current_user

    )

):

    # -----------------------------------------------------

    # GET CLIENT IP ADDRESS

    # -----------------------------------------------------

    ip_address = request.client.host

    print(

        "Share request IP:",

        ip_address

    )

    # -----------------------------------------------------

    # CLEAN EMAIL

    # -----------------------------------------------------

    recipient_email = (

        recipient_email

        .strip()

        .lower()

    )

    # -----------------------------------------------------

    # VALIDATE PERMISSION

    # -----------------------------------------------------

    if permission not in [

        "view",

        "download"

    ]:

        raise HTTPException(

            status_code=400,

            detail=(

                "Permission must be "

                "'view' or 'download'."

            )

        )

    # -----------------------------------------------------

    # VALIDATE EXPIRATION

    # -----------------------------------------------------

    if expires_in_minutes is not None:

        if expires_in_minutes <= 0:

            raise HTTPException(

                status_code=400,

                detail=(

                    "Expiration time must be "

                    "greater than 0 minutes."

                )

            )

    # -----------------------------------------------------

    # FIND FILE

    # -----------------------------------------------------

    file = (

        db.query(File)

        .filter(

            File.id == file_id

        )

        .first()

    )

    if not file:

        raise HTTPException(

            status_code=404,

            detail="File not found."

        )

    # -----------------------------------------------------

    # ONLY OWNER CAN SHARE

    # -----------------------------------------------------

    if file.owner_id != current_user.id:

        raise HTTPException(

            status_code=403,

            detail=(

                "You are not allowed "

                "to share this file."

            )

        )

    # -----------------------------------------------------

    # FIND RECIPIENT

    # -----------------------------------------------------

    recipient = (

        db.query(User)

        .filter(

            User.email.ilike(

                recipient_email

            )

        )

        .first()

    )

    if not recipient:

        raise HTTPException(

            status_code=404,

            detail=(

                "Recipient email is "

                "not registered."

            )

        )

    # -----------------------------------------------------

    # DON'T SHARE WITH YOURSELF

    # -----------------------------------------------------

    if recipient.id == current_user.id:

        raise HTTPException(

            status_code=400,

            detail=(

                "You cannot share a file "

                "with yourself."

            )

        )

    # -----------------------------------------------------

    # CALCULATE EXPIRATION

    # -----------------------------------------------------

    expires_at = None

    if expires_in_minutes is not None:

        expires_at = (

            datetime.now(

                timezone.utc

            )

            + timedelta(

                minutes=expires_in_minutes

            )

        )

    print(

        "DEBUG SHARE:",

        "file_id =", file_id,

        "owner_id =", current_user.id,

        "recipient_id =", recipient.id,

        "recipient_email =", recipient.email,

        "permission =", permission,

        "expires_at =", expires_at

    )

    # -----------------------------------------------------

    # CHECK EXISTING SHARE

    # -----------------------------------------------------

    existing_share = (

        db.query(FileShare)

        .filter(

            FileShare.file_id == file_id,

            FileShare.shared_with_user_id

            == recipient.id

        )

        .first()

    )

    # =====================================================

    # UPDATE EXISTING SHARE

    # =====================================================

    if existing_share:

        existing_share.owner_id = (

            current_user.id

        )

        existing_share.shared_with_user_id = (

            recipient.id

        )

        existing_share.permission = (

            permission

        )

        existing_share.expires_at = (

            expires_at

        )

        # Record the latest time the sharing settings were updated.

        existing_share.created_at = datetime.now(timezone.utc)

        db.commit()

        db.refresh(

            existing_share

        )

        create_file_shared_notification(

            db=db,

            recipient_id=recipient.id,

            sender_name=current_user.name,

            filename=file.filename,

        )

        print(

            "DEBUG EXISTING SHARE UPDATED:",

            existing_share.id

        )

        # -------------------------------------------------

        # SAVE SHARE ACTIVITY

        # -------------------------------------------------

        try:

            create_activity_log(

                user_id=current_user.id,

                action="share",

                filename=file.filename,

                status="success",

                details=(

                    "File sharing permission "

                    f"updated for {recipient.email}"

                ),

                target_user=recipient.email,

                ip_address=ip_address

            )

            print(

                "Share update activity "

                "saved to MongoDB."

            )

            print(

                "Logged IP address:",

                ip_address

            )

        except Exception as error:

            print(

                "MongoDB activity log failed:",

                error

            )

        # -------------------------------------------------

        # SAVE SECURITY ALERT

        # -------------------------------------------------

        try:

            create_security_alert(

                user_id=current_user.id,

                alert_type="file_shared",

                severity="medium",

                message=(

                    f"File sharing permission "

                    f"was updated for "

                    f"{file.filename} with "

                    f"{recipient.email}."

                ),

                filename=file.filename,

                ip_address=ip_address

            )

            print(

                "Share update security alert "

                "saved to MongoDB."

            )

        except Exception as error:

            print(

                "MongoDB security alert failed:",

                error

            )

        # -------------------------------------------------

        # RETURN RESULT

        # -------------------------------------------------

        return {

            "success": True,

            "message":

                "File sharing permission updated.",

            "share_id":

                existing_share.id,

            "file_id":

                existing_share.file_id,

            "owner_id":

                existing_share.owner_id,

            "shared_with_user_id":

                existing_share.shared_with_user_id,

            "recipient_email":

                recipient.email,

            "permission":

                existing_share.permission,

            "expires_at":

                existing_share.expires_at,

            "created_at":

                existing_share.created_at

        }

    # =====================================================

    # GENERATE SECURE SHARE TOKEN

    # =====================================================

    share_token = secrets.token_urlsafe(

        32

    )

    # =====================================================

    # CREATE NEW SHARE

    # =====================================================

    new_share = FileShare(

        file_id=file_id,

        owner_id=current_user.id,

        shared_with_user_id=recipient.id,

        permission=permission,

        share_token=share_token,

        expires_at=expires_at

    )

    db.add(

        new_share

    )

    db.commit()

    db.refresh(

        new_share

    )

    create_file_shared_notification(

        db=db,

        recipient_id=recipient.id,

        sender_name=current_user.name,

        filename=file.filename,

    )

    print(

        "DEBUG NEW SHARE CREATED:",

        "share_id =", new_share.id,

        "file_id =", new_share.file_id,

        "owner_id =", new_share.owner_id,

        "shared_with_user_id =",

        new_share.shared_with_user_id

    )

    # -----------------------------------------------------

    # SAVE SHARE ACTIVITY TO MONGODB

    # -----------------------------------------------------

    try:

        create_activity_log(

            user_id=current_user.id,

            action="share",

            filename=file.filename,

            status="success",

            details=(

                f"File shared with "

                f"{recipient.email}"

            ),

            target_user=recipient.email,

            ip_address=ip_address

        )

        print(

            "Share activity saved to MongoDB."

        )

        print(

            "Logged IP address:",

            ip_address

        )

    except Exception as error:

        print(

            "MongoDB activity log failed:",

            error

        )

    # -----------------------------------------------------

    # SAVE SECURITY ALERT TO MONGODB

    # -----------------------------------------------------

    try:

        create_security_alert(

            user_id=current_user.id,

            alert_type="file_shared",

            severity="medium",

            message=(

                f"File {file.filename} was shared "

                f"with {recipient.email}."

            ),

            filename=file.filename,

            ip_address=ip_address

        )

        print(

            "Share security alert "

            "saved to MongoDB."

        )

    except Exception as error:

        print(

            "MongoDB security alert failed:",

            error

        )

    # -----------------------------------------------------

    # RETURN RESULT

    # -----------------------------------------------------

    return {

        "success": True,

        "message":

            "File shared successfully.",

        "share_id":

            new_share.id,

        "file_id":

            new_share.file_id,

        "owner_id":

            new_share.owner_id,

        "shared_with_user_id":

            new_share.shared_with_user_id,

        "recipient_email":

            recipient.email,

        "permission":

            new_share.permission,

        "expires_at":

            new_share.expires_at,

        "created_at":

            new_share.created_at

    }

# =========================================================

# GET FILES SHARED WITH CURRENT USER

# =========================================================

@router.post("/files/{file_id}/link")
def create_public_share_link(
    request: Request,
    file_id: int,
    permission: str = "download",
    expires_in_minutes: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a bearer link for someone who does not need a TrustShare account."""
    if permission not in {"view", "download"}:
        raise HTTPException(status_code=400, detail="Permission must be 'view' or 'download'.")
    if expires_in_minutes is not None and expires_in_minutes <= 0:
        raise HTTPException(status_code=400, detail="Expiration must be greater than 0 minutes.")

    file = db.query(File).filter(File.id == file_id, File.owner_id == current_user.id).first()
    if file is None:
        raise HTTPException(status_code=404, detail="File not found or you are not the owner.")

    expires_at = None
    if expires_in_minutes is not None:
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=expires_in_minutes)

    share = FileShare(
        file_id=file.id,
        owner_id=current_user.id,
        shared_with_user_id=None,
        permission=permission,
        share_token=secrets.token_urlsafe(32),
        expires_at=expires_at,
        created_at=datetime.now(timezone.utc),
    )
    db.add(share)
    db.commit()
    db.refresh(share)

    frontend_base = request.headers.get("origin") or "http://localhost:3000"
    frontend_base = frontend_base.rstrip("/")
    return {
        "success": True,
        "share_id": share.id,
        "share_token": share.share_token,
        "share_url": f"{frontend_base}/shared/{share.share_token}",
        "permission": share.permission,
        "expires_at": share.expires_at,
        "message": "Public share link created successfully.",
    }


def _get_valid_public_share(token: str, db: Session):
    share = db.query(FileShare).filter(
        FileShare.share_token == token,
        FileShare.shared_with_user_id.is_(None),
    ).first()
    if share is None:
        raise HTTPException(status_code=404, detail="This share link is invalid or has been revoked.")
    if share.expires_at is not None:
        expires_at = share.expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at <= datetime.now(timezone.utc):
            raise HTTPException(status_code=410, detail="This share link has expired.")
    file = db.query(File).filter(File.id == share.file_id, File.owner_id == share.owner_id).first()
    if file is None:
        raise HTTPException(status_code=404, detail="The shared file no longer exists.")
    return share, file


@router.get("/link/{token}")
def get_public_share_details(token: str, db: Session = Depends(get_db)):
    """Return safe file details; never expose storage paths or encryption identifiers."""
    share, file = _get_valid_public_share(token, db)
    return {
        "success": True,
        "filename": Path(file.filename).name,
        "permission": share.permission,
        "expires_at": share.expires_at,
        "download_allowed": share.permission == "download",
    }


@router.get("/link/{token}/view")
def view_public_shared_file(token: str, db: Session = Depends(get_db)):
    """Return a safe text preview only for a valid, unexpired view-only link."""
    share, file = _get_valid_public_share(token, db)

    if share.permission != "view":
        raise HTTPException(
            status_code=403,
            detail="This link allows downloads, not view-only preview.",
        )

    # Preview plain-text formats only; never render arbitrary HTML.
    safe_filename = Path(file.filename).name
    allowed_extensions = {".txt", ".md", ".csv", ".json", ".log"}
    if Path(safe_filename).suffix.lower() not in allowed_extensions:
        raise HTTPException(
            status_code=415,
            detail="Preview is currently supported for TXT, MD, CSV, JSON, and LOG files only.",
        )

    if not file.cloudinary_public_id:
        raise HTTPException(
            status_code=404,
            detail="Cloudinary file information is unavailable for this file.",
        )

    try:
        cloudinary_url = get_encrypted_file_url(file.cloudinary_public_id)
        response = requests.get(cloudinary_url, timeout=30)
        response.raise_for_status()
        decrypted_data = decrypt_file(response.content)
    except Exception as error:
        print(f"Public preview retrieval/decryption failed for share {share.id}: {error}")
        raise HTTPException(
            status_code=502,
            detail="Unable to retrieve or decrypt the shared file.",
        )

    if len(decrypted_data) > 1_000_000:
        raise HTTPException(
            status_code=413,
            detail="This file is too large to preview (maximum 1 MB).",
        )

    try:
        content = decrypted_data.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(
            status_code=415,
            detail="This file is not valid UTF-8 text and cannot be previewed.",
        )

    try:
        create_activity_log(
            user_id=share.owner_id,
            action="public_link_view",
            filename=file.filename,
            status="success",
            details=f"Viewed via public share link #{share.id}",
            target_user=None,
        )
    except Exception as error:
        print(f"Public link preview activity log failed: {error}")

    return {"success": True, "filename": safe_filename, "content": content}


@router.get("/link/{token}/download")
def download_public_shared_file(token: str, db: Session = Depends(get_db)):
    """Download through a valid public link only when its permission allows downloads."""
    share, file = _get_valid_public_share(token, db)
    if share.permission != "download":
        raise HTTPException(status_code=403, detail="This link is view-only; downloading is disabled.")
    if not file.cloudinary_public_id:
        raise HTTPException(status_code=404, detail="Cloudinary file information is unavailable for this file.")
    try:
        cloudinary_url = get_encrypted_file_url(file.cloudinary_public_id)
        response = requests.get(cloudinary_url, timeout=30)
        response.raise_for_status()
        decrypted_data = decrypt_file(response.content)
    except Exception as error:
        print(f"Public shared-file retrieval/decryption failed for share {share.id}: {error}")
        raise HTTPException(status_code=502, detail="Unable to retrieve or decrypt the shared file.")

    upload_dir = Path("uploads")
    upload_dir.mkdir(parents=True, exist_ok=True)
    safe_filename = Path(file.filename).name
    temp_path = upload_dir / f"public_shared_{uuid.uuid4().hex}_{safe_filename}"
    try:
        temp_path.write_bytes(decrypted_data)
    except OSError as error:
        print(f"Unable to prepare public download: {error}")
        raise HTTPException(status_code=500, detail="Unable to prepare the downloaded file.")

    try:
        create_activity_log(
            user_id=share.owner_id,
            action="public_link_download",
            filename=file.filename,
            status="success",
            details=f"Downloaded via public share link #{share.id}",
            target_user=None,
        )
    except Exception as error:
        print(f"Public link download activity log failed: {error}")

    return FileResponse(
        path=str(temp_path),
        filename=safe_filename,
        media_type="application/octet-stream",
        background=BackgroundTask(lambda: temp_path.unlink(missing_ok=True)),
    )


@router.get(

    "/shared-with-me"

)

def get_shared_files(

    db: Session = Depends(

        get_db

    ),

    current_user: User = Depends(

        get_current_user

    )

):

    print(

        "DEBUG SHARED-WITH-ME:",

        "current_user_id =",

        current_user.id,

        "current_user_email =",

        current_user.email

    )

    # -----------------------------------------------------

    # FIND SHARES FOR CURRENT USER

    # -----------------------------------------------------

    shares = (

        db.query(FileShare)

        .filter(

            FileShare.shared_with_user_id

            == current_user.id

        )

        .order_by(

            FileShare.created_at.desc()

        )

        .all()

    )

    print(

        "DEBUG SHARED-WITH-ME:",

        "number_of_shares =",

        len(shares)

    )

    result = []

    # -----------------------------------------------------

    # BUILD RESPONSE

    # -----------------------------------------------------

    for share in shares:

        # -------------------------------------------------

        # CHECK EXPIRATION

        # -------------------------------------------------

        expired = False

        if share.expires_at:

            expires_at = (

                share.expires_at

            )

            if expires_at.tzinfo is None:

                expires_at = (

                    expires_at.replace(

                        tzinfo=timezone.utc

                    )

                )

            if expires_at <= datetime.now(

                timezone.utc

            ):

                expired = True

                create_share_expired_notification(

                    db=db,

                    recipient_id=current_user.id,

                    filename=(

                        db.query(File.filename)

                        .filter(File.id == share.file_id)

                        .scalar()

                        or "Shared file"

                    ),

                    share_id=share.id,

                    expires_at=expires_at,

                )

        # -------------------------------------------------

        # FIND FILE

        # -------------------------------------------------

        file = (

            db.query(File)

            .filter(

                File.id == share.file_id

            )

            .first()

        )

        if not file:

            print(

                "DEBUG SHARED-WITH-ME:",

                "file not found for share",

                share.id

            )

            continue

        # -------------------------------------------------

        # FIND OWNER

        # -------------------------------------------------

        owner = (

            db.query(User)

            .filter(

                User.id == share.owner_id

            )

            .first()

        )

        # -------------------------------------------------

        # ADD RESULT

        # -------------------------------------------------

        result.append({

            "id":

                share.id,

            "share_id":

                share.id,

            "file_id":

                file.id,

            "filename":

                file.filename,

            "owner_id":

                share.owner_id,

            "owner_name":

                owner.name

                if owner

                else None,

            "owner_email":

                owner.email

                if owner

                else None,

            "shared_by":

                owner.name

                if owner

                else None,

            "shared_by_email":

                owner.email

                if owner

                else None,

            "permission":

                share.permission,

            "expires_at":

                share.expires_at,

            "expired":

                expired,

            "created_at":

                share.created_at

        })

    # -----------------------------------------------------

    # DEBUG

    # -----------------------------------------------------

    print(

        "DEBUG SHARED-WITH-ME RESULT:",

        result

    )

    # -----------------------------------------------------

    # RETURN RESULT

    # -----------------------------------------------------

    return {

        "success": True,

        "files": result

    }

# =========================================================

# REVOKE FILE SHARING

# =========================================================

@router.delete(

    "/files/{file_id}/share/{share_id}"

)

def revoke_file_share(

    file_id: int,

    share_id: int,

    db: Session = Depends(

        get_db

    ),

    current_user: User = Depends(

        get_current_user

    )

):

    # -----------------------------------------------------

    # FIND SHARE

    # -----------------------------------------------------

    share = (

        db.query(FileShare)

        .filter(

            FileShare.id == share_id,

            FileShare.file_id == file_id

        )

        .first()

    )

    if not share:

        raise HTTPException(

            status_code=404,

            detail=(

                "Sharing record "

                "not found."

            )

        )

    # -----------------------------------------------------

    # ONLY OWNER CAN REVOKE

    # -----------------------------------------------------

    if share.owner_id != current_user.id:

        raise HTTPException(

            status_code=403,

            detail=(

                "You are not allowed "

                "to revoke this share."

            )

        )

    # -----------------------------------------------------

    # NOTIFY RECIPIENT AND DELETE SHARE

    # -----------------------------------------------------

    file = (

        db.query(File)

        .filter(File.id == share.file_id)

        .first()

    )

    filename = file.filename if file else "the shared file"



    try:

        db.add(

            Notification(

                user_id=share.shared_with_user_id,

                message=f"Your access to {filename} has been revoked.",

                type="file_access_revoked",

                is_read=False,

            )

        )

        # Deleting the share record ensures future access checks cannot find it.

        db.delete(share)

        db.commit()

    except Exception as error:

        db.rollback()

        print(f"Failed to revoke share {share_id}: {error}")

        raise HTTPException(

            status_code=500,

            detail="Unable to revoke file access. Please try again.",

        )

    # -----------------------------------------------------

    # RETURN RESULT

    # -----------------------------------------------------

    return {

        "success": True,

        "message":

            "File sharing revoked successfully."

    }

@router.get("/my-shares")

def get_my_shared_files(

    db: Session = Depends(get_db),

    current_user: User = Depends(get_current_user)

):

    shares = (

        db.query(FileShare)

        .filter(FileShare.owner_id == current_user.id)

        .order_by(FileShare.created_at.desc())

        .all()

    )

    result = []

    for share in shares:

        file = (

            db.query(File)

            .filter(File.id == share.file_id)

            .first()

        )

        if not file:

            continue

        recipient = (

            db.query(User)

            .filter(User.id == share.shared_with_user_id)

            .first()

        )

        expired = False

        if share.expires_at:

            expires_at = share.expires_at

            if expires_at.tzinfo is None:

                expires_at = expires_at.replace(tzinfo=timezone.utc)

            if expires_at <= datetime.now(timezone.utc):

                expired = True

                if share.shared_with_user_id is not None:
                    create_share_expired_notification(
                        db=db,
                        recipient_id=share.shared_with_user_id,
                        filename=file.filename,
                        share_id=share.id,
                        expires_at=expires_at,
                    )

        result.append({

            "id": share.id,

            "share_id": share.id,

            "file_id": file.id,

            "filename": file.filename,

            "recipient_email": recipient.email if recipient else None,

            "recipient_name": recipient.name if recipient else None,

            "permission": share.permission,

            "expires_at": share.expires_at,

            "expired": expired,

            "share_type": "public_link" if share.shared_with_user_id is None else "registered_user",

            "share_token": share.share_token if share.shared_with_user_id is None else None,

            "created_at": share.created_at

        })

    return {

        "success": True,

        "files": result

    }

# =========================================================

# DOWNLOAD A FILE SHARED WITH THE CURRENT USER

# =========================================================

@router.get("/shared/{share_id}/download")

def download_shared_file(

    share_id: int,

    db: Session = Depends(get_db),

    current_user: User = Depends(get_current_user),

):

    """Download a shared file only when the recipient has valid download access."""

    share = (

        db.query(FileShare)

        .filter(

            FileShare.id == share_id,

            FileShare.shared_with_user_id == current_user.id,

        )

        .first()

    )

    if share is None:

        raise HTTPException(status_code=404, detail="Shared file not found.")

    if share.permission != "download":

        raise HTTPException(

            status_code=403,

            detail="You only have view permission for this file.",

        )

    if share.expires_at is not None:

        expires_at = share.expires_at

        if expires_at.tzinfo is None:

            expires_at = expires_at.replace(tzinfo=timezone.utc)

        if expires_at <= datetime.now(timezone.utc):

            raise HTTPException(status_code=403, detail="This file share has expired.")

    file = (

        db.query(File)

        .filter(

            File.id == share.file_id,

            File.owner_id == share.owner_id,

        )

        .first()

    )

    if file is None:

        raise HTTPException(status_code=404, detail="The original file was not found.")

    if not file.cloudinary_public_id:

        raise HTTPException(

            status_code=404,

            detail="Cloudinary file information is unavailable for this file.",

        )

    try:

        cloudinary_url = get_encrypted_file_url(file.cloudinary_public_id)

        response = requests.get(cloudinary_url, timeout=30)

        response.raise_for_status()

        decrypted_data = decrypt_file(response.content)

    except Exception as error:

        print(f"Shared file retrieval/decryption failed for share {share_id}: {error}")

        raise HTTPException(

            status_code=502,

            detail="Unable to retrieve or decrypt the shared file.",

        )

    upload_dir = Path("uploads")

    upload_dir.mkdir(parents=True, exist_ok=True)

    safe_filename = Path(file.filename).name

    temp_path = upload_dir / f"shared_{uuid.uuid4().hex}_{safe_filename}"

    try:

        temp_path.write_bytes(decrypted_data)

    except OSError as error:

        print(f"Unable to prepare shared download: {error}")

        raise HTTPException(status_code=500, detail="Unable to prepare the downloaded file.")

    try:

        create_activity_log(

            user_id=current_user.id,

            action="download",

            filename=file.filename,

            status="success",

            details=f"Downloaded shared file from share #{share.id}",

            target_user=file.owner_id,

        )

    except Exception as error:

        # Activity logging must not prevent a valid download.

        print(f"Shared download activity log failed: {error}")

    return FileResponse(

        path=str(temp_path),

        filename=safe_filename,

        media_type="application/octet-stream",

        background=BackgroundTask(lambda: temp_path.unlink(missing_ok=True)),

    )








