import asyncio
import logging

from app.cache import redis
from app.websocket.manager import ws_manager

logger = logging.getLogger(__name__)


async def check_offline_devices():
    logger.info("Worker de offline checker iniciado.")
    while True:
        try:
            await asyncio.sleep(60)
            await _run_check()
        except asyncio.CancelledError:
            logger.info("Offline checker detenido.")
            break
        except Exception as e:
            logger.error("Error en offline_checker: %s", e)


async def _run_check():
    from app.database import get_db_context
    from app.models.db.device import Device
    from sqlalchemy import update
    from sqlalchemy.future import select

    async with get_db_context() as db:
        result = await db.execute(
            select(Device).where(Device.active == True, Device.status != "offline")
        )
        devices = result.scalars().all()

        for device in devices:
            key = f"device_online:{device.id}"
            is_online = await redis.exists(key)

            if not is_online:
                await db.execute(
                    update(Device).where(Device.id == device.id).values(status="offline")
                )
                await ws_manager.broadcast_to_org(str(device.org_id), {
                    "type": "device_status",
                    "device_id": str(device.id),
                    "status": "offline",
                })

        await db.commit()
