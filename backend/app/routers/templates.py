from typing import List, Dict, Any
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.template import DeviceTemplate
from app.security import get_current_user
from app.models.user import User

router = APIRouter(prefix="/templates", tags=["Device Templates"])


class TemplateResponse(BaseModel):
    id: int
    kind: str
    name: str
    config: Dict[str, Any]

    class Config:
        from_attributes = True


@router.get("", response_model=List[TemplateResponse])
async def list_templates(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(DeviceTemplate).order_by(DeviceTemplate.kind.asc()))
    templates = result.scalars().all()
    return [TemplateResponse.model_validate(t) for t in templates]
