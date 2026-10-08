from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select, and_, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db import get_db
from app.models.alarm import Alarm, AlarmRule
from app.models.device import Device
from app.models.user import User, UserRole
from app.security import get_current_user, require_role
from app.services.redis_bus import publish_live_event

router = APIRouter(prefix="/alarms", tags=["Alarms"])


class AlarmDetailResponse(BaseModel):
    id: int
    rule_id: int
    device_id: int
    device_name: str
    device_key: str
    metric: str
    state: str  # active, acknowledged, resolved
    value: float
    threshold: Optional[float] = None
    severity: Optional[str] = None
    opened_at: datetime
    closed_at: Optional[datetime] = None


@router.get("", response_model=List[AlarmDetailResponse])
async def list_alarms(
    state: Optional[str] = Query(None, description="Filter by alarm state (active, acknowledged, resolved)"),
    device_id: Optional[int] = Query(None, description="Filter by device ID"),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lists alarms with device and rule metadata, scoped to user's devices (FR-R6)."""
    query = (
        select(Alarm, Device, AlarmRule)
        .join(Device, Alarm.device_id == Device.id)
        .join(AlarmRule, Alarm.rule_id == AlarmRule.id)
        .where(Device.owner_id == current_user.id)
    )

    if state:
        query = query.where(Alarm.state == state)
    if device_id:
        query = query.where(Alarm.device_id == device_id)

    query = query.order_by(desc(Alarm.opened_at)).offset(offset).limit(limit)
    result = await db.execute(query)
    rows = result.all()

    response = []
    for alarm, device, rule in rows:
        response.append(
            AlarmDetailResponse(
                id=alarm.id,
                rule_id=alarm.rule_id,
                device_id=alarm.device_id,
                device_name=device.name,
                device_key=device.device_key,
                metric=rule.metric,
                state=alarm.state,
                value=alarm.value,
                threshold=rule.threshold,
                severity=rule.severity,
                opened_at=alarm.opened_at,
                closed_at=alarm.closed_at,
            )
        )
    return response


@router.post("/{alarm_id}/ack", response_model=AlarmDetailResponse)
async def acknowledge_alarm(
    alarm_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.ENGINEER, UserRole.OPERATOR])),
):
    """Acknowledges an active alarm (FR-R5)."""
    query = (
        select(Alarm, Device, AlarmRule)
        .join(Device, Alarm.device_id == Device.id)
        .join(AlarmRule, Alarm.rule_id == AlarmRule.id)
        .where(Alarm.id == alarm_id, Device.owner_id == current_user.id)
    )
    result = await db.execute(query)
    row = result.first()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alarm not found",
        )

    alarm, device, rule = row
    if alarm.state == "resolved":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot acknowledge an already resolved alarm",
        )

    alarm.state = "acknowledged"
    await db.commit()

    # Fan-out event over Redis
    await publish_live_event(
        owner_id=current_user.id,
        event={
            "type": "alarm",
            "event": "acknowledged",
            "alarm_id": alarm.id,
            "device_id": device.id,
            "device_key": device.device_key,
            "metric": rule.metric,
            "state": "acknowledged",
        }
    )

    return AlarmDetailResponse(
        id=alarm.id,
        rule_id=alarm.rule_id,
        device_id=alarm.device_id,
        device_name=device.name,
        device_key=device.device_key,
        metric=rule.metric,
        state=alarm.state,
        value=alarm.value,
        threshold=rule.threshold,
        severity=rule.severity,
        opened_at=alarm.opened_at,
        closed_at=alarm.closed_at,
    )


@router.post("/{alarm_id}/resolve", response_model=AlarmDetailResponse)
async def manual_resolve_alarm(
    alarm_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.ENGINEER, UserRole.OPERATOR])),
):
    """Manually resolves an active or acknowledged alarm (FR-R5)."""
    query = (
        select(Alarm, Device, AlarmRule)
        .join(Device, Alarm.device_id == Device.id)
        .join(AlarmRule, Alarm.rule_id == AlarmRule.id)
        .where(Alarm.id == alarm_id, Device.owner_id == current_user.id)
    )
    result = await db.execute(query)
    row = result.first()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alarm not found",
        )

    alarm, device, rule = row
    now_utc = datetime.now(timezone.utc)
    alarm.state = "resolved"
    alarm.closed_at = now_utc
    await db.commit()

    # Fan-out event over Redis
    await publish_live_event(
        owner_id=current_user.id,
        event={
            "type": "alarm",
            "event": "resolved",
            "alarm_id": alarm.id,
            "device_id": device.id,
            "device_key": device.device_key,
            "metric": rule.metric,
            "state": "resolved",
            "closed_at": now_utc.isoformat(),
        }
    )

    return AlarmDetailResponse(
        id=alarm.id,
        rule_id=alarm.rule_id,
        device_id=alarm.device_id,
        device_name=device.name,
        device_key=device.device_key,
        metric=rule.metric,
        state=alarm.state,
        value=alarm.value,
        threshold=rule.threshold,
        severity=rule.severity,
        opened_at=alarm.opened_at,
        closed_at=alarm.closed_at,
    )
