from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


class AnalyticsBase:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def _query_timebucket(
        self,
        device_id: UUID,
        variable: str,
        bucket: str,
        since: timedelta,
    ) -> list[dict]:
        rows = await self.db.execute(
            text("""
                SELECT
                    time_bucket(CAST(:bucket AS INTERVAL), time) AS t,
                    AVG(value) AS avg,
                    MIN(value) AS min,
                    MAX(value) AS max
                FROM sensor_readings
                WHERE device_id = :device_id
                  AND variable = :variable
                  AND time > NOW() - CAST(:since AS INTERVAL)
                GROUP BY t
                ORDER BY t
            """),
            {"bucket": bucket, "device_id": str(device_id), "variable": variable, "since": str(since)},
        )
        return [dict(r._mapping) for r in rows]

    async def _count_alerts(self, org_id: UUID, days: int = 7) -> int:
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        result = await self.db.execute(
            text("SELECT COUNT(*) FROM alerts_log WHERE org_id = :org_id AND time > :cutoff"),
            {"org_id": str(org_id), "cutoff": cutoff},
        )
        return result.scalar() or 0
