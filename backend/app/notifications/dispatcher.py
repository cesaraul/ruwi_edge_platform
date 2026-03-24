import asyncio
import logging
from uuid import UUID

from sqlalchemy.future import select

from app.models.db.device import Device
from app.models.db.rule import Rule
from app.models.db.user import User
from app.notifications.email import send_email
from app.notifications.webhook import send_webhook
from app.notifications.whatsapp import send_whatsapp

logger = logging.getLogger(__name__)


async def dispatch_alert(
    alert,
    device: Device,
    rule: Rule | None,
    db,
):
    """Despacha notificaciones para una alerta — corre en background para no bloquear el pipeline."""
    result = await db.execute(
        select(User).where(
            User.org_id == device.org_id,
            User.active == True,
            User.role == "admin",
        )
    )
    users = result.scalars().all()

    tasks = []

    notify_whatsapp = rule.notify_whatsapp if rule else True
    notify_email = rule.notify_email if rule else False
    notify_webhook = rule.notify_webhook if rule else False
    webhook_url = rule.webhook_url if rule else None

    for user in users:
        if notify_whatsapp and user.notify_whatsapp and user.phone_whatsapp:
            message = _format_message(alert, device)
            tasks.append(send_whatsapp(user.phone_whatsapp, message))

        if notify_email and user.notify_email and user.email:
            message = _format_message(alert, device)
            severity = alert.severity.upper()
            tasks.append(send_email(
                user.email,
                f"[{severity}] Alerta IoT — {alert.variable} en {device.name}",
                message,
            ))

    if notify_webhook and webhook_url:
        tasks.append(send_webhook(webhook_url, {
            "alert_id": str(alert.id),
            "device_id": str(device.id),
            "device_name": device.name,
            "severity": alert.severity,
            "variable": alert.variable,
            "value": alert.value,
            "threshold": alert.threshold,
            "message": alert.message,
            "time": alert.time.isoformat(),
        }))

    if tasks:
        await asyncio.gather(*tasks, return_exceptions=True)


def _format_message(alert, device: Device) -> str:
    icon = {"critical": "🔴", "warning": "⚠️", "info": "ℹ️"}.get(alert.severity, "📡")
    vertical_icon = "🌱" if device.vertical == "agro" else "⚡"

    return (
        f"{icon} *ALERTA {alert.severity.upper()}* — {device.name}\n"
        f"{vertical_icon} {alert.variable}: {alert.value}\n"
        f"📍 {device.location_name or 'Sin ubicación'}\n"
        f"🕐 {alert.time.strftime('%H:%M')}\n\n"
        f"{alert.message}"
    )
