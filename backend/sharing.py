import hashlib
import secrets

from datetime import datetime, timedelta, timezone

from fastapi import HTTPException

from sqlalchemy.orm import Session

from models import File, Share


# =========================================================
# GENERATE SECURE TOKEN
# =========================================================

def generate_share_token() -> str:

    return secrets.token_urlsafe(32)


# =========================================================
# HASH TOKEN BEFORE STORING IT IN THE DATABASE
# =========================================================
#
# The raw token is only ever returned once, at creation time. Only its
# hash is stored, so a database leak alone can never be turned back
# into a working share link.
#
# =========================================================

def hash_share_token(token: str) -> str:

    return hashlib.sha256(
        token.encode("utf-8")
    ).hexdigest()


# =========================================================
# CREATE SHARE LINK
# =========================================================

def create_share(
    db: Session,
    file: File,
    user_id: int,
    permission: str,
    expires_in_hours: int,
    max_downloads: int = None
):

    if permission not in ("view", "download"):

        raise HTTPException(
            status_code=400,
            detail="Permission must be 'view' or 'download'."
        )

    if expires_in_hours <= 0:

        raise HTTPException(
            status_code=400,
            detail="expires_in_hours must be greater than 0."
        )

    if max_downloads is not None and max_downloads <= 0:

        raise HTTPException(
            status_code=400,
            detail="max_downloads must be greater than 0 if provided."
        )

    # The raw token is generated here and returned once by the caller.
    # Only its hash is stored below.
    token = generate_share_token()
    token_hash = hash_share_token(token)

    expires_at = (
        datetime.now(timezone.utc)
        + timedelta(hours=expires_in_hours)
    )

    share = Share(
        file_id=file.id,
        created_by=user_id,
        token_hash=token_hash,
        permission=permission,
        expires_at=expires_at,
        max_downloads=max_downloads,
        revoked=False
    )

    db.add(share)
    db.commit()
    db.refresh(share)

    return share, token


# =========================================================
# VALIDATE SHARE LINK
# =========================================================
#
# Checks token existence, revocation, and expiry. Does NOT check the
# download limit -- that's handled separately by
# check_and_register_access(), since it also needs to know whether
# this particular access should count against the limit.
#
# =========================================================

def get_valid_share(
    db: Session,
    token: str
) -> Share:

    token_hash = hash_share_token(token)

    share = (
        db.query(Share)
        .filter(Share.token_hash == token_hash)
        .first()
    )

    if not share:

        raise HTTPException(
            status_code=404,
            detail="This link is invalid."
        )

    if share.revoked:

        raise HTTPException(
            status_code=410,
            detail="This link has been revoked."
        )

    now = datetime.now(timezone.utc)
    expires_at = share.expires_at

    # Handle databases that return naive datetimes.
    if expires_at.tzinfo is None:

        expires_at = expires_at.replace(
            tzinfo=timezone.utc
        )

    if now > expires_at:

        raise HTTPException(
            status_code=410,
            detail="This link has expired."
        )

    return share


# =========================================================
# CHECK DOWNLOAD LIMIT AND REGISTER ACCESS
# =========================================================
#
# Called after get_valid_share() succeeds and right before serving the
# file. "view" links are never subject to a download limit and never
# increment the counter -- max_downloads is a download-specific concept.
#
# =========================================================

def check_and_register_access(
    db: Session,
    share: Share
) -> None:

    if share.permission == "download":

        if (
            share.max_downloads is not None
            and share.download_count >= share.max_downloads
        ):

            raise HTTPException(
                status_code=410,
                detail="This link has reached its download limit."
            )

        share.download_count += 1
        db.commit()


# =========================================================
# REVOKE SHARE
# =========================================================

def revoke_share(
    db: Session,
    share: Share,
    user_id: int
) -> Share:

    if share.created_by != user_id:

        raise HTTPException(
            status_code=403,
            detail="You can only revoke your own share links."
        )

    share.revoked = True

    db.commit()
    db.refresh(share)

    return share
