from datetime import datetime
from typing import TYPE_CHECKING
from sqlalchemy import String, Integer, Float, DateTime, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base

if TYPE_CHECKING:
    from app.models.device import Device


class Telemetry(Base):
    __tablename__ = "telemetry"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)
    device_id: Mapped[int] = mapped_column(Integer, ForeignKey("devices.id", ondelete="CASCADE"), nullable=False, index=True)
    metric: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    value: Mapped[float] = mapped_column(Float, nullable=False)
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)

    device: Mapped["Device"] = relationship("Device", back_populates="telemetry_entries")

    __table_args__ = (
        Index("ix_telemetry_device_metric_ts", "device_id", "metric", "ts"),
    )
