from uuid import UUID

from sqlalchemy import text
from sqlalchemy.future import select

from app.analytics.base import AnalyticsBase
from app.models.db.device import Device


class AgroKPIs(AnalyticsBase):
    async def calculate(self, org_id: UUID) -> dict:
        result = await self.db.execute(
            select(Device).where(Device.org_id == org_id, Device.vertical == "agro", Device.active == True)
        )
        devices = result.scalars().all()

        avg_moisture_row = await self.db.execute(
            text("""
                SELECT AVG(value) FROM sensor_readings
                WHERE org_id = :org_id AND vertical = 'agro'
                  AND variable = 'soil_moisture'
                  AND time > NOW() - INTERVAL '1 hour'
            """),
            {"org_id": str(org_id)},
        )
        avg_moisture = avg_moisture_row.scalar()

        alerts_week = await self._count_alerts(org_id, days=7)

        frost_risk = await self._frost_risk_count(devices)

        return {
            "active_devices": sum(1 for d in devices if d.status == "online"),
            "offline_devices": sum(1 for d in devices if d.status == "offline"),
            "total_devices": len(devices),
            "avg_soil_moisture": round(avg_moisture, 1) if avg_moisture else None,
            "frost_risk_devices": frost_risk,
            "alerts_this_week": alerts_week,
        }

    async def _frost_risk_count(self, devices: list[Device]) -> int:
        count = 0
        for device in devices:
            if device.status != "online":
                continue
            row = await self.db.execute(
                text("""
                    SELECT value FROM sensor_readings
                    WHERE device_id = :device_id AND variable = 'temperature'
                    ORDER BY time DESC LIMIT 1
                """),
                {"device_id": str(device.id)},
            )
            temp = row.scalar()
            if temp is not None and temp < 2:
                count += 1
        return count
