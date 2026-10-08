import json
import logging
from typing import Optional, Dict, Any
import redis.asyncio as aioredis

from app.config import get_settings

logger = logging.getLogger("redis_bus")
settings = get_settings()

_redis_client: Optional[aioredis.Redis] = None


async def get_redis_client() -> Optional[aioredis.Redis]:
    global _redis_client
    if _redis_client is None:
        try:
            _redis_client = aioredis.from_url(
                settings.REDIS_URL,
                decode_responses=True,
                socket_timeout=2.0,
                socket_connect_timeout=2.0,
            )
            await _redis_client.ping()
        except Exception as e:
            logger.warning("Could not connect to Redis at %s: %s", settings.REDIS_URL, e)
            _redis_client = None
    return _redis_client


async def close_redis():
    global _redis_client
    if _redis_client is not None:
        try:
            await _redis_client.close()
        except Exception as e:
            logger.warning("Error closing Redis connection: %s", e)
        finally:
            _redis_client = None


async def publish_live_event(owner_id: int, event: Dict[str, Any]) -> bool:
    """
    Publishes an event to the owner's Redis channel `live:{owner_id}`.
    Safe against Redis disconnections (logs warning, does not throw).
    """
    try:
        client = await get_redis_client()
        if client is not None:
            channel = f"live:{owner_id}"
            payload = json.dumps(event)
            await client.publish(channel, payload)
            return True
    except Exception as e:
        logger.warning("Failed to publish live event to Redis for owner %s: %s", owner_id, e)
    return False
