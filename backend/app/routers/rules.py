from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, field_validator
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.alarm import AlarmRule
from app.models.device import Device
from app.models.user import User, UserRole
from app.security import get_current_user, require_role

router = APIRouter(prefix="/rules", tags=["Alarm Rules"])

VALID_OPERATORS = {">", "<", ">=", "<=", "=="}
VALID_SEVERITIES = {"info", "warning", "critical"}


class RuleCreateRequest(BaseModel):
    device_id: int
    metric: str
    operator: str
    threshold: float
    severity: str = "warning"
    debounce_seconds: int = 0
    enabled: bool = True

    @field_validator("operator")
    @classmethod
    def validate_operator(cls, v: str) -> str:
        if v not in VALID_OPERATORS:
            raise ValueError(f"Operator must be one of {sorted(list(VALID_OPERATORS))}")
        return v

    @field_validator("severity")
    @classmethod
    def validate_severity(cls, v: str) -> str:
        if v not in VALID_SEVERITIES:
            raise ValueError(f"Severity must be one of {sorted(list(VALID_SEVERITIES))}")
        return v


class RuleUpdateRequest(BaseModel):
    metric: Optional[str] = None
    operator: Optional[str] = None
    threshold: Optional[float] = None
    severity: Optional[str] = None
    debounce_seconds: Optional[int] = None
    enabled: Optional[bool] = None

    @field_validator("operator")
    @classmethod
    def validate_operator(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in VALID_OPERATORS:
            raise ValueError(f"Operator must be one of {sorted(list(VALID_OPERATORS))}")
        return v

    @field_validator("severity")
    @classmethod
    def validate_severity(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in VALID_SEVERITIES:
            raise ValueError(f"Severity must be one of {sorted(list(VALID_SEVERITIES))}")
        return v


class RuleResponse(BaseModel):
    id: int
    device_id: int
    metric: str
    operator: str
    threshold: float
    severity: str
    debounce_seconds: int
    enabled: bool
    created_at: datetime

    class Config:
        from_attributes = True


@router.get("", response_model=List[RuleResponse])
async def list_rules(
    device_id: Optional[int] = Query(None, description="Filter rules by device ID"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lists alarm rules scoped to devices owned by the current user (FR-R1)."""
    # Join with devices to ensure owner scoping
    query = (
        select(AlarmRule)
        .join(Device, AlarmRule.device_id == Device.id)
        .where(Device.owner_id == current_user.id)
    )
    if device_id is not None:
        query = query.where(AlarmRule.device_id == device_id)

    query = query.order_by(AlarmRule.id.desc())
    result = await db.execute(query)
    rules = result.scalars().all()
    return [RuleResponse.model_validate(r) for r in rules]


@router.post("", response_model=RuleResponse, status_code=status.HTTP_201_CREATED)
async def create_rule(
    payload: RuleCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.ENGINEER])),
):
    """Creates a new alarm rule for a device owned by the user."""
    dev_res = await db.execute(
        select(Device).where(Device.id == payload.device_id, Device.owner_id == current_user.id)
    )
    device = dev_res.scalar_one_or_none()
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Device {payload.device_id} not found or access denied",
        )

    rule = AlarmRule(
        device_id=payload.device_id,
        metric=payload.metric.strip(),
        operator=payload.operator,
        threshold=payload.threshold,
        severity=payload.severity,
        debounce_seconds=max(0, payload.debounce_seconds),
        enabled=payload.enabled,
    )
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return RuleResponse.model_validate(rule)


@router.put("/{rule_id}", response_model=RuleResponse)
async def update_rule(
    rule_id: int,
    payload: RuleUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.ENGINEER])),
):
    """Updates an existing alarm rule."""
    query = (
        select(AlarmRule)
        .join(Device, AlarmRule.device_id == Device.id)
        .where(AlarmRule.id == rule_id, Device.owner_id == current_user.id)
    )
    result = await db.execute(query)
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alarm rule not found",
        )

    if payload.metric is not None:
        rule.metric = payload.metric.strip()
    if payload.operator is not None:
        rule.operator = payload.operator
    if payload.threshold is not None:
        rule.threshold = payload.threshold
    if payload.severity is not None:
        rule.severity = payload.severity
    if payload.debounce_seconds is not None:
        rule.debounce_seconds = max(0, payload.debounce_seconds)
    if payload.enabled is not None:
        rule.enabled = payload.enabled

    await db.commit()
    await db.refresh(rule)
    return RuleResponse.model_validate(rule)


@router.delete("/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_rule(
    rule_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.ENGINEER])),
):
    """Deletes an alarm rule."""
    query = (
        select(AlarmRule)
        .join(Device, AlarmRule.device_id == Device.id)
        .where(AlarmRule.id == rule_id, Device.owner_id == current_user.id)
    )
    result = await db.execute(query)
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alarm rule not found",
        )

    await db.delete(rule)
    await db.commit()
    return None
