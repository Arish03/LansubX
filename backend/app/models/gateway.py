from datetime import datetime
from typing import List, TYPE_CHECKING, Dict, Any
from sqlalchemy import String, Integer, DateTime, ForeignKey, func, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.device import Device


class Gateway(Base):
    __tablename__ = "gateways"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    owner_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    type: Mapped[str] = mapped_column(String(50), nullable=False)  # modbus, opcua, lora
    config: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    owner: Mapped["User"] = relationship("User", back_populates="gateways")
    devices: Mapped[List["Device"]] = relationship("Device", back_populates="gateway")
