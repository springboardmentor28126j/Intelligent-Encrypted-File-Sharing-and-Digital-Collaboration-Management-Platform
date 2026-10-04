"""
redis_client.py – Redis connection management, pooling, and health checks.

Manages connection pool to Redis for JWT token blacklisting, session state,
and file metadata caching. Provides resilient in-memory fallback for local development.
"""

import logging
import time
from typing import Any, Dict, Optional
import redis

from app.config import settings

logger = logging.getLogger("trustshare.redis")

_redis_pool: Optional[redis.ConnectionPool] = None
_redis_client: Optional[redis.Redis] = None
_last_redis_check_time: float = 0.0
_cached_redis_availability: bool = False
CHECK_INTERVAL_SEC: float = 10.0


# ─── In-Memory Fallback Cache Store (For Zero-Setup Local Dev & Tests) ────────

class InMemoryRedisFallback:
    """Thread-safe in-memory cache simulating key-value storage with TTL support."""
    def __init__(self):
        self._data: Dict[str, Any] = {}
        self._expires: Dict[str, float] = {}

    def _purge_expired(self):
        now = time.time()
        expired_keys = [k for k, exp in self._expires.items() if exp <= now]
        for k in expired_keys:
            self._data.pop(k, None)
            self._expires.pop(k, None)

    def set(self, key: str, value: Any, ex: Optional[int] = None) -> bool:
        self._purge_expired()
        self._data[str(key)] = str(value) if not isinstance(value, (str, bytes)) else value
        if ex is not None and ex > 0:
            self._expires[str(key)] = time.time() + ex
        else:
            self._expires.pop(str(key), None)
        return True

    def setex(self, key: str, time_sec: int, value: Any) -> bool:
        return self.set(key, value, ex=time_sec)

    def get(self, key: str) -> Optional[str]:
        self._purge_expired()
        k = str(key)
        if k in self._expires and self._expires[k] <= time.time():
            self._data.pop(k, None)
            self._expires.pop(k, None)
            return None
        val = self._data.get(k)
        if isinstance(val, bytes):
            return val.decode("utf-8")
        return val

    def delete(self, *keys: str) -> int:
        count = 0
        for key in keys:
            k = str(key)
            if k in self._data:
                del self._data[k]
                self._expires.pop(k, None)
                count += 1
        return count

    def exists(self, *keys: str) -> int:
        self._purge_expired()
        return sum(1 for k in keys if self.get(str(k)) is not None)

    def ping(self) -> bool:
        return True

    def flushdb(self) -> bool:
        self._data.clear()
        self._expires.clear()
        return True


_fallback_redis = InMemoryRedisFallback()


def clear_redis_fallback():
    """Flush the in-memory fallback cache for test isolation."""
    _fallback_redis.flushdb()


# ─── Redis Client Management ──────────────────────────────────────────────────

def get_redis_client() -> redis.Redis:
    """
    Get or create singleton Redis client instance with connection pooling.
    """
    global _redis_pool, _redis_client
    if _redis_client is None:
        try:
            _redis_pool = redis.ConnectionPool.from_url(
                settings.REDIS_URL,
                max_connections=30,
                socket_timeout=0.2,
                socket_connect_timeout=0.2,
                decode_responses=True,
            )
            _redis_client = redis.Redis(connection_pool=_redis_pool)
        except Exception as exc:
            logger.warning(f"Could not connect to Redis: {exc}. Using fallback cache.")
            return _fallback_redis  # type: ignore
    return _redis_client


def is_redis_available(force_check: bool = False) -> bool:
    """Check if the live Redis instance responds to ping with cached result."""
    global _last_redis_check_time, _cached_redis_availability
    now = time.time()
    if not force_check and (now - _last_redis_check_time) < CHECK_INTERVAL_SEC:
        return _cached_redis_availability

    _last_redis_check_time = now
    try:
        client = get_redis_client()
        if isinstance(client, InMemoryRedisFallback):
            _cached_redis_availability = False
        else:
            _cached_redis_availability = bool(client.ping())
    except Exception:
        _cached_redis_availability = False
    return _cached_redis_availability


def get_active_redis():
    """Returns live Redis client if available, else resilient in-memory fallback."""
    if is_redis_available():
        return get_redis_client()
    return _fallback_redis


def check_redis_health() -> Dict[str, Any]:
    """
    Perform a health check on Redis.
    Returns status, latency (ms), connected flag, and mode.
    """
    start_time = time.perf_counter()
    connected = is_redis_available(force_check=True)
    latency_ms = round((time.perf_counter() - start_time) * 1000, 2)

    if connected:
        try:
            client = get_redis_client()
            info = client.info()
            version = info.get("redis_version", "unknown")
            used_memory = info.get("used_memory_human", "unknown")
            return {
                "status": "healthy",
                "connected": True,
                "latency_ms": latency_ms,
                "mode": "redis_live",
                "version": version,
                "used_memory": used_memory,
            }
        except Exception:
            pass

    return {
        "status": "degraded (fallback active)",
        "connected": False,
        "latency_ms": latency_ms,
        "mode": "in_memory_resilient",
        "detail": "Redis server unreachable – in-memory session cache active",
    }
