from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from pydantic import BaseModel, EmailStr
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.user import User, UserRole
from app.security import (
    get_password_hash,
    verify_password,
    create_access_token,
    get_current_user,
    decode_access_token,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


class UserRegisterRequest(BaseModel):
    email: EmailStr
    password: str


class UserLoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: int
    email: str
    role: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


@router.post("/register", response_model=TokenResponse)
async def register(
    payload: UserRegisterRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    # Check total user count
    user_count_result = await db.execute(select(func.count(User.id)))
    total_users = user_count_result.scalar_one()

    # Determine assigned role
    if total_users == 0:
        # First registered user becomes Admin (FR-A1)
        assigned_role = UserRole.ADMIN
    else:
        # If users exist, registration requires an active Admin session
        auth_header = request.headers.get("Authorization")
        admin_authenticated = False
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header[7:]
            token_payload = decode_access_token(token)
            if token_payload and "sub" in token_payload:
                admin_user_id = int(token_payload["sub"])
                admin_res = await db.execute(select(User).where(User.id == admin_user_id))
                admin_user = admin_res.scalar_one_or_none()
                if admin_user and admin_user.role == UserRole.ADMIN:
                    admin_authenticated = True

        if not admin_authenticated:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Public registration is closed. Please ask an administrator to create your account.",
            )
        assigned_role = UserRole.VIEWER

    # Check if email is already taken
    existing_user_res = await db.execute(select(User).where(User.email == payload.email))
    if existing_user_res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email address already exists.",
        )

    # Create new user
    new_user = User(
        email=payload.email,
        password_hash=get_password_hash(payload.password),
        role=assigned_role,
        is_active=True,
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    access_token = create_access_token(data={"sub": str(new_user.id), "role": new_user.role.value})

    # Set httpOnly cookie (FR-A7)
    response.set_cookie(
        key="access_token",
        value=f"Bearer {access_token}",
        httponly=True,
        samesite="lax",
        secure=False,  # Set to True in HTTPS/Production
    )

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(new_user),
    )


@router.post("/login", response_model=TokenResponse)
async def login(
    payload: UserLoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Account is currently deactivated.",
        )

    access_token = create_access_token(data={"sub": str(user.id), "role": user.role.value})

    response.set_cookie(
        key="access_token",
        value=f"Bearer {access_token}",
        httponly=True,
        samesite="lax",
        secure=False,
    )

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(user),
    )


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie(key="access_token")
    return {"message": "Successfully logged out"}


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return UserResponse.model_validate(current_user)
