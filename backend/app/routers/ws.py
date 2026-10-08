import asyncio
import logging
from typing import Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status
from sqlalchemy import select

from app.db import AsyncSessionLocal
from app.models.user import User
from app.security import decode_access_token
from app.services.redis_bus import get_redis_client

logger = logging.getLogger("websocket")
router = APIRouter(tags=["WebSocket"])


async def authenticate_ws(websocket: WebSocket) -> Optional[User]:
    # 1. Try query param token
    token = websocket.query_params.get("token")

    # 2. Try cookie token
    if not token:
        cookie_token = websocket.cookies.get("access_token")
        if cookie_token:
            token = cookie_token[7:] if cookie_token.startswith("Bearer ") else cookie_token

    if not token:
        return None

    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        return None

    try:
        user_id = int(payload["sub"])
    except ValueError:
        return None

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if user and user.is_active:
            return user

    return None


@router.websocket("/ws")
async def websocket_live_feed(websocket: WebSocket):
    user = await authenticate_ws(websocket)
    if not user:
        logger.warning("Rejecting unauthorized WebSocket connection attempt.")
        # FR-L1: Close with 4401 on unauthorized
        await websocket.close(code=4401, reason="Unauthorized")
        return

    await websocket.accept()
    logger.info("WebSocket connected for user %s (id=%s)", user.email, user.id)

    redis_client = await get_redis_client()
    if not redis_client:
        logger.error("Redis client unavailable for WebSocket feed.")
        await websocket.send_json({"type": "system", "message": "Live feed degraded (cache unavailable)"})

    pubsub = None
    channel_name = f"live:{user.id}"

    try:
        if redis_client:
            pubsub = redis_client.pubsub()
            await pubsub.subscribe(channel_name)
            logger.info("Subscribed WebSocket to Redis channel %s", channel_name)

        async def redis_reader():
            if not pubsub:
                while True:
                    await asyncio.sleep(1)
            async for message in pubsub.listen():
                if message.get("type") == "message":
                    raw_data = message.get("data")
                    if raw_data:
                        await websocket.send_text(raw_data)

        async def client_reader():
            while True:
                # Keep listening for client pings or heartbeats
                data = await websocket.receive_text()
                if data == "ping":
                    await websocket.send_text("pong")

        reader_task = asyncio.create_task(redis_reader())
        client_task = asyncio.create_task(client_reader())

        done, pending = await asyncio.wait(
            [reader_task, client_task],
            return_when=asyncio.FIRST_COMPLETED,
        )

        for task in pending:
            task.cancel()

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected for user %s", user.id)
    except Exception as e:
        logger.error("Error in WebSocket session for user %s: %s", user.id, e)
    finally:
        if pubsub:
            try:
                await pubsub.unsubscribe(channel_name)
                await pubsub.close()
            except Exception:
                pass
        try:
            await websocket.close()
        except Exception:
            pass
