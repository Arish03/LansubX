from datetime import datetime
from typing import List, Optional, TYPE_CHECKING
from sqlalchemy import String, Integer, Boolean, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.gateway import Gateway
    from app.models.telemetry import Telemetry
    from app.models.alarm import AlarmRule, Alarm
    from app.models.command import Command


class Device(Base):
    __tablename__ = "devices"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    owner_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    gateway_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("gateways.id", ondelete="SET NULL"), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    device_key: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    kind: Mapped[str] = mapped_column(String(50), nullable=False)  # esp32, sensor_controller, plc, modbus, opcua, lora
    secret_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    last_seen_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    is_online: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    owner: Mapped["User"] = relationship("User", back_populates="devices")
    gateway: Mapped[Optional["Gateway"]] = relationship("Gateway", back_populates="devices")
    telemetry_entries: Mapped[List["Telemetry"]] = relationship("Telemetry", back_populates="device", cascade="all, delete-orphan")
    alarm_rules: Mapped[List["AlarmRule"]] = relationship("AlarmRule", back_populates="device", cascade="all, delete-orphan")
    alarms: Mapped[List["Alarm"]] = relationship("Alarm", back_populates="device", cascade="all, delete-orphan")
    commands: Mapped[List["Command"]] = relationship("Command", back_populates="device", cascade="all, delete-orphan")
