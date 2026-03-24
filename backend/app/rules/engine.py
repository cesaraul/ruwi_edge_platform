import json
import logging
from datetime import datetime
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.db.alert import Alert
from app.models.db.device import Device
from app.models.db.rule import Rule

logger = logging.getLogger(__name__)


class RuleEngine:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def evaluate(
        self,
        device_id: UUID,
        org_id: UUID,
        variables: dict[str, float],
    ) -> list[Alert]:
        device = await self.db.get(Device, device_id)
        if not device:
            return []

        result = await self.db.execute(
            select(Rule).where(
                Rule.org_id == org_id,
                Rule.active == True,
                (Rule.device_id == device_id) | (Rule.device_id == None),
            )
        )
        rules = result.scalars().all()

        # Cargar umbrales verticales como reglas implícitas si no hay reglas manuales
        if not rules:
            rules = self._get_vertical_rules(device)

        alerts = []
        from app.cache import redis

        for rule in rules:
            value = variables.get(rule.variable)
            if value is None:
                continue

            severity = self._check(value, rule)
            if not severity:
                continue

            cooldown_key = f"alert_cooldown:{rule.id}:{device_id}"
            if await redis.exists(cooldown_key):
                continue

            alert = Alert(
                time=datetime.utcnow(),
                device_id=device_id,
                org_id=org_id,
                rule_id=rule.id if hasattr(rule, "id") else None,
                severity=severity,
                variable=rule.variable,
                value=value,
                threshold=rule.threshold_high or rule.threshold_low,
                message=self._build_message(device, rule, value, severity),
            )
            self.db.add(alert)
            await self.db.commit()
            await self.db.refresh(alert)

            await redis.setex(cooldown_key, rule.cooldown_min * 60, "1")

            # Encolar notificación
            await redis.lpush("notifications", json.dumps({
                "type": "alert",
                "alert_id": str(alert.id),
                "device_id": str(device_id),
                "org_id": str(org_id),
                "severity": severity,
                "variable": rule.variable,
                "value": value,
                "message": alert.message,
                "notify_whatsapp": rule.notify_whatsapp,
                "notify_email": rule.notify_email,
            }))

            alerts.append(alert)

        return alerts

    def _check(self, value: float, rule) -> str | None:
        if rule.operator == "<":
            if rule.threshold_low is not None and value < rule.threshold_low:
                return rule.severity
        elif rule.operator == ">":
            if rule.threshold_high is not None and value > rule.threshold_high:
                return rule.severity
        elif rule.operator == "between":
            if rule.threshold_low is not None and value < rule.threshold_low:
                return rule.severity
            if rule.threshold_high is not None and value > rule.threshold_high:
                return rule.severity
        return None

    def _build_message(self, device: Device, rule, value: float, severity: str) -> str:
        direction = "bajo" if rule.threshold_low and value < rule.threshold_low else "alto"
        threshold = rule.threshold_low if direction == "bajo" else rule.threshold_high
        return (
            f"[{severity.upper()}] {rule.name}: {rule.variable} = {value} "
            f"(umbral {direction}: {threshold}) — {device.name}"
        )

    def _get_vertical_rules(self, device: Device) -> list:
        from types import SimpleNamespace

        if device.vertical == "agro":
            from app.rules.agro_rules import get_thresholds_for_crop
            thresholds = get_thresholds_for_crop(device.crop_type)
        else:
            from app.rules.energia_rules import get_thresholds_for_equipment
            thresholds = get_thresholds_for_equipment(device.type)

        rules = []
        for variable, limits in thresholds.items():
            if variable == "frost_risk_temp":
                continue
            for limit_type, limit_value in limits.items():
                if "low" in limit_type:
                    severity = "critical" if "critical" in limit_type else "warning"
                    rules.append(SimpleNamespace(
                        id=None, variable=variable, operator="<",
                        threshold_low=limit_value, threshold_high=None,
                        severity=severity, cooldown_min=30,
                        notify_whatsapp=True, notify_email=False,
                        name=f"Auto: {variable} bajo",
                    ))
                elif "high" in limit_type:
                    severity = "critical" if "critical" in limit_type else "warning"
                    rules.append(SimpleNamespace(
                        id=None, variable=variable, operator=">",
                        threshold_low=None, threshold_high=limit_value,
                        severity=severity, cooldown_min=30,
                        notify_whatsapp=True, notify_email=False,
                        name=f"Auto: {variable} alto",
                    ))
        return rules
