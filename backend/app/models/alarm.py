from datetime import datetime
from typing import Optional, List, TYPE_CHECKING
from sqlalchemy import String, Integer, Float, Boolean, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base

if TYPE_CHECKING:
    from app.models.device import Device


class AlarmRule(Base):
    __tablename__ = "alarm_rules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    device_id: Mapped[int] = mapped_column(Integer, ForeignKey("devices.id", ondelete="CASCADE"), nullable=False, index=True)
    metric: Mapped[str] = mapped_column(String(100), nullable=False)
    operator: Mapped[str] = mapped_column(String(10), nullable=False)  # >, <, >=, <=, ==
    threshold: Mapped[float] = mapped_column(Float, nullable=False)
    severity: Mapped[str] = mapped_column(String(20), default="warning", nullable=False)  # info, warning, critical
    debounce_seconds: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    device: Mapped["Device"] = relationship("Device", back_populates="alarm_rules")
    alarms: Mapped[List["Alarm"]] = relationship("Alarm", back_populates="rule", cascade="all, delete-orphan")


class Alarm(Base):
    __tablename__ = "alarms"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    rule_id: Mapped[int] = mapped_column(Integer, ForeignKey("alarm_rules.id", ondelete="CASCADE"), nullable=False, index=True)
    device_id: Mapped[int] = mapped_column(Integer, ForeignKey("devices.id", ondelete="CASCADE"), nullable=False, index=True)
    state: Mapped[str] = mapped_column(String(20), default="active", nullable=False)  # active, acknowledged, resolved
    value: Mapped[float] = mapped_column(Float, nullable=False)
    opened_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    closed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    rule: Mapped["AlarmRule"] = relationship("AlarmRule", back_populates="alarms")
    device: Mapped["Device"] = relationship("Device", back_populates="alarms")
