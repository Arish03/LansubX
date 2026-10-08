import logging
import time
from datetime import datetime, timezone
from typing import Dict, Any, Optional, Tuple
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import AsyncSessionLocal
from app.models.device import Device
from app.models.telemetry import Telemetry
from app.models.command import Command
from app.services.redis_bus import publish_live_event
from app.services.rules import evaluate_rules_for_metric

logger = logging.getLogger("telemetry_service")

# In-memory device cache to reduce DB lookup latency (FR-I6)
# Cache structure: device_key -> (device_id, owner_id, cached_at_monotonic)
_device_cache: Dict[str, Tuple[int, int, float]] = {}
CACHE_TTL_SECONDS = 60.0


def invalidate_device_cache(device_key: Optional[str] = None):
    global _device_cache
    if device_key:
        _device_cache.pop(device_key, None)
    else:
        _device_cache.clear()


async def get_device_info(db: AsyncSession, device_key: str) -> Optional[Tuple[int, int]]:
    global _device_cache
    now = time.monotonic()
    if device_key in _device_cache:
        device_id, owner_id, cached_at = _device_cache[device_key]
        if now - cached_at < CACHE_TTL_SECONDS:
            return device_id, owner_id

    result = await db.execute(
        select(Device.id, Device.owner_id).where(Device.device_key == device_key)
    )
    row = result.first()
    if row:
        device_id, owner_id = row[0], row[1]
        _device_cache[device_key] = (device_id, owner_id, now)
        return device_id, owner_id

    return None


def parse_timestamp(raw_ts: Optional[Any]) -> datetime:
    """Parses ISO timestamp or defaults to current server UTC time (FR-I4)."""
    if raw_ts is None:
        return datetime.now(timezone.utc)
    if isinstance(raw_ts, datetime):
        return raw_ts if raw_ts.tzinfo else raw_ts.replace(tzinfo=timezone.utc)
    if isinstance(raw_ts, (int, float)):
        try:
            return datetime.fromtimestamp(raw_ts, tz=timezone.utc)
        except Exception:
            return datetime.now(timezone.utc)
    if isinstance(raw_ts, str):
        try:
            # Handle ISO formats
            ts = datetime.fromisoformat(raw_ts.replace("Z", "+00:00"))
            return ts if ts.tzinfo else ts.replace(tzinfo=timezone.utc)
        except Exception:
            return datetime.now(timezone.utc)
    return datetime.now(timezone.utc)


def filter_numeric_values(raw_values: Any) -> Dict[str, float]:
    """Ensures values are numeric only; booleans converted to 1.0/0.0 (FR-I3)."""
    if not isinstance(raw_values, dict):
        return {}
    clean: Dict[str, float] = {}
    for k, v in raw_values.items():
        if isinstance(v, bool):
            clean[k] = 1.0 if v else 0.0
        elif isinstance(v, (int, float)):
            clean[k] = float(v)
    return clean


async def process_telemetry(
    device_key: str,
    values: Any,
    raw_ts: Optional[Any] = None,
) -> bool:
    """
    Main ingestion function for Lansub X (FR-I1).
    1. Looks up device key (ignores unknown keys).
    2. Filters numeric metrics.
    3. Persists batch telemetry rows.
    4. Updates device last_seen_at and is_online.
    5. Publishes real-time event to Redis.
    6. Triggers alarm rule evaluations.
    """
    clean_values = filter_numeric_values(values)
    if not clean_values:
        logger.debug("Telemetry for %s dropped: no numeric values", device_key)
        return False

    ts = parse_timestamp(raw_ts)

    async with AsyncSessionLocal() as db:
        try:
            device_info = await get_device_info(db, device_key)
            if not device_info:
                logger.warning("Telemetry dropped: unknown device_key '%s'", device_key)
                return False

            device_id, owner_id = device_info

            # Batch insert telemetry records
            for metric, val in clean_values.items():
                record = Telemetry(
                    device_id=device_id,
                    metric=metric,
                    value=val,
                    ts=ts,
                )
                db.add(record)

            # Update device state
            await db.execute(
                update(Device)
                .where(Device.id == device_id)
                .values(last_seen_at=ts, is_online=True)
            )

            await db.commit()

            # Publish to Redis pub/sub
            await publish_live_event(
                owner_id=owner_id,
                event={
                    "type": "telemetry",
                    "device_id": device_id,
                    "device_key": device_key,
                    "ts": ts.isoformat(),
                    "values": clean_values,
                }
            )

            # Evaluate alarm rules for each metric
            for metric, val in clean_values.items():
                await evaluate_rules_for_metric(
                    db=db,
                    device_id=device_id,
                    owner_id=owner_id,
                    device_key=device_key,
                    metric=metric,
                    value=val,
                    ts=ts,
                )
            await db.commit()

            return True

        except Exception as e:
            await db.rollback()
            logger.error("Error processing telemetry for %s: %s", device_key, e, exc_info=True)
            return False


async def process_status(device_key: str, payload: Any) -> bool:
    """
    Processes device status updates and MQTT Last Will and Testament messages (FR-D6).
    Payload: {"online": bool, "source"?: str}
    """
    if not isinstance(payload, dict) or "online" not in payload:
        logger.warning("Invalid status payload for %s: %s", device_key, payload)
        return False

    is_online = bool(payload.get("online"))
    now = datetime.now(timezone.utc)

    async with AsyncSessionLocal() as db:
        try:
            device_info = await get_device_info(db, device_key)
            if not device_info:
                logger.warning("Status dropped: unknown device_key '%s'", device_key)
                return False

            device_id, owner_id = device_info

            update_values: Dict[str, Any] = {"is_online": is_online}
            if is_online:
                update_values["last_seen_at"] = now

            await db.execute(
                update(Device)
                .where(Device.id == device_id)
                .values(**update_values)
            )
            await db.commit()

            # Publish status update to Redis
            await publish_live_event(
                owner_id=owner_id,
                event={
                    "type": "device_status",
                    "device_id": device_id,
                    "device_key": device_key,
                    "online": is_online,
                }
            )
            logger.info("Device %s status updated: online=%s", device_key, is_online)
            return True

        except Exception as e:
            await db.rollback()
            logger.error("Error processing status for %s: %s", device_key, e, exc_info=True)
            return False


async def process_command_ack(device_key: str, payload: Any) -> bool:
    """
    Processes command acknowledgment messages from devices/gateways (FR-C3).
    Payload: {"id": int, "ok": bool, "message"?: str}
    """
    if not isinstance(payload, dict) or "id" not in payload:
        logger.warning("Invalid command ack payload for %s: %s", device_key, payload)
        return False

    command_id = payload.get("id")
    is_ok = bool(payload.get("ok", True))
    new_status = "acked" if is_ok else "failed"

    async with AsyncSessionLocal() as db:
        try:
            device_info = await get_device_info(db, device_key)
            if not device_info:
                logger.warning("Command ack dropped: unknown device_key '%s'", device_key)
                return False

            device_id, owner_id = device_info

            # Find command for this device
            result = await db.execute(
                select(Command).where(
                    Command.id == command_id,
                    Command.device_id == device_id,
                )
            )
            cmd = result.scalar_one_or_none()
            if not cmd:
                logger.warning("Command ack ignored: command %s not found for device %s", command_id, device_key)
                return False

            cmd.status = new_status
            cmd.updated_at = datetime.now(timezone.utc)
            await db.commit()

            # Publish command result to Redis
            await publish_live_event(
                owner_id=owner_id,
                event={
                    "type": "command_result",
                    "command_id": cmd.id,
                    "device_id": device_id,
                    "device_key": device_key,
                    "status": new_status,
                }
            )
            logger.info("Command %s updated to '%s' for device %s", command_id, new_status, device_key)
            return True

        except Exception as e:
            await db.rollback()
            logger.error("Error processing command ack for %s: %s", device_key, e, exc_info=True)
            return False
