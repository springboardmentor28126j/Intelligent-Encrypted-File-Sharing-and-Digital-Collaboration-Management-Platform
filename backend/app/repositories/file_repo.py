"""
repositories/file_repo.py – MongoDB data access layer for file metadata and shares.

Handles all persistence operations for files, metadata indexing, search queries,
share links, download counters, and aggregate dashboard metrics.
"""

from datetime import datetime, timezone
import logging
from typing import Any, Dict, List, Optional, Tuple

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


def create_file(file_doc: Dict[str, Any]) -> Dict[str, Any]:
    """Insert a new file metadata document into MongoDB."""
    col = get_files_collection()
    doc_to_save = dict(file_doc)
    doc_to_save["_id"] = file_doc["id"]
    col.insert_one(doc_to_save)
    return clean_doc(doc_to_save)  # type: ignore


def get_file_by_id(file_id: str) -> Optional[Dict[str, Any]]:
    """Find a file metadata document by unique file_id."""
    col = get_files_collection()
    doc = col.find_one({"id": file_id})
    return clean_doc(doc)


def list_files(
    owner_id: int,
    search: Optional[str] = None,
    category: Optional[str] = None,
    is_admin: bool = False,
) -> List[Dict[str, Any]]:
    """
    List files with optional text search and category filtering.
    Regular users see only their own files; admins see all files if requested.
    """
    col = get_files_collection()
    query: Dict[str, Any] = {}

    if not is_admin:
        query["owner_id"] = owner_id

    if category and category.lower() != "all":
        query["category"] = category.lower()

    if search and search.strip():
        search_term = search.strip()
        # Search by original_name or description
        query["$or"] = [
            {"original_name": {"$regex": search_term, "$options": "i"}},
            {"description": {"$regex": search_term, "$options": "i"}},
            {"extension": {"$regex": search_term, "$options": "i"}},
        ]

    # Handle find
    docs = col.find(query)
    # Sort docs by upload_date descending in memory or mongo
    cleaned = [clean_doc(d) for d in docs if d is not None]  # type: ignore
    cleaned.sort(key=lambda x: x.get("upload_date", ""), reverse=True)
    return cleaned


def delete_file(file_id: str) -> bool:
    """Delete file metadata document by ID."""
    col = get_files_collection()
    res = col.delete_one({"id": file_id})
    return bool(res.deleted_count > 0)


def add_share_link(file_id: str, share_doc: Dict[str, Any]) -> bool:
    """Append a newly generated share link to the file's shares array."""
    col = get_files_collection()
    res = col.update_one(
        {"id": file_id},
        {"$push": {"shares": share_doc}}
    )
    return bool(res.modified_count > 0)


def revoke_share_link(file_id: str, share_token: str) -> bool:
    """Remove a specific share link from a file."""
    col = get_files_collection()
    res = col.update_one(
        {"id": file_id},
        {"$pull": {"shares": {"share_token": share_token}}}
    )
    return bool(res.modified_count > 0)


def find_share_by_token(share_token: str) -> Optional[Tuple[Dict[str, Any], Dict[str, Any]]]:
    """
    Look up file and specific share configuration by share_token.
    Returns tuple of (file_doc, share_doc) or None.
    """
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


def increment_download_count(file_id: str, share_token: Optional[str] = None):
    """
    Increment total downloads for the file and optional share link downloads.
    """
    col = get_files_collection()
    col.update_one({"id": file_id}, {"$inc": {"download_count": 1}})

    if share_token:
        # Find file and increment inside shares array
        file_doc = col.find_one({"id": file_id})
        if file_doc and "shares" in file_doc:
            updated_shares = []
            for s in file_doc["shares"]:
                if s.get("share_token") == share_token:
                    s["download_count"] = s.get("download_count", 0) + 1
                updated_shares.append(s)
            col.update_one({"id": file_id}, {"$set": {"shares": updated_shares}})


def get_storage_stats(owner_id: int, is_admin: bool = False) -> Dict[str, Any]:
    """
    Calculate summary stats: total files, total storage (bytes),
    active share links, and breakdown by category.
    """
    files = list_files(owner_id=owner_id, is_admin=is_admin)

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
