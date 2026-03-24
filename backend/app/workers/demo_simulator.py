"""
Simulador de dispositivos demo — Ruwi IoT Platform.
Genera telemetría realista cada 30s para los 2 dispositivos demo
usando random walk alrededor de valores base.
"""
import asyncio
import logging
import random

from app.mqtt.topics import ParsedTopic

logger = logging.getLogger(__name__)

DEMO_ORG_ID = "00000000-0000-0000-0000-000000000001"

DEMO_DEVICES = [
    {
        "device_id": "00000000-0000-0000-0000-000000000100",
        "vertical": "agro",
        "base": {
            "soil_moisture": 45.0,
            "temperature": 18.0,
            "humidity": 68.0,
            "battery": 85.0,
        },
        "noise": {
            "soil_moisture": 3.0,
            "temperature": 1.5,
            "humidity": 4.0,
            "battery": 0.05,
        },
        "limits": {
            "soil_moisture": (20.0, 90.0),
            "temperature": (5.0, 30.0),
            "humidity": (30.0, 95.0),
            "battery": (10.0, 100.0),
        },
    },
    {
        "device_id": "00000000-0000-0000-0000-000000000200",
        "vertical": "energia",
        "base": {
            "voltage": 220.0,
            "current": 13.5,
            "power_kw": 2.97,
            "power_factor": 0.92,
        },
        "noise": {
            "voltage": 1.5,
            "current": 1.0,
            "power_kw": 0.2,
            "power_factor": 0.015,
        },
        "limits": {
            "voltage": (200.0, 240.0),
            "current": (0.0, 50.0),
            "power_kw": (0.0, 20.0),
            "power_factor": (0.70, 1.00),
        },
    },
]

# Estado persistente para random walk
_state: dict[str, dict[str, float]] = {
    d["device_id"]: dict(d["base"]) for d in DEMO_DEVICES
}


def _next_value(device_id: str, variable: str, base: float, noise: float, limits: tuple) -> float:
    current = _state[device_id].get(variable, base)
    # Random walk con tendencia de retorno al valor base
    drift = (random.random() - 0.5) * noise
    revert = (base - current) * 0.05  # suave retorno al base
    new_val = current + drift + revert
    lo, hi = limits
    new_val = max(lo, min(hi, new_val))
    _state[device_id][variable] = new_val
    return round(new_val, 2)


async def _simulate_once():
    from app.mqtt.handlers import process_telemetry

    for device in DEMO_DEVICES:
        variables = {
            var: _next_value(
                device["device_id"],
                var,
                device["base"][var],
                device["noise"][var],
                device["limits"][var],
            )
            for var in device["base"]
        }
        parsed = ParsedTopic(
            vertical=device["vertical"],
            org_id=DEMO_ORG_ID,
            device_id=device["device_id"],
            type="telemetry",
        )
        try:
            await process_telemetry(parsed, variables)
            logger.debug("Simulated %s: %s", device["device_id"][:8], variables)
        except Exception as exc:
            logger.warning("Simulator error for device %s: %s", device["device_id"][:8], exc)


async def demo_simulator(interval_seconds: int = 30):
    """Corre indefinidamente generando telemetría para los dispositivos demo."""
    logger.info("Demo simulator iniciado (intervalo=%ds)", interval_seconds)
    # Esperar a que la DB y Redis estén listas
    await asyncio.sleep(8)
    while True:
        try:
            await _simulate_once()
        except Exception as exc:
            logger.error("Error en loop del simulador: %s", exc)
        await asyncio.sleep(interval_seconds)
