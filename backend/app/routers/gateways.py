from datetime import datetime
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.gateway import Gateway
from app.models.user import User, UserRole
from app.security import get_current_user, require_role

router = APIRouter(prefix="/gateways", tags=["Gateways"])


class GatewayCreateRequest(BaseModel):
    name: str
    type: str  # modbus, opcua, lora
    config: Optional[Dict[str, Any]] = None


class GatewayResponse(BaseModel):
    id: int
    name: str
    type: str
    config: Dict[str, Any]
    created_at: datetime

    class Config:
        from_attributes = True


@router.get("", response_model=List[GatewayResponse])
async def list_gateways(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(Gateway).where(Gateway.owner_id == current_user.id).order_by(Gateway.id.desc())
    result = await db.execute(query)
    gateways = result.scalars().all()
    return [GatewayResponse.model_validate(g) for g in gateways]


@router.post("", response_model=GatewayResponse, status_code=status.HTTP_201_CREATED)
async def create_gateway(
    payload: GatewayCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.ENGINEER])),
):
    valid_types = {"modbus", "opcua", "lora"}
    if payload.type not in valid_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid gateway type '{payload.type}'. Must be one of {valid_types}",
        )

    gateway = Gateway(
        owner_id=current_user.id,
        name=payload.name,
        type=payload.type,
        config=payload.config or {},
    )
    db.add(gateway)
    await db.commit()
    await db.refresh(gateway)
    return GatewayResponse.model_validate(gateway)


@router.delete("/{gateway_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_gateway(
    gateway_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.ENGINEER])),
):
    result = await db.execute(
        select(Gateway).where(Gateway.id == gateway_id, Gateway.owner_id == current_user.id)
    )
    gateway = result.scalar_one_or_none()
    if not gateway:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Gateway not found",
        )

    await db.delete(gateway)
    await db.commit()
    return None
