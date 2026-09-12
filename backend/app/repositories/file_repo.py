"""
repositories/file_repo.py – Hybrid PostgreSQL & MongoDB data access layer for file metadata and shares.

Handles all persistence operations:
  - PostgreSQL Relational DB (SQLAlchemy) for primary ACID file & share records
  - MongoDB document collection for query caching & search indexing
  - Granular access controls, token lookups, download quotas, and revocation states
"""

from datetime import datetime, timezone
import logging
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.database import SessionLocal
from app.models import File as SQLFile, FileShare as SQLFileShare, User as SQLUser, SharePermission
from app.mongodb import get_files_collection

logger = logging.getLogger("trustshare.file_repo")


def clean_doc(doc: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Clean MongoDB document by converting _id to id if necessary."""
    if not doc:
        return None
    d = dict(doc)
    if "_id" in d:
        d["_id"] = str(d["_id"])
    if "id" not in d and "_id" in d:
        d["id"] = d["_id"]
    return d


def create_file(file_doc: Dict[str, Any], db: Optional[Session] = None) -> Dict[str, Any]:
    """
    Persist a new file metadata record in PostgreSQL and MongoDB.
    """
    # 1. Save in PostgreSQL
    own_session = False
    if db is None:
        db = SessionLocal()
        own_session = True

    try:
        sql_file = SQLFile(
            id=file_doc["id"],
            owner_id=file_doc["owner_id"],
            original_name=file_doc["original_name"],
            storage_key=file_doc.get("storage_key") or file_doc.get("stored_name"),
            storage_backend=file_doc.get("storage_backend", "local"),
            file_size=file_doc["file_size"],
            content_type=file_doc.get("content_type", "application/octet-stream"),
            extension=file_doc["extension"],
            category=file_doc.get("category", "other"),
            sha256_hash=file_doc["sha256_hash"],
            encryption_algorithm=file_doc.get("encryption_algorithm", "AES-256-GCM"),
            encrypted_dek=file_doc.get("encrypted_dek", ""),
            nonce=file_doc.get("nonce", ""),
            description=file_doc.get("description"),
            download_count=file_doc.get("download_count", 0),
            is_public=file_doc.get("is_public", False),
        )
        db.add(sql_file)
        db.commit()
    except Exception as exc:
        db.rollback()
        logger.warning(f"SQL file persist note: {exc}")
    finally:
        if own_session:
            db.close()

    # 2. Save in MongoDB
    try:
        col = get_files_collection()
        doc_to_save = dict(file_doc)
        doc_to_save["_id"] = file_doc["id"]
        col.insert_one(doc_to_save)
    except Exception as exc:
        logger.warning(f"Mongo file persist note: {exc}")

    return clean_doc(file_doc)  # type: ignore


def get_file_by_id(file_id: str, db: Optional[Session] = None) -> Optional[Dict[str, Any]]:
    """
    Find file metadata by unique file_id from PostgreSQL or MongoDB fallback.
    """
    own_session = False
    if db is None:
        db = SessionLocal()
        own_session = True

    try:
        sql_file = db.query(SQLFile).filter(SQLFile.id == file_id).first()
        if sql_file:
            shares = []
            for s in sql_file.shares:
                shares.append({
                    "id": s.id,
                    "share_token": s.share_token,
                    "share_url": f"/share/{s.share_token}",
                    "permission": s.permission.value if hasattr(s.permission, "value") else str(s.permission),
                    "recipient_email": s.recipient_email,
                    "expires_at": s.expires_at.isoformat() if s.expires_at else None,
                    "max_downloads": s.max_downloads,
                    "download_count": s.download_count,
                    "created_at": s.created_at.isoformat() if s.created_at else datetime.now(timezone.utc).isoformat(),
                    "is_revoked": s.is_revoked,
                })

            owner_email = sql_file.owner.email if sql_file.owner else ""
            return {
                "id": sql_file.id,
                "original_name": sql_file.original_name,
                "stored_name": sql_file.storage_key,
                "storage_key": sql_file.storage_key,
                "storage_backend": sql_file.storage_backend,
                "file_size": sql_file.file_size,
                "content_type": sql_file.content_type,
                "extension": sql_file.extension,
                "category": sql_file.category,
                "sha256_hash": sql_file.sha256_hash,
                "owner_id": sql_file.owner_id,
                "owner_email": owner_email,
                "description": sql_file.description,
                "upload_date": sql_file.created_at.isoformat() if sql_file.created_at else datetime.now(timezone.utc).isoformat(),
                "download_count": sql_file.download_count,
                "shares": shares,
                "is_public": sql_file.is_public,
                "encryption_algorithm": sql_file.encryption_algorithm,
                "encrypted_dek": sql_file.encrypted_dek,
                "nonce": sql_file.nonce,
            }
    except Exception as exc:
        logger.warning(f"SQL get_file error: {exc}")
    finally:
        if own_session:
            db.close()

    # Fallback to MongoDB
    col = get_files_collection()
    doc = col.find_one({"id": file_id})
    return clean_doc(doc)


def list_files(
    owner_id: int,
    search: Optional[str] = None,
    category: Optional[str] = None,
    is_admin: bool = False,
    db: Optional[Session] = None,
) -> List[Dict[str, Any]]:
    """
    List files with search and category filters.
    """
    own_session = False
    if db is None:
        db = SessionLocal()
        own_session = True

    try:
        query = db.query(SQLFile)
        if not is_admin:
            query = query.filter(SQLFile.owner_id == owner_id)
        if category and category.lower() != "all":
            query = query.filter(SQLFile.category == category.lower())
        if search and search.strip():
            term = f"%{search.strip()}%"
            query = query.filter(
                or_(
                    SQLFile.original_name.ilike(term),
                    SQLFile.description.ilike(term),
                    SQLFile.extension.ilike(term),
                )
            )
        sql_files = query.order_by(SQLFile.created_at.desc()).all()
        if sql_files:
            results = []
            for f in sql_files:
                shares = [
                    {
                        "id": s.id,
                        "share_token": s.share_token,
                        "share_url": f"/share/{s.share_token}",
                        "permission": s.permission.value if hasattr(s.permission, "value") else str(s.permission),
                        "recipient_email": s.recipient_email,
                        "expires_at": s.expires_at.isoformat() if s.expires_at else None,
                        "max_downloads": s.max_downloads,
                        "download_count": s.download_count,
                        "created_at": s.created_at.isoformat() if s.created_at else datetime.now(timezone.utc).isoformat(),
                        "is_revoked": s.is_revoked,
                    }
                    for s in f.shares if not s.is_revoked
                ]
                results.append({
                    "id": f.id,
                    "original_name": f.original_name,
                    "stored_name": f.storage_key,
                    "storage_key": f.storage_key,
                    "storage_backend": f.storage_backend,
                    "file_size": f.file_size,
                    "content_type": f.content_type,
                    "extension": f.extension,
                    "category": f.category,
                    "sha256_hash": f.sha256_hash,
                    "owner_id": f.owner_id,
                    "owner_email": f.owner.email if f.owner else "",
                    "description": f.description,
                    "upload_date": f.created_at.isoformat() if f.created_at else datetime.now(timezone.utc).isoformat(),
                    "download_count": f.download_count,
                    "shares": shares,
                    "is_public": f.is_public,
                    "encryption_algorithm": f.encryption_algorithm,
                    "encrypted_dek": f.encrypted_dek,
                    "nonce": f.nonce,
                })
            return results
    except Exception as exc:
        logger.warning(f"SQL list_files error: {exc}")
    finally:
        if own_session:
            db.close()

    # Fallback to MongoDB
    col = get_files_collection()
    mongo_query: Dict[str, Any] = {}
    if not is_admin:
        mongo_query["owner_id"] = owner_id
    if category and category.lower() != "all":
        mongo_query["category"] = category.lower()
    if search and search.strip():
        search_term = search.strip()
        mongo_query["$or"] = [
            {"original_name": {"$regex": search_term, "$options": "i"}},
            {"description": {"$regex": search_term, "$options": "i"}},
            {"extension": {"$regex": search_term, "$options": "i"}},
        ]
    docs = col.find(mongo_query)
    cleaned = [clean_doc(d) for d in docs if d is not None]  # type: ignore
    cleaned.sort(key=lambda x: x.get("upload_date", ""), reverse=True)
    return cleaned


def delete_file(file_id: str, db: Optional[Session] = None) -> bool:
    """Delete file metadata record from PostgreSQL and MongoDB."""
    own_session = False
    if db is None:
        db = SessionLocal()
        own_session = True

    try:
        sql_file = db.query(SQLFile).filter(SQLFile.id == file_id).first()
        if sql_file:
            db.delete(sql_file)
            db.commit()
    except Exception as exc:
        db.rollback()
        logger.warning(f"SQL delete_file error: {exc}")
    finally:
        if own_session:
            db.close()

    col = get_files_collection()
    res = col.delete_one({"id": file_id})
    return True


def add_share_link(file_id: str, share_doc: Dict[str, Any], db: Optional[Session] = None) -> bool:
    """Add a share link / recipient record to PostgreSQL and MongoDB."""
    own_session = False
    if db is None:
        db = SessionLocal()
        own_session = True

    try:
        perm_val = share_doc.get("permission", "can_download")
        perm_enum = SharePermission(perm_val) if isinstance(perm_val, str) else perm_val

        exp_at = share_doc.get("expires_at")
        if isinstance(exp_at, str):
            exp_at = datetime.fromisoformat(exp_at)

        recipient_id = share_doc.get("recipient_id")
        recipient_email = share_doc.get("recipient_email")

        # If recipient_email provided without ID, look up user
        if recipient_email and not recipient_id:
            rec_user = db.query(SQLUser).filter(SQLUser.email == recipient_email.lower().strip()).first()
            if rec_user:
                recipient_id = rec_user.id

        new_share = SQLFileShare(
            file_id=file_id,
            owner_id=share_doc.get("created_by") or share_doc.get("owner_id"),
            recipient_id=recipient_id,
            recipient_email=recipient_email,
            share_token=share_doc["share_token"],
            permission=perm_enum,
            expires_at=exp_at,
            max_downloads=share_doc.get("max_downloads"),
            download_count=0,
            is_revoked=False,
        )
        db.add(new_share)
        db.commit()
        share_doc["id"] = new_share.id
    except Exception as exc:
        db.rollback()
        logger.warning(f"SQL add_share_link note: {exc}")
    finally:
        if own_session:
            db.close()

    # Update MongoDB
    col = get_files_collection()
    col.update_one({"id": file_id}, {"$push": {"shares": share_doc}})
    return True


def revoke_share_link(file_id: str, share_token: str, db: Optional[Session] = None) -> bool:
    """Revoke a share link by token in PostgreSQL and MongoDB."""
    own_session = False
    if db is None:
        db = SessionLocal()
        own_session = True

    try:
        share = db.query(SQLFileShare).filter(
            SQLFileShare.file_id == file_id,
            SQLFileShare.share_token == share_token,
        ).first()
        if share:
            share.is_revoked = True
            db.commit()
    except Exception as exc:
        db.rollback()
        logger.warning(f"SQL revoke_share error: {exc}")
    finally:
        if own_session:
            db.close()

    col = get_files_collection()
    col.update_one(
        {"id": file_id},
        {"$pull": {"shares": {"share_token": share_token}}}
    )
    return True


def find_share_by_token(share_token: str, db: Optional[Session] = None) -> Optional[Tuple[Dict[str, Any], Dict[str, Any]]]:
    """Look up file and share record by share token."""
    own_session = False
    if db is None:
        db = SessionLocal()
        own_session = True

    try:
        share = db.query(SQLFileShare).filter(
            SQLFileShare.share_token == share_token,
            SQLFileShare.is_revoked == False,
        ).first()
        if share and share.file:
            f = share.file
            file_doc = {
                "id": f.id,
                "original_name": f.original_name,
                "stored_name": f.storage_key,
                "storage_key": f.storage_key,
                "storage_backend": f.storage_backend,
                "file_size": f.file_size,
                "content_type": f.content_type,
                "extension": f.extension,
                "category": f.category,
                "sha256_hash": f.sha256_hash,
                "owner_id": f.owner_id,
                "owner_email": f.owner.email if f.owner else "",
                "description": f.description,
                "upload_date": f.created_at.isoformat() if f.created_at else datetime.now(timezone.utc).isoformat(),
                "download_count": f.download_count,
                "encryption_algorithm": f.encryption_algorithm,
                "encrypted_dek": f.encrypted_dek,
                "nonce": f.nonce,
            }
            share_doc = {
                "id": share.id,
                "share_token": share.share_token,
                "permission": share.permission.value if hasattr(share.permission, "value") else str(share.permission),
                "expires_at": share.expires_at.isoformat() if share.expires_at else None,
                "max_downloads": share.max_downloads,
                "download_count": share.download_count,
                "created_at": share.created_at.isoformat() if share.created_at else datetime.now(timezone.utc).isoformat(),
                "recipient_email": share.recipient_email,
                "recipient_id": share.recipient_id,
                "is_revoked": share.is_revoked,
            }
            return file_doc, share_doc
    except Exception as exc:
        logger.warning(f"SQL find_share_by_token error: {exc}")
    finally:
        if own_session:
            db.close()

    # MongoDB fallback
    col = get_files_collection()
    file_doc = col.find_one({"shares.share_token": share_token})
    if not file_doc:
        return None

    cleaned_file = clean_doc(file_doc)
    shares = cleaned_file.get("shares", [])  # type: ignore
    for s in shares:
        if s.get("share_token") == share_token:
            return cleaned_file, s  # type: ignore

    return None


def list_shared_with_user(user_email: str, user_id: int, db: Optional[Session] = None) -> List[Dict[str, Any]]:
    """List all active files shared directly with a specific user."""
    own_session = False
    if db is None:
        db = SessionLocal()
        own_session = True

    results = []
    try:
        shares = db.query(SQLFileShare).filter(
            or_(
                SQLFileShare.recipient_email == user_email.lower().strip(),
                SQLFileShare.recipient_id == user_id,
            ),
            SQLFileShare.is_revoked == False,
        ).order_by(SQLFileShare.created_at.desc()).all()

        for s in shares:
            if not s.file:
                continue
            f = s.file
            results.append({
                "share_id": s.id,
                "file_id": f.id,
                "original_name": f.original_name,
                "file_size": f.file_size,
                "content_type": f.content_type,
                "extension": f.extension,
                "category": f.category,
                "owner_email": f.owner.email if f.owner else "",
                "permission": s.permission.value if hasattr(s.permission, "value") else str(s.permission),
                "can_download": s.permission == SharePermission.can_download,
                "expires_at": s.expires_at.isoformat() if s.expires_at else None,
                "created_at": s.created_at.isoformat() if s.created_at else datetime.now(timezone.utc).isoformat(),
                "is_expired": s.expires_at is not None and (
                    datetime.now(timezone.utc) > (s.expires_at if s.expires_at.tzinfo else s.expires_at.replace(tzinfo=timezone.utc))
                ),
            })
    except Exception as exc:
        logger.warning(f"SQL list_shared_with_user error: {exc}")
    finally:
        if own_session:
            db.close()

    return results


def increment_download_count(file_id: str, share_token: Optional[str] = None, db: Optional[Session] = None):
    """Increment download counters in PostgreSQL and MongoDB."""
    own_session = False
    if db is None:
        db = SessionLocal()
        own_session = True

    try:
        sql_file = db.query(SQLFile).filter(SQLFile.id == file_id).first()
        if sql_file:
            sql_file.download_count += 1
            if share_token:
                share = db.query(SQLFileShare).filter(
                    SQLFileShare.file_id == file_id,
                    SQLFileShare.share_token == share_token,
                ).first()
                if share:
                    share.download_count += 1
            db.commit()
    except Exception as exc:
        db.rollback()
        logger.warning(f"SQL increment_download_count error: {exc}")
    finally:
        if own_session:
            db.close()

    col = get_files_collection()
    col.update_one({"id": file_id}, {"$inc": {"download_count": 1}})
    if share_token:
        file_doc = col.find_one({"id": file_id})
        if file_doc and "shares" in file_doc:
            updated_shares = []
            for s in file_doc["shares"]:
                if s.get("share_token") == share_token:
                    s["download_count"] = s.get("download_count", 0) + 1
                updated_shares.append(s)
            col.update_one({"id": file_id}, {"$set": {"shares": updated_shares}})


def get_storage_stats(owner_id: int, is_admin: bool = False, db: Optional[Session] = None) -> Dict[str, Any]:
    """Calculate aggregate dashboard statistics."""
    files = list_files(owner_id=owner_id, is_admin=is_admin, db=db)
    total_files = len(files)
    total_bytes = sum(f.get("file_size", 0) for f in files)
    active_shares = sum(len(f.get("shares", [])) for f in files)

    categories_count: Dict[str, int] = {}
    for f in files:
        cat = f.get("category", "other")
        categories_count[cat] = categories_count.get(cat, 0) + 1

    return {
        "total_files": total_files,
        "total_bytes": total_bytes,
        "total_storage_mb": round(total_bytes / (1024 * 1024), 2),
        "active_shares": active_shares,
        "categories_count": categories_count,
    }
