import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.config import settings
from app.websocket.router import ws_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.mqtt.client import start_mqtt_subscriber
    from app.workers.demo_simulator import demo_simulator
    from app.workers.offline_checker import check_offline_devices
    from app.workers.notification_worker import notification_worker

    logger.info("Iniciando servicios de background...")

    mqtt_task = asyncio.create_task(start_mqtt_subscriber())
    notif_task = asyncio.create_task(notification_worker())
    offline_task = asyncio.create_task(check_offline_devices())
    simulator_task = asyncio.create_task(demo_simulator(interval_seconds=30))

    logger.info("Servicios iniciados (simulador demo activo).")
    yield

    logger.info("Apagando servicios...")
    for task in (mqtt_task, notif_task, offline_task, simulator_task):
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass


app = FastAPI(
    title="Ruwi IoT Platform API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")
app.include_router(ws_router)


@app.get("/health")
async def health():
    from sqlalchemy import text

    from app.cache import redis
    from app.database import AsyncSessionLocal

    db_ok = False
    redis_ok = False

    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        pass

    try:
        await redis.ping()
        redis_ok = True
    except Exception:
        pass

    return {
        "status": "ok" if (db_ok and redis_ok) else "degraded",
        "database": "ok" if db_ok else "error",
        "redis": "ok" if redis_ok else "error",
        "version": "1.0.0",
    }
