from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, ConfigDict
from uuid import UUID
from datetime import datetime

from app.core.dependencies import get_current_user, require_role
from app.database import get_db
from app.models.db.organization import Organization
from app.models.db.user import User

router = APIRouter(prefix="/organizations", tags=["organizations"])


class OrgResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    name: str
    vertical: str | None = None
    plan: str
    created_at: datetime


class OrgUpdate(BaseModel):
    name: str | None = None
    vertical: str | None = None


@router.get("/me", response_model=OrgResponse)
async def get_my_org(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    org = await db.get(Organization, current_user.org_id)
    return org


@router.put("/me", response_model=OrgResponse)
async def update_my_org(
    body: OrgUpdate,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    org = await db.get(Organization, current_user.org_id)
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(org, field, value)
    await db.commit()
    await db.refresh(org)
    return org
