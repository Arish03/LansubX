from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.device import Device
from app.models.gateway import Gateway
from app.models.user import User, UserRole
from app.security import (
    get_current_user,
    require_role,
    generate_device_key,
    generate_device_secret,
    get_password_hash,
)

router = APIRouter(prefix="/devices", tags=["Devices"])

VALID_KINDS = {"esp32", "sensor_controller", "plc", "modbus", "opcua", "lora"}
DIRECT_KINDS = {"esp32", "sensor_controller", "plc"}


def calculate_online_status(device: Device) -> bool:
    """Computes online state using persisted flag plus inactivity timeout (FR-D5)."""
    if not device.is_online or not device.last_seen_at:
        return False
    now = datetime.now(timezone.utc)
    last_seen = device.last_seen_at
    if last_seen.tzinfo is None:
        last_seen = last_seen.replace(tzinfo=timezone.utc)
    timeout_seconds = 1800 if device.kind == "lora" else 120
    return (now - last_seen).total_seconds() <= timeout_seconds


class DeviceCreateRequest(BaseModel):
    name: str
    kind: str
    gateway_id: Optional[int] = None


class DeviceUpdateRequest(BaseModel):
    name: Optional[str] = None
    gateway_id: Optional[int] = None


class DeviceResponse(BaseModel):
    id: int
    name: str
    device_key: str
    kind: str
    gateway_id: Optional[int]
    is_online: bool
    last_seen_at: Optional[datetime]
    created_at: datetime
    # Direct devices return one-time secret on creation only
    secret: Optional[str] = None

    class Config:
        from_attributes = True


@router.get("", response_model=List[DeviceResponse])
async def list_devices(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(Device).where(Device.owner_id == current_user.id).order_by(Device.id.desc())
    result = await db.execute(query)
    devices = result.scalars().all()

    response_items = []
    for d in devices:
        item = DeviceResponse(
            id=d.id,
            name=d.name,
            device_key=d.device_key,
            kind=d.kind,
            gateway_id=d.gateway_id,
            is_online=calculate_online_status(d),
            last_seen_at=d.last_seen_at,
            created_at=d.created_at,
            secret=None,
        )
        response_items.append(item)
    return response_items


@router.post("", response_model=DeviceResponse, status_code=status.HTTP_201_CREATED)
async def create_device(
    payload: DeviceCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.ENGINEER])),
):
    if payload.kind not in VALID_KINDS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid device kind '{payload.kind}'. Must be one of {sorted(list(VALID_KINDS))}",
        )

    # If gateway_id provided, verify it belongs to current user
    if payload.gateway_id is not None:
        gw_res = await db.execute(
            select(Gateway).where(Gateway.id == payload.gateway_id, Gateway.owner_id == current_user.id)
        )
        if not gw_res.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Gateway {payload.gateway_id} does not exist or belongs to another user",
            )

    device_key = generate_device_key()
    one_time_secret = None
    secret_hash = None

    if payload.kind in DIRECT_KINDS:
        one_time_secret = generate_device_secret()
        secret_hash = get_password_hash(one_time_secret)

    device = Device(
        owner_id=current_user.id,
        name=payload.name,
        device_key=device_key,
        kind=payload.kind,
        gateway_id=payload.gateway_id,
        secret_hash=secret_hash,
        is_online=False,
    )
    db.add(device)
    await db.commit()
    await db.refresh(device)

    return DeviceResponse(
        id=device.id,
        name=device.name,
        device_key=device.device_key,
        kind=device.kind,
        gateway_id=device.gateway_id,
        is_online=False,
        last_seen_at=None,
        created_at=device.created_at,
        secret=one_time_secret,
    )


@router.get("/{device_id}", response_model=DeviceResponse)
async def get_device(
    device_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Device).where(Device.id == device_id, Device.owner_id == current_user.id)
    )
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found",
        )

    return DeviceResponse(
        id=device.id,
        name=device.name,
        device_key=device.device_key,
        kind=device.kind,
        gateway_id=device.gateway_id,
        is_online=calculate_online_status(device),
        last_seen_at=device.last_seen_at,
        created_at=device.created_at,
        secret=None,
    )


@router.put("/{device_id}", response_model=DeviceResponse)
async def update_device(
    device_id: int,
    payload: DeviceUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.ENGINEER])),
):
    result = await db.execute(
        select(Device).where(Device.id == device_id, Device.owner_id == current_user.id)
    )
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found",
        )

    if payload.name is not None:
        device.name = payload.name
    if payload.gateway_id is not None:
        gw_res = await db.execute(
            select(Gateway).where(Gateway.id == payload.gateway_id, Gateway.owner_id == current_user.id)
        )
        if not gw_res.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Gateway {payload.gateway_id} does not exist",
            )
        device.gateway_id = payload.gateway_id

    await db.commit()
    await db.refresh(device)

    return DeviceResponse(
        id=device.id,
        name=device.name,
        device_key=device.device_key,
        kind=device.kind,
        gateway_id=device.gateway_id,
        is_online=calculate_online_status(device),
        last_seen_at=device.last_seen_at,
        created_at=device.created_at,
        secret=None,
    )


@router.delete("/{device_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_device(
    device_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.ENGINEER])),
):
    result = await db.execute(
        select(Device).where(Device.id == device_id, Device.owner_id == current_user.id)
    )
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found",
        )

    await db.delete(device)
    await db.commit()
    return None
