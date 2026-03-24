from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.dependencies import get_current_user, require_role
from app.core.security import hash_password
from app.database import get_db
from app.models.db.user import User
from app.models.schemas.user import UserCreate, UserResponse, UserUpdate

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserResponse])
async def list_users(
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.org_id == current_user.org_id))
    return result.scalars().all()


@router.post("", response_model=UserResponse, status_code=201)
async def create_user(
    body: UserCreate,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    user = User(
        org_id=current_user.org_id,
        email=body.email,
        hashed_password=hash_password(body.password),
        role=body.role,
        phone_whatsapp=body.phone_whatsapp,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: UUID,
    body: UserUpdate,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    user = await _get_org_user(user_id, current_user.org_id, db)
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(user, field, value)
    await db.commit()
    await db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=204)
async def delete_user(
    user_id: UUID,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    user = await _get_org_user(user_id, current_user.org_id, db)
    user.active = False
    await db.commit()


async def _get_org_user(user_id: UUID, org_id: UUID, db: AsyncSession) -> User:
    user = await db.get(User, user_id)
    if not user or user.org_id != org_id:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return user
