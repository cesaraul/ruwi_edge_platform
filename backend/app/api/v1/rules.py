from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.dependencies import get_current_user, require_role
from app.database import get_db
from app.models.db.rule import Rule
from app.models.db.user import User
from app.models.schemas.rule import RuleCreate, RuleResponse

router = APIRouter(prefix="/rules", tags=["rules"])


@router.get("", response_model=list[RuleResponse])
async def list_rules(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Rule).where(Rule.org_id == current_user.org_id))
    return result.scalars().all()


@router.post("", response_model=RuleResponse, status_code=201)
async def create_rule(
    body: RuleCreate,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    rule = Rule(org_id=current_user.org_id, **body.model_dump())
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return rule


@router.get("/{rule_id}", response_model=RuleResponse)
async def get_rule(
    rule_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await _get_owned_rule(rule_id, current_user.org_id, db)


@router.put("/{rule_id}", response_model=RuleResponse)
async def update_rule(
    rule_id: UUID,
    body: RuleCreate,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    rule = await _get_owned_rule(rule_id, current_user.org_id, db)
    for field, value in body.model_dump().items():
        setattr(rule, field, value)
    await db.commit()
    await db.refresh(rule)
    return rule


@router.delete("/{rule_id}", status_code=204)
async def delete_rule(
    rule_id: UUID,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    rule = await _get_owned_rule(rule_id, current_user.org_id, db)
    await db.delete(rule)
    await db.commit()


@router.patch("/{rule_id}/toggle", response_model=RuleResponse)
async def toggle_rule(
    rule_id: UUID,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    rule = await _get_owned_rule(rule_id, current_user.org_id, db)
    rule.active = not rule.active
    await db.commit()
    await db.refresh(rule)
    return rule


async def _get_owned_rule(rule_id: UUID, org_id: UUID, db: AsyncSession) -> Rule:
    rule = await db.get(Rule, rule_id)
    if not rule or rule.org_id != org_id:
        raise HTTPException(status_code=404, detail="Regla no encontrada")
    return rule
