from uuid import UUID

from sqlalchemy import text
from sqlalchemy.future import select

from app.analytics.base import AnalyticsBase
from app.models.db.device import Device


class EnergiaKPIs(AnalyticsBase):
    async def calculate(self, org_id: UUID) -> dict:
        result = await self.db.execute(
            select(Device).where(Device.org_id == org_id, Device.vertical == "energia", Device.active == True)
        )
        devices = result.scalars().all()

        avg_pf_row = await self.db.execute(
            text("""
                SELECT AVG(value) FROM sensor_readings
                WHERE org_id = :org_id AND vertical = 'energia'
                  AND variable = 'power_factor'
                  AND time > NOW() - INTERVAL '1 hour'
            """),
            {"org_id": str(org_id)},
        )
        avg_pf = avg_pf_row.scalar()

        total_kwh_row = await self.db.execute(
            text("""
                SELECT SUM(value) / 3600.0 FROM sensor_readings
                WHERE org_id = :org_id AND vertical = 'energia'
                  AND variable = 'power_kw'
                  AND time > NOW() - INTERVAL '24 hours'
            """),
            {"org_id": str(org_id)},
        )
        total_kwh = total_kwh_row.scalar()

        alerts_week = await self._count_alerts(org_id, days=7)

        return {
            "active_devices": sum(1 for d in devices if d.status == "online"),
            "offline_devices": sum(1 for d in devices if d.status == "offline"),
            "total_devices": len(devices),
            "avg_power_factor": round(avg_pf, 3) if avg_pf else None,
            "total_kwh_24h": round(total_kwh, 2) if total_kwh else None,
            "alerts_this_week": alerts_week,
        }
