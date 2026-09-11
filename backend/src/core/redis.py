import redis.asyncio as aioredis
from src.core.config import settings
from typing import Optional

class RedisManager:
    client: Optional[aioredis.Redis] = None

    def get_client(self) -> aioredis.Redis:
        if not self.client:
            self.client = aioredis.from_url(
                settings.REDIS_URI,
                encoding="utf-8",
                decode_responses=True
            )
        return self.client

    async def close(self) -> None:
        if self.client:
            await self.client.close()

redis_manager = RedisManager()

async def get_redis() -> aioredis.Redis:
    return redis_manager.get_client()
