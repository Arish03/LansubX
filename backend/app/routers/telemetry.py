from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select, and_, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.device import Device
from app.models.telemetry import Telemetry
from app.models.user import User
from app.security import get_current_user

router = APIRouter(prefix="/devices/{device_id}", tags=["Telemetry"])


class TelemetryPoint(BaseModel):
    metric: str
    value: float
    ts: datetime

    class Config:
        from_attributes = True


class LatestMetricValue(BaseModel):
    value: float
    ts: datetime


async def verify_device_ownership(device_id: int, user_id: int, db: AsyncSession) -> Device:
    result = await db.execute(
        select(Device).where(Device.id == device_id, Device.owner_id == user_id)
    )
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Device {device_id} not found or access denied",
        )
    return device


@router.get("/metrics", response_model=List[str])
async def get_device_metrics(
    device_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lists all distinct metric names recorded for a device (FR-T3)."""
    await verify_device_ownership(device_id, current_user.id, db)

    query = (
        select(Telemetry.metric)
        .where(Telemetry.device_id == device_id)
        .distinct()
        .order_by(Telemetry.metric.asc())
    )
    result = await db.execute(query)
    metrics = result.scalars().all()
    return list(metrics)


@router.get("/telemetry/latest", response_model=Dict[str, LatestMetricValue])
async def get_latest_telemetry(
    device_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns the most recent value for every metric on a device (FR-T1)."""
    await verify_device_ownership(device_id, current_user.id, db)

    # Subquery for maximum timestamp per metric
    subq = (
        select(
            Telemetry.metric,
            func.max(Telemetry.ts).label("max_ts")
        )
        .where(Telemetry.device_id == device_id)
        .group_by(Telemetry.metric)
        .subquery()
    )

    query = (
        select(Telemetry)
        .join(
            subq,
            and_(
                Telemetry.device_id == device_id,
                Telemetry.metric == subq.c.metric,
                Telemetry.ts == subq.c.max_ts,
            )
        )
    )
    result = await db.execute(query)
    entries = result.scalars().all()

    latest_map: Dict[str, LatestMetricValue] = {}
    for entry in entries:
        latest_map[entry.metric] = LatestMetricValue(value=entry.value, ts=entry.ts)
    return latest_map


@router.get("/telemetry", response_model=List[TelemetryPoint])
async def get_telemetry_history(
    device_id: int,
    metric: Optional[str] = Query(None, description="Filter by metric name"),
    start: Optional[datetime] = Query(None, description="Start timestamp"),
    end: Optional[datetime] = Query(None, description="End timestamp"),
    limit: int = Query(500, ge=1, le=5000, description="Maximum data points to return"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Queries historical telemetry for a device (FR-T2)."""
    await verify_device_ownership(device_id, current_user.id, db)

    filters = [Telemetry.device_id == device_id]
    if metric:
        filters.append(Telemetry.metric == metric)
    if start:
        filters.append(Telemetry.ts >= start)
    if end:
        filters.append(Telemetry.ts <= end)

    query = (
        select(Telemetry)
        .where(and_(*filters))
        .order_by(Telemetry.ts.asc())
        .limit(limit)
    )
    result = await db.execute(query)
    records = result.scalars().all()
    return [TelemetryPoint.model_validate(r) for r in records]
