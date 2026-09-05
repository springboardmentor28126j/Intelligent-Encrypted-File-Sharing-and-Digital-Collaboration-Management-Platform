"""
Secure, expiring share links, backed by Redis.

A share token is a random, unguessable string that maps to a specific
file plus a permission level. Redis's built-in key expiry (TTL) handles
"this link stops working after N hours" for free — no cleanup job needed,
the key just disappears.

To support listing "active links for this file" (needed for the share
UI), each file also gets a Redis SET of its currently-issued tokens.
That set isn't the source of truth for validity — the individual token
key's TTL is — so a stale entry in the set just resolves to nothing and
is treated as already gone.
"""

import json
import secrets
import time

import redis

from app.core.config import settings

_client = redis.from_url(settings.REDIS_URL, decode_responses=True)

SHARE_KEY_PREFIX = "share:"
FILE_TOKENS_PREFIX = "share:file:"
DEFAULT_EXPIRY_SECONDS = 24 * 60 * 60  # 24 hours


def create_share_token(
    file_id: str,
    owner_id: str,
    permission: str = "read",
    expires_in_seconds: int = DEFAULT_EXPIRY_SECONDS,
) -> str:
    token = secrets.token_urlsafe(32)
    payload = json.dumps(
        {
            "file_id": file_id,
            "owner_id": owner_id,
            "permission": permission,
            "created_at": int(time.time()),
        }
    )
    _client.setex(f"{SHARE_KEY_PREFIX}{token}", expires_in_seconds, payload)
    # Track this token against the file so we can list "active links" later.
    # This set entry has no TTL of its own; list_share_links() below filters
    # out anything whose underlying token key has already expired.
    _client.sadd(f"{FILE_TOKENS_PREFIX}{file_id}", token)
    return token


def resolve_share_token(token: str) -> dict | None:
    """Returns {file_id, owner_id, permission} the token grants, or None if invalid/expired."""
    value = _client.get(f"{SHARE_KEY_PREFIX}{token}")
    if value is None:
        return None
    return json.loads(value)


def revoke_share_token(token: str, file_id: str | None = None) -> None:
    _client.delete(f"{SHARE_KEY_PREFIX}{token}")
    if file_id:
        _client.srem(f"{FILE_TOKENS_PREFIX}{file_id}", token)


def list_share_links(file_id: str) -> list[dict]:
    """All currently-active (non-expired) share links for a file."""
    tokens = _client.smembers(f"{FILE_TOKENS_PREFIX}{file_id}")
    links = []
    stale = []
    for token in tokens:
        value = _client.get(f"{SHARE_KEY_PREFIX}{token}")
        if value is None:
            stale.append(token)
            continue
        ttl = _client.ttl(f"{SHARE_KEY_PREFIX}{token}")
        data = json.loads(value)
        links.append(
            {
                "token": token,
                "permission": data.get("permission", "read"),
                "expires_in_seconds": ttl,
                "expires_at": int(time.time()) + ttl if ttl and ttl > 0 else None,
            }
        )
    # Clean up references to tokens that already expired, so the set
    # doesn't grow unbounded with dead entries over time.
    if stale:
        _client.srem(f"{FILE_TOKENS_PREFIX}{file_id}", *stale)
    return links
