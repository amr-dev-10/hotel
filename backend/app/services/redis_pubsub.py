from collections.abc import AsyncIterator
import json
from typing import Any

from app.core.config import settings


class RedisPubSub:
    def __init__(self, redis_url: str | None = None) -> None:
        self.redis_url = redis_url or settings.redis_url

    async def publish(self, channel: str, payload: dict[str, Any]) -> None:
        from redis.asyncio import from_url

        client = from_url(self.redis_url, decode_responses=True)
        try:
            await client.publish(channel, json.dumps(payload))
        finally:
            await client.aclose()

    async def subscribe(self, channel: str) -> AsyncIterator[str]:
        from redis.asyncio import from_url

        client = from_url(self.redis_url, decode_responses=True)
        pubsub = client.pubsub()
        await pubsub.subscribe(channel)
        try:
            async for message in pubsub.listen():
                if message["type"] == "message":
                    yield message["data"]
        finally:
            await pubsub.unsubscribe(channel)
            await pubsub.aclose()
            await client.aclose()
