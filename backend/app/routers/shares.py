from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import File, FileShare, User
from ..models.file import file_display_name, file_is_deleted
from ..schemas.file_share import FileShareCreate, FileShareResponse, FileShareUpdate
from ..services.activity_service import log_activity
from ..services.email_service import send_notification_email
from ..services.notification_service import create_notification
from ..utils.dependencies import get_current_user

router = APIRouter(prefix="/api/files", tags=["File Shares"])

VALID_PERMISSIONS = {"VIEWER", "EDITOR"}


def validate_permission(permission: str) -> str:
    value = permission.strip().upper()
    if value not in VALID_PERMISSIONS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Permission must be VIEWER or EDITOR")
    return value


def extract_share_emails(data: FileShareCreate) -> list[str]:
    emails = []
    if data.emails:
        for value in data.emails:
            if isinstance(value, str):
                emails.extend(part.strip().lower() for part in value.split(",") if part.strip())
        if emails:
            return emails
    if data.email:
        return [part.strip().lower() for part in data.email.split(",") if part.strip()]
    return []


@router.post("/{file_id}/share", response_model=FileShareResponse)
def share_file(file_id: int, data: FileShareCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    item = db.get(File, file_id)
    if not item or file_is_deleted(item):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    if item.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the file owner can share this file")

    emails = extract_share_emails(data)
    if not emails:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Provide at least one valid email address")

    permission = validate_permission(data.permission)
    first_share = None
    for target_email in emails:
        target_user = db.query(User).filter(User.email == target_email).first()
        if not target_user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"User with this email was not found: {target_email}")
        if target_user.id == current_user.id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot share a file with yourself")

        existing = db.query(FileShare).filter(
            FileShare.file_id == file_id,
            FileShare.is_revoked.is_(False),
            or_(FileShare.shared_with_user_id == target_user.id, FileShare.shared_with_id == target_user.id),
        ).first()
        if existing:
            existing.permission = permission
            existing.updated_at = __import__("datetime").datetime.utcnow()
            db.commit()
            db.refresh(existing)
            log_activity(db, current_user, "share_update", f"Updated {target_user.email} access to {permission} for {file_display_name(item)}", item.id)
            create_notification(
                db=db,
                user_id=target_user.id,
                type="file_share",
                title="File share updated",
                message=f"{current_user.name} updated your permissions for '{file_display_name(item)}' to {permission}.",
            )
            first_share = existing if first_share is None else first_share
            continue

        share = FileShare(
            file_id=file_id,
            owner_id=current_user.id,
            shared_with_user_id=target_user.id,
            shared_with_id=target_user.id,
            recipient_email=target_user.email,
            permission=permission,
            can_download=True,
            is_revoked=False,
            download_count=0,
        )
        db.add(share)
        db.commit()
        db.refresh(share)
        log_activity(db, current_user, "share", f"Shared {file_display_name(item)} with {target_user.email} as {permission}", item.id)
        create_notification(
            db=db,
            user_id=target_user.id,
            type="file_share",
            title="New file shared",
            message=f"{current_user.name} shared '{file_display_name(item)}' with you.",
        )
        send_notification_email(
            recipient=target_user.email,
            subject_or_message="New file shared with you - TrustShare",
            message=f"{current_user.name} shared '{file_display_name(item)}' with you on TrustShare.",
        )
        if first_share is None:
            first_share = share

    if not first_share:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No share was created")
    return first_share


@router.get("/{file_id}/shares")
def list_file_shares(file_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    item = db.get(File, file_id)
    if not item or file_is_deleted(item):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    if item.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the owner can view share details")

    shares = db.query(FileShare).filter(FileShare.file_id == file_id, FileShare.is_revoked.is_(False)).order_by(FileShare.created_at.desc()).all()
    result = []
    for share in shares:
        recipient_id = share.shared_with_user_id or share.shared_with_id
        user = db.get(User, recipient_id) if recipient_id else None
        result.append({
            "id": share.id,
            "file_id": share.file_id,
            "shared_with_user_id": recipient_id,
            "permission": share.permission,
            "user_name": user.name if user else "Unknown",
            "user_email": user.email if user else "",
            "created_at": share.created_at,
            "updated_at": share.updated_at,
        })
    return result


@router.patch("/{file_id}/shares/{share_id}", response_model=FileShareResponse)
def update_file_share(file_id: int, share_id: int, data: FileShareUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    item = db.get(File, file_id)
    if not item or item.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the file owner can update permissions")

    share = db.query(FileShare).filter(FileShare.id == share_id, FileShare.file_id == file_id).first()
    if not share:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Share record not found")

    share.permission = validate_permission(data.permission)
    db.commit()
    db.refresh(share)
    log_activity(db, current_user, "share_update", f"Updated share permission for {file_display_name(item)} to {share.permission}", item.id)
    return share


@router.delete("/{file_id}/shares/{share_id}")
def delete_file_share(file_id: int, share_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    item = db.get(File, file_id)
    if not item or item.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the file owner can remove access")

    share = db.query(FileShare).filter(FileShare.id == share_id, FileShare.file_id == file_id).first()
    if not share:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Share record not found")

    target_user = db.get(User, share.shared_with_user_id or share.shared_with_id)
    db.delete(share)
    db.commit()
    log_activity(db, current_user, "share_remove", f"Removed access to {file_display_name(item)} for {target_user.email if target_user else 'user'}", item.id)
    return {"message": "Access removed"}
