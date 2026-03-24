from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.database import get_db
from app.models.db.user import User
from app.models.schemas.telemetry import LatestReading, TelemetryPoint, TelemetryResponse

router = APIRouter(prefix="/telemetry", tags=["telemetry"])

RANGE_MAP = {
    "1h":  (timedelta(minutes=15), timedelta(hours=1)),
    "24h": (timedelta(minutes=15), timedelta(hours=24)),
    "7d":  (timedelta(hours=1),    timedelta(days=7)),
    "30d": (timedelta(hours=1),    timedelta(days=30)),
}


@router.get("/{device_id}", response_model=TelemetryResponse)
async def get_telemetry(
    device_id: UUID,
    variable: str = Query(...),
    range: str = Query("24h"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    bucket_size, since = RANGE_MAP.get(range, (timedelta(minutes=15), timedelta(hours=24)))
    cutoff = datetime.now(timezone.utc) - since

    if range in ("7d", "30d"):
        rows = await db.execute(
            text("""
                SELECT bucket AS time, avg_value AS value
                FROM readings_hourly
                WHERE device_id = :device_id AND variable = :variable
                  AND bucket > :cutoff
                ORDER BY bucket
            """),
            {"device_id": str(device_id), "variable": variable, "cutoff": cutoff},
        )
    else:
        rows = await db.execute(
            text("""
                SELECT time_bucket(:bucket, time) AS time,
                       AVG(value) AS value
                FROM sensor_readings
                WHERE device_id = :device_id AND variable = :variable
                  AND time > :cutoff
                GROUP BY 1 ORDER BY 1
            """),
            {"device_id": str(device_id), "variable": variable, "bucket": bucket_size, "cutoff": cutoff},
        )

    data = [TelemetryPoint(time=row.time, value=round(row.value, 4)) for row in rows]
    return TelemetryResponse(device_id=device_id, variable=variable, range=range, data=data)


@router.get("/{device_id}/latest", response_model=list[LatestReading])
async def get_latest(
    device_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    import json
    from app.cache import redis

    pattern = f"last:{device_id}:*"
    keys = await redis.keys(pattern)
    results = []
    for key in keys:
        raw = await redis.get(key)
        if raw:
            results.append(LatestReading(**json.loads(raw)))

    if results:
        return results

    rows = await db.execute(
        text("""
            SELECT DISTINCT ON (variable)
                variable, value, unit, time
            FROM sensor_readings
            WHERE device_id = :device_id
            ORDER BY variable, time DESC
        """),
        {"device_id": str(device_id)},
    )
    return [LatestReading(variable=r.variable, value=r.value, unit=r.unit, time=r.time) for r in rows]
