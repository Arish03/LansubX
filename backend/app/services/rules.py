import logging
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.alarm import AlarmRule, Alarm
from app.services.redis_bus import publish_live_event

logger = logging.getLogger("rules_engine")


def evaluate_condition(value: float, operator: str, threshold: float) -> bool:
    if operator == ">":
        return value > threshold
    elif operator == "<":
        return value < threshold
    elif operator == ">=":
        return value >= threshold
    elif operator == "<=":
        return value <= threshold
    elif operator == "==":
        return abs(value - threshold) < 1e-6
    return False


async def evaluate_rules_for_metric(
    db: AsyncSession,
    device_id: int,
    owner_id: int,
    device_key: str,
    metric: str,
    value: float,
    ts: datetime,
) -> None:
    """
    Evaluates enabled alarm rules for a specific metric on a device.
    - If condition breaks and outside debounce: opens an alarm.
    - If condition returns to normal and an alarm is open: auto-resolves it.
    """
    try:
        # 1. Fetch enabled rules for this device & metric
        rules_query = select(AlarmRule).where(
            and_(
                AlarmRule.device_id == device_id,
                AlarmRule.metric == metric,
                AlarmRule.enabled.is_(True),
            )
        )
        rules_res = await db.execute(rules_query)
        rules = rules_res.scalars().all()

        if not rules:
            return

        for rule in rules:
            condition_broken = evaluate_condition(value, rule.operator, rule.threshold)

            # Query any open (active or acknowledged) alarm for this rule
            alarm_query = select(Alarm).where(
                and_(
                    Alarm.rule_id == rule.id,
                    Alarm.state.in_(["active", "acknowledged"]),
                )
            ).order_by(Alarm.opened_at.desc())
            alarm_res = await db.execute(alarm_query)
            open_alarm = alarm_res.scalar_one_or_none()

            now_utc = datetime.now(timezone.utc)

            if condition_broken:
                if not open_alarm:
                    # Check debounce: check most recent alarm opened_at
                    recent_query = select(Alarm).where(Alarm.rule_id == rule.id).order_by(Alarm.opened_at.desc())
                    recent_res = await db.execute(recent_query)
                    last_alarm = recent_res.scalars().first()

                    if last_alarm and rule.debounce_seconds > 0:
                        opened_at = last_alarm.opened_at
                        if opened_at.tzinfo is None:
                            opened_at = opened_at.replace(tzinfo=timezone.utc)
                        if (now_utc - opened_at).total_seconds() < rule.debounce_seconds:
                            # Inside debounce window, do not spam
                            continue

                    # Open new alarm
                    new_alarm = Alarm(
                        rule_id=rule.id,
                        device_id=device_id,
                        state="active",
                        value=value,
                        opened_at=now_utc,
                    )
                    db.add(new_alarm)
                    await db.flush()

                    logger.info("Alarm OPENED: device=%s rule=%s metric=%s value=%s", device_key, rule.id, metric, value)
                    await publish_live_event(
                        owner_id=owner_id,
                        event={
                            "type": "alarm",
                            "event": "opened",
                            "alarm_id": new_alarm.id,
                            "rule_id": rule.id,
                            "device_id": device_id,
                            "device_key": device_key,
                            "metric": metric,
                            "severity": rule.severity,
                            "value": value,
                            "threshold": rule.threshold,
                            "operator": rule.operator,
                            "opened_at": now_utc.isoformat(),
                        }
                    )
            else:
                # Value returned to normal: auto-resolve open alarm
                if open_alarm:
                    open_alarm.state = "resolved"
                    open_alarm.closed_at = now_utc
                    await db.flush()

                    logger.info("Alarm AUTO-RESOLVED: device=%s rule=%s metric=%s", device_key, rule.id, metric)
                    await publish_live_event(
                        owner_id=owner_id,
                        event={
                            "type": "alarm",
                            "event": "resolved",
                            "alarm_id": open_alarm.id,
                            "rule_id": rule.id,
                            "device_id": device_id,
                            "device_key": device_key,
                            "metric": metric,
                            "closed_at": now_utc.isoformat(),
                        }
                    )

    except Exception as e:
        logger.error("Error evaluating rules for device %s metric %s: %s", device_key, metric, e, exc_info=True)
