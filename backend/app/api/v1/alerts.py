from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.dependencies import get_current_user, require_role
from app.database import get_db
from app.models.db.alert import Alert
from app.models.db.user import User
from app.models.schemas.alert import AcknowledgeRequest, AlertResponse

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("", response_model=list[AlertResponse])
async def list_alerts(
    acknowledged: bool | None = None,
    severity: str | None = None,
    vertical: str | None = None,
    device_id: UUID | None = None,
    limit: int = Query(50, le=200),
    offset: int = 0,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    filters = ["a.org_id = :org_id"]
    params: dict = {"org_id": str(current_user.org_id), "limit": limit, "offset": offset}

    if acknowledged is not None:
        filters.append("a.acknowledged = :acknowledged")
        params["acknowledged"] = acknowledged
    if severity:
        filters.append("a.severity = :severity")
        params["severity"] = severity
    if vertical:
        filters.append("d.vertical = :vertical")
        params["vertical"] = vertical
    if device_id:
        filters.append("a.device_id = :device_id")
        params["device_id"] = str(device_id)

    where = " AND ".join(filters)
    rows = await db.execute(
        text(f"""
            SELECT a.*, d.name AS device_name, d.vertical AS vertical
            FROM alerts_log a
            LEFT JOIN devices d ON d.id = a.device_id
            WHERE {where}
            ORDER BY a.time DESC
            LIMIT :limit OFFSET :offset
        """),
        params,
    )
    return [AlertResponse(**dict(r._mapping)) for r in rows]


@router.get("/{alert_id}", response_model=AlertResponse)
async def get_alert(
    alert_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    row = await db.execute(
        text("""
            SELECT a.*, d.name AS device_name, d.vertical AS vertical
            FROM alerts_log a
            LEFT JOIN devices d ON d.id = a.device_id
            WHERE a.id = :id AND a.org_id = :org_id
        """),
        {"id": str(alert_id), "org_id": str(current_user.org_id)},
    )
    alert = row.one_or_none()
    if not alert:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Alerta no encontrada")
    return AlertResponse(**dict(alert._mapping))


@router.patch("/{alert_id}/acknowledge", response_model=AlertResponse)
async def acknowledge_alert(
    alert_id: UUID,
    body: AcknowledgeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await db.execute(
        text("""
            UPDATE alerts_log
            SET acknowledged = TRUE,
                acknowledged_by = :by,
                acknowledged_at = NOW()
            WHERE id = :id AND org_id = :org_id
        """),
        {"id": str(alert_id), "org_id": str(current_user.org_id), "by": body.acknowledged_by},
    )
    await db.commit()

    row = await db.execute(
        text("SELECT * FROM alerts_log WHERE id = :id"),
        {"id": str(alert_id)},
    )
    return AlertResponse(**dict(row.one()._mapping))
