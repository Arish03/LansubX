import enum
from datetime import datetime
from typing import List, TYPE_CHECKING
from sqlalchemy import String, Boolean, DateTime, func, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base

if TYPE_CHECKING:
    from app.models.device import Device
    from app.models.gateway import Gateway


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    ENGINEER = "engineer"
    OPERATOR = "operator"
    VIEWER = "viewer"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, native_enum=False),
        default=UserRole.VIEWER,
        nullable=False
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    devices: Mapped[List["Device"]] = relationship("Device", back_populates="owner", cascade="all, delete-orphan")
    gateways: Mapped[List["Gateway"]] = relationship("Gateway", back_populates="owner", cascade="all, delete-orphan")
