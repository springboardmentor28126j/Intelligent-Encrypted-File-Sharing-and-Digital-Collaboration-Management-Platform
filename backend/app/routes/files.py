import base64
import mimetypes
import uuid

from fastapi import APIRouter, Depends, UploadFile, File as FastFile, HTTPException, status
from fastapi.responses import Response
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.encryption import (
    generate_data_key,
    encrypt_bytes,
    decrypt_bytes,
    wrap_key,
    unwrap_key,
)
from app.core.mongo import log_activity
from app.core.notifications import notify
from app.core.redis_client import create_share_token, list_share_links, revoke_share_token
from app.core.storage import save_file, read_file, delete_file as storage_delete_file
from app.models.models import File, FileShare, Folder, User

router = APIRouter(prefix="/files", tags=["files"])


class RenameRequest(BaseModel):
    filename: str


class MoveFileRequest(BaseModel):
    folder_id: str | None


class ShareLinkRequest(BaseModel):
    permission: str = "read"
    expires_in_seconds: int = 24 * 60 * 60


class ShareWithUserRequest(BaseModel):
    email: EmailStr
    permission: str = "read"


def _b64(data: bytes) -> str:
    return base64.b64encode(data).decode()


def _unb64(data: str) -> bytes:
    return base64.b64decode(data)


def _decrypt_file_record(file_record: File) -> bytes:
    """Reads the encrypted bytes (local disk or S3, whichever is
    configured) and decrypts them in memory."""
    ciphertext = read_file(file_record.storage_path)

    wrapped_key = _unb64(file_record.encrypted_key)
    key_nonce = _unb64(file_record.key_nonce)
    file_nonce = _unb64(file_record.file_nonce)

    data_key = unwrap_key(wrapped_key, key_nonce)
    return decrypt_bytes(ciphertext, data_key, file_nonce)


def _get_owned_file_or_404(file_id: str, db: Session, current_user: User) -> File:
    file_record = db.query(File).filter(File.id == file_id, File.owner_id == current_user.id).first()
    if not file_record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    return file_record


def _get_accessible_file_or_404(file_id: str, db: Session, current_user: User) -> tuple[File, str]:
    """Like _get_owned_file_or_404, but also allows through anyone the file
    has been explicitly shared with. Returns (file_record, permission),
    where permission is 'owner' for the file's owner, or whatever
    permission level ('read'/'write') the share grant specifies."""
    file_record = db.query(File).filter(File.id == file_id).first()
    if not file_record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

    if file_record.owner_id == current_user.id:
        return file_record, "owner"

    share = (
        db.query(FileShare)
        .filter(FileShare.file_id == file_record.id, FileShare.shared_with_email == current_user.email)
        .first()
    )
    if not share:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

    return file_record, share.permission


@router.get("/stats")
def file_stats(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    files = db.query(File).filter(File.owner_id == current_user.id).all()
    total_bytes = sum(f.size_bytes for f in files)
    return {
        "total_files": len(files),
        "total_bytes": total_bytes,
    }


@router.post("/upload")
def upload_file(
    upload: UploadFile = FastFile(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    contents = upload.file.read()

    data_key = generate_data_key()
    ciphertext, file_nonce = encrypt_bytes(contents, data_key)
    wrapped_key, key_nonce = wrap_key(data_key)

    file_id = uuid.uuid4()
    storage_key = f"{file_id}.enc"
    storage_path = save_file(storage_key, ciphertext)

    file_record = File(
        id=file_id,
        owner_id=current_user.id,
        filename=upload.filename,
        storage_path=storage_path,
        size_bytes=len(contents),
        encrypted_key=_b64(wrapped_key),
        key_nonce=_b64(key_nonce),
        file_nonce=_b64(file_nonce),
    )
    db.add(file_record)
    db.commit()

    log_activity(str(current_user.id), "upload", str(file_id))

    return {"id": str(file_id), "filename": upload.filename, "size_bytes": len(contents)}


@router.get("")
def list_files(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    files = db.query(File).filter(File.owner_id == current_user.id).all()
    return [
        {
            "id": str(f.id),
            "filename": f.filename,
            "size_bytes": f.size_bytes,
            "uploaded_at": f.uploaded_at.isoformat(),
            "folder_id": str(f.folder_id) if f.folder_id else None,
        }
        for f in files
    ]


@router.get("/shared-with-me")
def list_shared_with_me(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Files someone else owns but has granted this user access to."""
    rows = (
        db.query(File, FileShare, User)
        .join(FileShare, FileShare.file_id == File.id)
        .join(User, User.id == File.owner_id)
        .filter(FileShare.shared_with_email == current_user.email)
        .all()
    )
    return [
        {
            "id": str(f.id),
            "filename": f.filename,
            "size_bytes": f.size_bytes,
            "uploaded_at": f.uploaded_at.isoformat(),
            "owner_email": owner.email,
            "permission": share.permission,
        }
        for f, share, owner in rows
    ]


@router.get("/{file_id}/download")
def download_file(file_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    file_record, _permission = _get_accessible_file_or_404(file_id, db, current_user)
    plaintext = _decrypt_file_record(file_record)

    log_activity(str(current_user.id), "download", file_id)

    if file_record.owner_id != current_user.id:
        notify(
            db,
            file_record.owner_id,
            "download",
            f"{current_user.email} downloaded your file '{file_record.filename}'",
            resource_id=file_id,
        )

    return Response(
        content=plaintext,
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{file_record.filename}"'},
    )


@router.get("/{file_id}/preview")
def preview_file(file_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Like download, but tells the browser to try to display it inline
    (images, PDFs, text) instead of forcing a save-as dialog."""
    file_record, _permission = _get_accessible_file_or_404(file_id, db, current_user)
    plaintext = _decrypt_file_record(file_record)

    guessed_type, _ = mimetypes.guess_type(file_record.filename)
    media_type = guessed_type or "application/octet-stream"

    log_activity(str(current_user.id), "preview", file_id)

    return Response(
        content=plaintext,
        media_type=media_type,
        headers={"Content-Disposition": f'inline; filename="{file_record.filename}"'},
    )


@router.patch("/{file_id}/rename")
def rename_file(
    file_id: str,
    payload: RenameRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    file_record, permission = _get_accessible_file_or_404(file_id, db, current_user)
    if permission not in ("owner", "write"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You only have read access to this file",
        )

    new_name = payload.filename.strip()
    if not new_name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Filename cannot be empty")

    old_name = file_record.filename
    file_record.filename = new_name
    db.commit()

    log_activity(str(current_user.id), "rename", file_id)

    return {"id": str(file_record.id), "filename": file_record.filename, "previous_filename": old_name}


@router.patch("/{file_id}/move")
def move_file(
    file_id: str,
    payload: MoveFileRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Move a file into a folder, or back to unfiled by passing folder_id: null.
    Only the owner can move a file — a write-share doesn't extend to this."""
    file_record = _get_owned_file_or_404(file_id, db, current_user)

    if payload.folder_id:
        folder = db.query(Folder).filter(Folder.id == payload.folder_id).first()
        if not folder or folder.owner_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Folder not found")

    file_record.folder_id = payload.folder_id
    db.commit()

    log_activity(str(current_user.id), "file_moved", file_id)

    return {"id": file_id, "folder_id": payload.folder_id}


@router.delete("/{file_id}")
def delete_file(file_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    file_record = _get_owned_file_or_404(file_id, db, current_user)

    try:
        storage_delete_file(file_record.storage_path)
    except Exception:
        pass

    db.query(FileShare).filter(FileShare.file_id == file_record.id).delete()
    db.delete(file_record)
    db.commit()

    log_activity(str(current_user.id), "delete", file_id)

    return {"id": file_id, "deleted": True}


# --- Expiring share links (Redis-backed) -----------------------------------

@router.post("/{file_id}/share")
def create_share_link(
    file_id: str,
    payload: ShareLinkRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_owned_file_or_404(file_id, db, current_user)

    token = create_share_token(
        file_id,
        str(current_user.id),
        permission=payload.permission,
        expires_in_seconds=payload.expires_in_seconds,
    )
    log_activity(str(current_user.id), "share_link_created", file_id)

    return {
        "token": token,
        "permission": payload.permission,
        "expires_in_seconds": payload.expires_in_seconds,
        "download_path": f"/share/{token}/download",
    }


@router.get("/{file_id}/share-links")
def get_share_links(file_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _get_owned_file_or_404(file_id, db, current_user)
    return list_share_links(file_id)


@router.delete("/{file_id}/share-links/{token}")
def delete_share_link(
    file_id: str,
    token: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_owned_file_or_404(file_id, db, current_user)
    revoke_share_token(token, file_id=file_id)
    log_activity(str(current_user.id), "share_link_revoked", file_id)
    return {"revoked": True}


# --- Durable "share with a specific person" (Postgres-backed) --------------

@router.post("/{file_id}/shares")
def share_with_user(
    file_id: str,
    payload: ShareWithUserRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    file_record = _get_owned_file_or_404(file_id, db, current_user)

    existing = (
        db.query(FileShare)
        .filter(FileShare.file_id == file_record.id, FileShare.shared_with_email == payload.email)
        .first()
    )
    if existing:
        existing.permission = payload.permission
        db.commit()
        share = existing
    else:
        share = FileShare(
            file_id=file_record.id,
            shared_with_email=payload.email,
            permission=payload.permission,
        )
        db.add(share)
        db.commit()
        db.refresh(share)

    log_activity(str(current_user.id), "shared_with_user", file_id)

    recipient = db.query(User).filter(User.email == payload.email).first()
    if recipient:
        notify(
            db,
            recipient.id,
            "share",
            f"{current_user.email} shared '{file_record.filename}' with you ({payload.permission} access)",
            resource_id=file_id,
        )

    return {
        "id": str(share.id),
        "email": share.shared_with_email,
        "permission": share.permission,
    }


@router.get("/{file_id}/shares")
def list_file_shares(file_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _get_owned_file_or_404(file_id, db, current_user)
    shares = db.query(FileShare).filter(FileShare.file_id == file_id).all()
    return [
        {"id": str(s.id), "email": s.shared_with_email, "permission": s.permission}
        for s in shares
    ]


@router.delete("/shares/{share_id}")
def revoke_user_share(share_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    share = db.query(FileShare).filter(FileShare.id == share_id).first()
    if not share:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Share not found")

    _get_owned_file_or_404(str(share.file_id), db, current_user)

    db.delete(share)
    db.commit()
    return {"revoked": True}
