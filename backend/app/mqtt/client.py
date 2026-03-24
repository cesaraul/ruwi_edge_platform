import asyncio
import logging

import aiomqtt

from app.config import settings
from app.mqtt.handlers import handle_message

logger = logging.getLogger(__name__)

RECONNECT_DELAY = 5


async def start_mqtt_subscriber():
    while True:
        try:
            logger.info("Conectando a EMQX en %s:%d...", settings.MQTT_HOST, settings.MQTT_PORT)
            async with aiomqtt.Client(
                hostname=settings.MQTT_HOST,
                port=settings.MQTT_PORT,
                username=settings.MQTT_USER,
                password=settings.MQTT_PASSWORD,
            ) as client:
                await client.subscribe("/#")
                logger.info("MQTT subscriber conectado y suscrito.")

                async for message in client.messages:
                    asyncio.create_task(
                        handle_message(str(message.topic), message.payload.decode())
                    )

        except aiomqtt.MqttError as e:
            logger.error("Error MQTT: %s — reconectando en %ds", e, RECONNECT_DELAY)
            await asyncio.sleep(RECONNECT_DELAY)
        except asyncio.CancelledError:
            logger.info("MQTT subscriber detenido.")
            break
        except Exception as e:
            logger.error("Error inesperado en MQTT: %s", e)
            await asyncio.sleep(RECONNECT_DELAY)
