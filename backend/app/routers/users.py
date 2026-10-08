from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.user import User, UserRole
from app.security import require_role
from app.routers.auth import UserResponse

router = APIRouter(prefix="/users", tags=["Users"])


class UpdateUserRequest(BaseModel):
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None


@router.get("", response_model=List[UserResponse])
async def list_users(
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(require_role([UserRole.ADMIN])),
):
    result = await db.execute(select(User).order_by(User.id.asc()))
    users = result.scalars().all()
    return [UserResponse.model_validate(u) for u in users]


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    payload: UpdateUserRequest,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(require_role([UserRole.ADMIN])),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID {user_id} not found",
        )

    # Prevent admin from deactivating themselves
    if user.id == admin_user.id and payload.is_active is False:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Administrators cannot deactivate their own account.",
        )

    if payload.role is not None:
        user.role = payload.role
    if payload.is_active is not None:
        user.is_active = payload.is_active

    await db.commit()
    await db.refresh(user)
    return UserResponse.model_validate(user)
