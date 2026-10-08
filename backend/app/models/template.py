from datetime import datetime
from typing import Dict, Any
from sqlalchemy import String, Integer, DateTime, func, JSON
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class DeviceTemplate(Base):
    __tablename__ = "device_templates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    kind: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    config: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
