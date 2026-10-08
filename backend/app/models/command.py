from datetime import datetime
from typing import Optional, Dict, Any, TYPE_CHECKING
from sqlalchemy import String, Integer, DateTime, ForeignKey, func, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base

if TYPE_CHECKING:
    from app.models.device import Device


class Command(Base):
    __tablename__ = "commands"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    device_id: Mapped[int] = mapped_column(Integer, ForeignKey("devices.id", ondelete="CASCADE"), nullable=False, index=True)
    payload: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="sent", nullable=False)  # sent, acked, failed
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), onupdate=func.now(), nullable=True)

    device: Mapped["Device"] = relationship("Device", back_populates="commands")
