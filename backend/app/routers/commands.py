import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select, update, and_, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db, AsyncSessionLocal
from app.models.command import Command
from app.models.device import Device
from app.models.user import User, UserRole
from app.security import get_current_user, require_role
from app.services.mqtt_worker import publish_mqtt_command
from app.services.redis_bus import publish_live_event

logger = logging.getLogger("commands_router")
router = APIRouter(prefix="/devices/{device_id}/commands", tags=["Commands"])

COMMAND_TIMEOUT_SECONDS = 30


class CommandCreateRequest(BaseModel):
    action: str
    params: Optional[Dict[str, Any]] = None


class CommandResponse(BaseModel):
    id: int
    device_id: int
    payload: Dict[str, Any]
    status: str  # sent, acked, failed
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


async def sweep_stale_commands() -> int:
    """
    Finds commands in 'sent' state exceeding the timeout and transitions them to 'failed' (FR-C4).
    """
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(seconds=COMMAND_TIMEOUT_SECONDS)

    async with AsyncSessionLocal() as db:
        try:
            query = select(Command, Device).join(Device, Command.device_id == Device.id).where(
                and_(
                    Command.status == "sent",
                    Command.created_at <= cutoff,
                )
            )
            result = await db.execute(query)
            stale_pairs = result.all()

            if not stale_pairs:
                return 0

            for cmd, dev in stale_pairs:
                cmd.status = "failed"
                cmd.updated_at = now
                logger.info("Command %s timed out -> failed for device %s", cmd.id, dev.device_key)

                await publish_live_event(
                    owner_id=dev.owner_id,
                    event={
                        "type": "command_result",
                        "command_id": cmd.id,
                        "device_id": dev.id,
                        "device_key": dev.device_key,
                        "status": "failed",
                        "reason": "timeout",
                    }
                )

            await db.commit()
            return len(stale_pairs)

        except Exception as e:
            await db.rollback()
            logger.error("Error sweeping stale commands: %s", e)
            return 0


@router.post("", response_model=CommandResponse, status_code=status.HTTP_201_CREATED)
async def send_command(
    device_id: int,
    payload: CommandCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.ENGINEER, UserRole.OPERATOR])),
):
    """
    Sends a remote command to a machine/device via MQTT broker (FR-C1, FR-C2).
    """
    dev_res = await db.execute(
        select(Device).where(Device.id == device_id, Device.owner_id == current_user.id)
    )
    device = dev_res.scalar_one_or_none()
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Device {device_id} not found or access denied",
        )

    # 1. Store command with status 'sent'
    cmd_data = {
        "action": payload.action,
        "params": payload.params or {},
    }
    command = Command(
        device_id=device.id,
        payload=cmd_data,
        status="sent",
    )
    db.add(command)
    await db.commit()
    await db.refresh(command)

    # 2. Dispatch payload to MQTT topic: lansubx/{device_key}/command
    mqtt_payload = {
        "id": command.id,
        "action": payload.action,
        "params": payload.params or {},
    }
    published = await publish_mqtt_command(device.device_key, mqtt_payload)
    if not published:
        # Mark as failed if broker publish failed
        command.status = "failed"
        await db.commit()
        await db.refresh(command)

    return CommandResponse.model_validate(command)


@router.get("", response_model=List[CommandResponse])
async def list_commands(
    device_id: int,
    limit: int = Query(50, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieves command audit history for a device (FR-C5)."""
    dev_res = await db.execute(
        select(Device).where(Device.id == device_id, Device.owner_id == current_user.id)
    )
    device = dev_res.scalar_one_or_none()
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Device {device_id} not found or access denied",
        )

    # Trigger proactive sweep of stale commands
    await sweep_stale_commands()

    query = (
        select(Command)
        .where(Command.device_id == device_id)
        .order_by(desc(Command.created_at))
        .limit(limit)
    )
    result = await db.execute(query)
    commands = result.scalars().all()
    return [CommandResponse.model_validate(c) for c in commands]
