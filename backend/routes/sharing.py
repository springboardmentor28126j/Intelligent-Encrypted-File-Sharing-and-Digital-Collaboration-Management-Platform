import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from database import SessionLocal
from models import File, FileShare, User


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
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    token = credentials.credentials

    from security import decode_access_token

    try:
        payload = decode_access_token(token)

    except Exception:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token"
        )

    user_id = payload.get("user_id")

    if not user_id:
        raise HTTPException(
            status_code=401,
            detail="Invalid token"
        )

    user = (
        db.query(User)
        .filter(User.id == user_id)
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=401,
            detail="User not found"
        )

    return user


# =========================================================
# SHARE FILE
# =========================================================

@router.post("/files/{file_id}/share")
def share_file(
    file_id: int,
    recipient_email: str,
    permission: str = "download",
    expires_in_minutes: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):

    # -----------------------------------------------------
    # CLEAN EMAIL
    # -----------------------------------------------------

    recipient_email = recipient_email.strip().lower()

    # -----------------------------------------------------
    # VALIDATE PERMISSION
    # -----------------------------------------------------

    if permission not in ["view", "download"]:

        raise HTTPException(
            status_code=400,
            detail="Permission must be 'view' or 'download'."
        )

    # -----------------------------------------------------
    # VALIDATE EXPIRATION
    # -----------------------------------------------------

    if expires_in_minutes is not None:

        if expires_in_minutes <= 0:

            raise HTTPException(
                status_code=400,
                detail="Expiration time must be greater than 0 minutes."
            )

    # -----------------------------------------------------
    # FIND FILE
    # -----------------------------------------------------

    file = (
        db.query(File)
        .filter(File.id == file_id)
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
            detail="You are not allowed to share this file."
        )

    # -----------------------------------------------------
    # FIND RECIPIENT
    # -----------------------------------------------------

    recipient = (
        db.query(User)
        .filter(User.email.ilike(recipient_email))
        .first()
    )

    if not recipient:

        raise HTTPException(
            status_code=404,
            detail="Recipient email is not registered."
        )

    # -----------------------------------------------------
    # DON'T SHARE WITH YOURSELF
    # -----------------------------------------------------

    if recipient.id == current_user.id:

        raise HTTPException(
            status_code=400,
            detail="You cannot share a file with yourself."
        )

    # -----------------------------------------------------
    # CALCULATE EXPIRATION
    # -----------------------------------------------------

    expires_at = None

    if expires_in_minutes is not None:

        expires_at = (
            datetime.now(timezone.utc)
            + timedelta(minutes=expires_in_minutes)
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
            FileShare.shared_with_user_id == recipient.id
        )
        .first()
    )

    # -----------------------------------------------------
    # UPDATE EXISTING SHARE
    # -----------------------------------------------------

    if existing_share:

        existing_share.owner_id = current_user.id
        existing_share.shared_with_user_id = recipient.id
        existing_share.permission = permission
        existing_share.expires_at = expires_at

        db.commit()

        db.refresh(existing_share)

        print(
            "DEBUG EXISTING SHARE UPDATED:",
            existing_share.id
        )

        return {
            "success": True,
            "message": "File sharing permission updated.",
            "share_id": existing_share.id,
            "file_id": existing_share.file_id,
            "owner_id": existing_share.owner_id,
            "shared_with_user_id": existing_share.shared_with_user_id,
            "recipient_email": recipient.email,
            "permission": existing_share.permission,
            "expires_at": existing_share.expires_at,
            "created_at": existing_share.created_at
        }

    # -----------------------------------------------------
    # GENERATE SECURE SHARE TOKEN
    # -----------------------------------------------------

    share_token = secrets.token_urlsafe(32)

    # -----------------------------------------------------
    # CREATE NEW SHARE
    # -----------------------------------------------------

    new_share = FileShare(
        file_id=file_id,
        owner_id=current_user.id,
        shared_with_user_id=recipient.id,
        permission=permission,
        share_token=share_token,
        expires_at=expires_at
    )

    db.add(new_share)

    db.commit()

    db.refresh(new_share)

    print(
        "DEBUG NEW SHARE CREATED:",
        "share_id =", new_share.id,
        "file_id =", new_share.file_id,
        "owner_id =", new_share.owner_id,
        "shared_with_user_id =", new_share.shared_with_user_id
    )

    # -----------------------------------------------------
    # RETURN RESULT
    # -----------------------------------------------------

    return {
        "success": True,
        "message": "File shared successfully.",
        "share_id": new_share.id,
        "file_id": new_share.file_id,
        "owner_id": new_share.owner_id,
        "shared_with_user_id": new_share.shared_with_user_id,
        "recipient_email": recipient.email,
        "permission": new_share.permission,
        "expires_at": new_share.expires_at,
        "created_at": new_share.created_at
    }


# =========================================================
# GET FILES SHARED WITH CURRENT USER
# =========================================================

@router.get("/shared-with-me")
def get_shared_files(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):

    print(
        "DEBUG SHARED-WITH-ME:",
        "current_user_id =", current_user.id,
        "current_user_email =", current_user.email
    )

    # -----------------------------------------------------
    # FIND SHARES FOR CURRENT USER
    # -----------------------------------------------------

    shares = (
        db.query(FileShare)
        .filter(
            FileShare.shared_with_user_id == current_user.id
        )
        .order_by(FileShare.created_at.desc())
        .all()
    )

    print(
        "DEBUG SHARED-WITH-ME:",
        "number_of_shares =", len(shares)
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

            expires_at = share.expires_at

            # PostgreSQL may return timezone-aware
            # or timezone-naive datetime depending
            # on the column configuration.

            if expires_at.tzinfo is None:

                expires_at = expires_at.replace(
                    tzinfo=timezone.utc
                )

            if expires_at <= datetime.now(timezone.utc):

                expired = True

        # -------------------------------------------------
        # FIND FILE
        # -------------------------------------------------

        file = (
            db.query(File)
            .filter(File.id == share.file_id)
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
            .filter(User.id == share.owner_id)
            .first()
        )

        # -------------------------------------------------
        # ADD RESULT
        # -------------------------------------------------

        result.append({

            # Frontend uses this ID when
            # opening the shared file.
            "id": share.id,

            # Keep share_id as well.
            "share_id": share.id,

            # Actual file ID.
            "file_id": file.id,

            # Filename.
            "filename": file.filename,

            # Owner information.
            "owner_id": share.owner_id,
            "owner_name": owner.name if owner else None,
            "owner_email": owner.email if owner else None,

            # Frontend-friendly names.
            "shared_by": owner.name if owner else None,
            "shared_by_email": owner.email if owner else None,

            # Permission.
            "permission": share.permission,

            # Expiration.
            "expires_at": share.expires_at,

            # Helpful frontend flag.
            "expired": expired,

            # Created time.
            "created_at": share.created_at
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

@router.delete("/files/{file_id}/share/{share_id}")
def revoke_file_share(
    file_id: int,
    share_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
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
            detail="Sharing record not found."
        )

    # -----------------------------------------------------
    # ONLY OWNER CAN REVOKE
    # -----------------------------------------------------

    if share.owner_id != current_user.id:

        raise HTTPException(
            status_code=403,
            detail="You are not allowed to revoke this share."
        )

    # -----------------------------------------------------
    # DELETE SHARE
    # -----------------------------------------------------

    db.delete(share)

    db.commit()

    # -----------------------------------------------------
    # RETURN RESULT
    # -----------------------------------------------------

    return {
        "success": True,
        "message": "File sharing revoked successfully."
    }