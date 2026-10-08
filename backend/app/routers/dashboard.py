from typing import List, Dict, Any
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select, func, and_, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.device import Device
from app.models.gateway import Gateway
from app.models.alarm import Alarm, AlarmRule
from app.models.user import User
from app.security import get_current_user
from app.routers.devices import calculate_online_status
from app.routers.alarms import AlarmDetailResponse

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


class DashboardStatsResponse(BaseModel):
    total_devices: int
    online_devices: int
    offline_devices: int
    active_alarms: int
    total_gateways: int
    recent_alarms: List[AlarmDetailResponse]


@router.get("", response_model=DashboardStatsResponse)
async def get_dashboard_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns aggregated metrics and recent alarms for the user's dashboard (FR-U2)."""
    # 1. Devices and online status calculation
    dev_query = select(Device).where(Device.owner_id == current_user.id)
    dev_result = await db.execute(dev_query)
    devices = dev_result.scalars().all()

    total_devices = len(devices)
    online_devices = sum(1 for d in devices if calculate_online_status(d))
    offline_devices = total_devices - online_devices

    # 2. Total gateways
    gw_count_res = await db.execute(
        select(func.count(Gateway.id)).where(Gateway.owner_id == current_user.id)
    )
    total_gateways = gw_count_res.scalar_one()

    # 3. Active & acknowledged alarms count
    active_alarms_res = await db.execute(
        select(func.count(Alarm.id))
        .join(Device, Alarm.device_id == Device.id)
        .where(
            and_(
                Device.owner_id == current_user.id,
                Alarm.state.in_(["active", "acknowledged"]),
            )
        )
    )
    active_alarms_count = active_alarms_res.scalar_one()

    # 4. Recent alarms (up to 5 most recent active or acknowledged)
    recent_query = (
        select(Alarm, Device, AlarmRule)
        .join(Device, Alarm.device_id == Device.id)
        .join(AlarmRule, Alarm.rule_id == AlarmRule.id)
        .where(Device.owner_id == current_user.id)
        .order_by(desc(Alarm.opened_at))
        .limit(5)
    )
    recent_res = await db.execute(recent_query)
    recent_rows = recent_res.all()

    recent_alarms: List[AlarmDetailResponse] = []
    for alarm, device, rule in recent_rows:
        recent_alarms.append(
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

    return DashboardStatsResponse(
        total_devices=total_devices,
        online_devices=online_devices,
        offline_devices=offline_devices,
        active_alarms=active_alarms_count,
        total_gateways=total_gateways,
        recent_alarms=recent_alarms,
    )
