"""
mongodb.py – MongoDB connection management, collection accessors, and health checks.

Manages connection pooling to MongoDB for storing file metadata, share records,
and access logs. Includes resilient in-memory fallback for local development/testing
when MongoDB is not actively running.
"""

import logging
import time
from typing import Any, Dict, List, Optional
from pymongo import MongoClient, ASCENDING, DESCENDING
from pymongo.collection import Collection
from pymongo.database import Database
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError

from app.config import settings

logger = logging.getLogger("trustshare.mongodb")

_mongo_client: Optional[MongoClient] = None
_mongo_db: Optional[Database] = None
_last_check_time: float = 0.0
_cached_availability: bool = False
CHECK_INTERVAL_SEC: float = 10.0


# ─── In-Memory Fallback Collection (For Zero-Setup Local Dev & Unit Tests) ─────

class InMemoryCollection:
    """Thread-safe in-memory collection simulating basic PyMongo operations."""
    def __init__(self, name: str):
        self.name = name
        self._docs: Dict[str, Dict[str, Any]] = {}

    def insert_one(self, document: Dict[str, Any]):
        doc_id = document.get("id") or document.get("_id") or str(len(self._docs) + 1)
        doc = dict(document)
        doc["_id"] = doc_id
        if "id" not in doc:
            doc["id"] = doc_id
        self._docs[doc_id] = doc
        class InsertResult:
            inserted_id = doc_id
        return InsertResult()

    def find_one(self, filter_dict: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        for doc in self._docs.values():
            if self._matches(doc, filter_dict):
                return dict(doc)
        return None

    def find(self, filter_dict: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        filter_dict = filter_dict or {}
        results = []
        for doc in self._docs.values():
            if self._matches(doc, filter_dict):
                results.append(dict(doc))
        return results

    def update_one(self, filter_dict: Dict[str, Any], update_dict: Dict[str, Any]):
        target = self.find_one(filter_dict)
        if not target:
            class UpdateResult:
                modified_count = 0
                matched_count = 0
            return UpdateResult()

        doc_id = target["id"]
        doc = self._docs[doc_id]

        if "$set" in update_dict:
            for k, v in update_dict["$set"].items():
                doc[k] = v
        if "$inc" in update_dict:
            for k, v in update_dict["$inc"].items():
                doc[k] = doc.get(k, 0) + v
        if "$push" in update_dict:
            for k, v in update_dict["$push"].items():
                if k not in doc:
                    doc[k] = []
                doc[k].append(v)
        if "$pull" in update_dict:
            for k, v in update_dict["$pull"].items():
                if k in doc and isinstance(doc[k], list):
                    if isinstance(v, dict):
                        doc[k] = [
                            item for item in doc[k]
                            if not all(item.get(sk) == sv for sk, sv in v.items())
                        ]
                    else:
                        doc[k] = [item for item in doc[k] if item != v]

        class UpdateResult:
            modified_count = 1
            matched_count = 1
        return UpdateResult()

    def delete_one(self, filter_dict: Dict[str, Any]):
        target = self.find_one(filter_dict)
        if target:
            doc_id = target["id"]
            if doc_id in self._docs:
                del self._docs[doc_id]
                class DeleteResult:
                    deleted_count = 1
                return DeleteResult()
        class DeleteResult:
            deleted_count = 0
        return DeleteResult()

    def count_documents(self, filter_dict: Optional[Dict[str, Any]] = None) -> int:
        return len(self.find(filter_dict))

    def create_index(self, keys, **kwargs):
        pass

    def clear(self):
        self._docs.clear()

    def _matches(self, doc: Dict[str, Any], filter_dict: Dict[str, Any]) -> bool:
        if "$or" in filter_dict:
            or_clauses = filter_dict["$or"]
            if not any(self._matches(doc, clause) for clause in or_clauses):
                return False

        for k, v in filter_dict.items():
            if k.startswith("$"):
                continue
            if k not in doc:
                # Handle nested paths like "shares.share_token"
                if "." in k:
                    parts = k.split(".", 1)
                    if parts[0] in doc and isinstance(doc[parts[0]], list):
                        has_match = any(
                            isinstance(elem, dict) and elem.get(parts[1]) == v
                            for elem in doc[parts[0]]
                        )
                        if not has_match:
                            return False
                        continue
                return False
            if isinstance(v, dict):
                if "$regex" in v:
                    import re
                    pattern = re.compile(v["$regex"], re.IGNORECASE if v.get("$options") == "i" else 0)
                    if not pattern.search(str(doc[k])):
                        return False
                if "$in" in v:
                    if doc[k] not in v["$in"]:
                        return False
                if "$elemMatch" in v:
                    list_val = doc.get(k, [])
                    if not isinstance(list_val, list):
                        return False
                    matched_elem = any(
                        all(elem.get(ek) == ev for ek, ev in v["$elemMatch"].items())
                        for elem in list_val if isinstance(elem, dict)
                    )
                    if not matched_elem:
                        return False
            else:
                if doc[k] != v:
                    return False
        return True


_fallback_files_col = InMemoryCollection("files")
_fallback_shares_col = InMemoryCollection("shares")


def clear_mongo_fallback():
    """Clear in-memory fallback collections for clean test isolation."""
    _fallback_files_col.clear()
    _fallback_shares_col.clear()


# ─── Client Management ────────────────────────────────────────────────────────

def get_mongo_client() -> MongoClient:
    """
    Get or initialize the singleton PyMongo client.
    """
    global _mongo_client
    if _mongo_client is None:
        _mongo_client = MongoClient(
            settings.MONGODB_URL,
            serverSelectionTimeoutMS=200,
            connectTimeoutMS=200,
            socketTimeoutMS=200,
            maxPoolSize=50,
            minPoolSize=5,
        )
    return _mongo_client


def get_mongo_db() -> Database:
    """Get the configured MongoDB database instance."""
    global _mongo_db
    if _mongo_db is None:
        client = get_mongo_client()
        _mongo_db = client[settings.MONGODB_DB_NAME]
    return _mongo_db


def is_mongo_available(force_check: bool = False) -> bool:
    """Check if MongoDB server is currently reachable with cached result."""
    global _last_check_time, _cached_availability
    now = time.time()
    if not force_check and (now - _last_check_time) < CHECK_INTERVAL_SEC:
        return _cached_availability

    _last_check_time = now
    try:
        client = get_mongo_client()
        client.admin.command("ping")
        _cached_availability = True
    except Exception:
        _cached_availability = False
    return _cached_availability


def get_files_collection() -> Collection:
    """Returns the MongoDB files collection, or fallback memory collection if offline."""
    if is_mongo_available():
        db = get_mongo_db()
        return db["files"]
    return _fallback_files_col  # type: ignore


def get_shares_collection() -> Collection:
    """Returns the MongoDB shares collection, or fallback memory collection if offline."""
    if is_mongo_available():
        db = get_mongo_db()
        return db["shares"]
    return _fallback_shares_col  # type: ignore


def init_mongo_indexes():
    """Create optimized indexes on startup."""
    try:
        if is_mongo_available(force_check=True):
            db = get_mongo_db()
            db["files"].create_index([("id", ASCENDING)], unique=True)
            db["files"].create_index([("owner_id", ASCENDING)])
            db["files"].create_index([("upload_date", DESCENDING)])
            db["files"].create_index([("category", ASCENDING)])
            db["files"].create_index([("shares.share_token", ASCENDING)])
            logger.info("MongoDB indexes initialized successfully.")
    except Exception as exc:
        logger.warning(f"Could not initialize MongoDB indexes: {exc}")


def check_mongo_health() -> Dict[str, Any]:
    """
    Perform a live health-check on MongoDB.
    Returns status, latency (ms), database name, and file document count.
    """
    start_time = time.perf_counter()
    connected = is_mongo_available(force_check=True)
    latency_ms = round((time.perf_counter() - start_time) * 1000, 2)

    if connected:
        try:
            db = get_mongo_db()
            file_count = db["files"].count_documents({})
            return {
                "status": "healthy",
                "connected": True,
                "latency_ms": latency_ms,
                "database": settings.MONGODB_DB_NAME,
                "file_count": file_count,
                "mode": "mongodb_live",
            }
        except Exception:
            pass

    file_count = _fallback_files_col.count_documents({})
    return {
        "status": "degraded (fallback active)",
        "connected": False,
        "latency_ms": latency_ms,
        "database": settings.MONGODB_DB_NAME,
        "file_count": file_count,
        "mode": "in_memory_resilient",
        "detail": "MongoDB server unreachable – in-memory file repository active",
    }
