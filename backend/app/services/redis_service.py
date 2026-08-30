"""
services/redis_service.py – Redis high-level operations.

Provides:
  - JWT token blacklisting on logout
  - Fast token revocation checking in auth middleware
  - File metadata caching with TTL
  - User session caching
"""

import json
import logging
from typing import Any, Optional
from app.redis_client import get_active_redis

logger = logging.getLogger("trustshare.redis_service")

# Key prefixes
BLACKLIST_PREFIX = "ts:blacklist:"
FILE_CACHE_PREFIX = "ts:file:"
USER_SESSION_PREFIX = "ts:session:"
STATS_CACHE_PREFIX = "ts:stats:"


# ─── JWT Token Blacklisting ───────────────────────────────────────────────────

def blacklist_token(token: str, expire_seconds: int = 1800) -> bool:
    """
    Store a revoked JWT token in Redis with TTL until its expiry.
    """
    try:
        redis_conn = get_active_redis()
        key = f"{BLACKLIST_PREFIX}{token}"
        # Ensure minimum 10 seconds TTL
        ttl = max(int(expire_seconds), 10)
        redis_conn.set(key, "revoked", ex=ttl)
        return True
    except Exception as exc:
        logger.error(f"Error blacklisting token: {exc}")
        return False


def is_token_blacklisted(token: str) -> bool:
    """
    Check if a JWT token has been revoked/logged out.
    """
    try:
        redis_conn = get_active_redis()
        key = f"{BLACKLIST_PREFIX}{token}"
        return bool(redis_conn.exists(key))
    except Exception as exc:
        logger.warning(f"Error checking token blacklist: {exc}")
        return False


# ─── File Metadata Caching ────────────────────────────────────────────────────

def cache_file_metadata(file_id: str, metadata: dict, expire_seconds: int = 300) -> bool:
    """Cache file metadata JSON in Redis for fast repeated lookup."""
    try:
        redis_conn = get_active_redis()
        key = f"{FILE_CACHE_PREFIX}{file_id}"
        serialized = json.dumps(metadata, default=str)
        redis_conn.set(key, serialized, ex=expire_seconds)
        return True
    except Exception as exc:
        logger.warning(f"Error caching file metadata {file_id}: {exc}")
        return False


def get_cached_file_metadata(file_id: str) -> Optional[dict]:
    """Retrieve cached file metadata from Redis if present."""
    try:
        redis_conn = get_active_redis()
        key = f"{FILE_CACHE_PREFIX}{file_id}"
        raw = redis_conn.get(key)
        if raw:
            return json.loads(raw)
        return None
    except Exception as exc:
        logger.warning(f"Error reading file cache {file_id}: {exc}")
        return None


def invalidate_file_cache(file_id: str) -> bool:
    """Invalidate cached file metadata when modified or deleted."""
    try:
        redis_conn = get_active_redis()
        key = f"{FILE_CACHE_PREFIX}{file_id}"
        redis_conn.delete(key)
        return True
    except Exception as exc:
        logger.warning(f"Error invalidating file cache {file_id}: {exc}")
        return False


# ─── Generic Key-Value Cache Helpers ──────────────────────────────────────────

def cache_set_json(key: str, value: Any, expire_seconds: int = 300) -> bool:
    """Set JSON-serializable value in cache."""
    try:
        redis_conn = get_active_redis()
        serialized = json.dumps(value, default=str)
        redis_conn.set(key, serialized, ex=expire_seconds)
        return True
    except Exception as exc:
        logger.warning(f"Error caching key {key}: {exc}")
        return False


def cache_get_json(key: str) -> Optional[Any]:
    """Get JSON-deserialized value from cache."""
    try:
        redis_conn = get_active_redis()
        raw = redis_conn.get(key)
        if raw:
            return json.loads(raw)
        return None
    except Exception as exc:
        logger.warning(f"Error reading cache key {key}: {exc}")
        return None


def cache_delete(key: str) -> bool:
    """Delete a key from cache."""
    try:
        redis_conn = get_active_redis()
        redis_conn.delete(key)
        return True
    except Exception as exc:
        logger.warning(f"Error deleting cache key {key}: {exc}")
        return False
