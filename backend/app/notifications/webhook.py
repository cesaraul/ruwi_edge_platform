import logging

import httpx

logger = logging.getLogger(__name__)


async def send_webhook(url: str, payload: dict):
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
            logger.info("Webhook enviado a %s — status %d", url, resp.status_code)
    except Exception as e:
        logger.error("Error enviando webhook a %s: %s", url, e)
