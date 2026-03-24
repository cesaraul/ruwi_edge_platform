from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.database import get_db
from app.models.db.user import User

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/kpis")
async def get_kpis(
    vertical: str = Query(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if vertical == "agro":
        from app.analytics.agro.kpis import AgroKPIs
        return await AgroKPIs(db).calculate(current_user.org_id)
    elif vertical == "energia":
        from app.analytics.energia.kpis import EnergiaKPIs
        return await EnergiaKPIs(db).calculate(current_user.org_id)
    return {}


@router.get("/predictions/{device_id}")
async def get_predictions(
    device_id: UUID,
    hours_ahead: int = Query(6, ge=1, le=24),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from app.analytics.agro.predictions import AgroPredictions
    return await AgroPredictions(db).predict_temperature(device_id, hours_ahead)


@router.get("/anomalies/{device_id}")
async def get_anomalies(
    device_id: UUID,
    variable: str = Query(...),
    window_hours: int = Query(24, ge=1, le=168),
    vertical: str = Query("agro"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if vertical == "energia":
        from app.analytics.energia.anomaly import EnergiaAnomalyDetector
        return await EnergiaAnomalyDetector(db).detect_zscore(device_id, variable, window_hours)
    from app.analytics.agro.anomaly import AgroAnomalyDetector
    return await AgroAnomalyDetector(db).detect_zscore(device_id, variable, window_hours)
