import json
import logging
from datetime import datetime
from uuid import UUID

from app.mqtt.topics import ParsedTopic

logger = logging.getLogger(__name__)


async def handle_message(topic: str, raw_payload: str):
    from app.mqtt.topics import parse_topic

    parsed = parse_topic(topic)
    if not parsed:
        return

    try:
        payload = json.loads(raw_payload)
    except (json.JSONDecodeError, ValueError):
        logger.warning("Payload JSON inválido en topic %s", topic)
        return

    if parsed.type == "telemetry":
        variables = payload.get("variables", {})
        timestamp = payload.get("timestamp")
        if variables:
            await process_telemetry(parsed, variables, timestamp)

    elif parsed.type == "status":
        await process_status(parsed, payload)


async def process_telemetry(parsed: ParsedTopic, variables: dict, timestamp: str | None = None):
    from app.cache import redis
    from app.database import get_db_context
    from app.models.db.sensor_reading import SensorReading
    from app.rules.engine import RuleEngine
    from app.websocket.manager import ws_manager

    try:
        ts = datetime.fromisoformat(timestamp) if timestamp else datetime.utcnow()
    except ValueError:
        ts = datetime.utcnow()

    device_id = UUID(parsed.device_id)
    org_id = UUID(parsed.org_id)

    async with get_db_context() as db:
        readings = []
        for variable, value in variables.items():
            if not isinstance(value, (int, float)):
                continue
            readings.append(SensorReading(
                time=ts,
                device_id=device_id,
                org_id=org_id,
                vertical=parsed.vertical,
                variable=variable,
                value=float(value),
            ))

        if readings:
            db.add_all(readings)

        # Actualizar last_seen
        from sqlalchemy import update
        from app.models.db.device import Device
        await db.execute(
            update(Device)
            .where(Device.id == device_id)
            .values(last_seen=datetime.utcnow(), status="online")
        )

        await db.commit()

    # Cache en Redis (último valor por variable)
    for variable, value in variables.items():
        if not isinstance(value, (int, float)):
            continue
        key = f"last:{device_id}:{variable}"
        await redis.setex(key, 300, json.dumps({
            "variable": variable,
            "value": float(value),
            "time": ts.isoformat(),
        }))

    # Marcar dispositivo online en Redis
    await redis.setex(f"device_online:{device_id}", 120, "1")

    # Evaluar reglas y generar alertas
    async with get_db_context() as db:
        engine = RuleEngine(db)
        alerts = await engine.evaluate(device_id, org_id, variables)

    # Broadcast por WebSocket
    await ws_manager.broadcast_to_org(str(org_id), {
        "type": "reading",
        "device_id": str(device_id),
        "variables": variables,
        "timestamp": ts.isoformat(),
    })

    if alerts:
        for alert in alerts:
            await ws_manager.broadcast_to_org(str(org_id), {
                "type": "alert",
                "data": {
                    "id": str(alert.id),
                    "device_id": str(alert.device_id),
                    "severity": alert.severity,
                    "variable": alert.variable,
                    "value": alert.value,
                    "message": alert.message,
                    "time": alert.time.isoformat(),
                },
            })


async def process_status(parsed: ParsedTopic, payload: dict):
    from app.cache import redis

    device_id = parsed.device_id
    battery = payload.get("battery")
    rssi = payload.get("rssi")

    await redis.setex(f"device_online:{device_id}", 120, "1")

    if battery is not None or rssi is not None:
        from app.database import get_db_context
        from app.models.db.device_heartbeat import DeviceHeartbeat
        from datetime import datetime

        async with get_db_context() as db:
            hb = DeviceHeartbeat(
                time=datetime.utcnow(),
                device_id=UUID(device_id),
                battery=battery,
                rssi=rssi,
            )
            db.add(hb)
            await db.commit()
