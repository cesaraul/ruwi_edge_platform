import asyncio
import json
import logging

from app.cache import redis

logger = logging.getLogger(__name__)


async def notification_worker():
    logger.info("Worker de notificaciones iniciado.")
    while True:
        try:
            item = await redis.brpop("notifications", timeout=5)
            if not item:
                continue

            _, raw = item
            notification = json.loads(raw)

            await _dispatch(notification)

        except asyncio.CancelledError:
            logger.info("Worker de notificaciones detenido.")
            break
        except Exception as e:
            logger.error("Error en notification_worker: %s", e)
            await asyncio.sleep(1)


async def _dispatch(notification: dict):
    if notification.get("type") != "alert":
        return

    message = notification.get("message", "Alerta IoT")
    org_id = notification.get("org_id")

    if not org_id:
        return

    from app.database import get_db_context
    from app.models.db.user import User
    from sqlalchemy.future import select
    from uuid import UUID

    async with get_db_context() as db:
        result = await db.execute(
            select(User).where(
                User.org_id == UUID(org_id),
                User.active == True,
                User.role == "admin",
            )
        )
        users = result.scalars().all()

    for user in users:
        if notification.get("notify_whatsapp") and user.notify_whatsapp and user.phone_whatsapp:
            from app.notifications.whatsapp import send_whatsapp
            await send_whatsapp(user.phone_whatsapp, message)

        if notification.get("notify_email") and user.notify_email and user.email:
            from app.notifications.email import send_email
            severity = notification.get("severity", "alerta").upper()
            await send_email(
                user.email,
                f"[{severity}] Alerta IoT — {notification.get('variable', '')}",
                message,
            )
