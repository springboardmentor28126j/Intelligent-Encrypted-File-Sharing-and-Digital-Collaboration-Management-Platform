from functools import lru_cache

import redis
from redis.exceptions import RedisError

from app.core.config import settings


@lru_cache
def get_redis_client():
    return redis.Redis.from_url(
        settings.REDIS_URL,
        decode_responses=True,
    )

def check_redis() ->bool:
    try:
        return bool(get_redis_client().ping())
    except RedisError:
        return False
    