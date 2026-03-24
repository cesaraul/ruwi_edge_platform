import logging

from app.config import settings

logger = logging.getLogger(__name__)


async def send_whatsapp(phone: str, message: str):
    if not settings.TWILIO_SID or not settings.TWILIO_TOKEN:
        logger.warning("Twilio no configurado. Mensaje no enviado a %s", phone)
        return

    try:
        from twilio.rest import Client

        client = Client(settings.TWILIO_SID, settings.TWILIO_TOKEN)
        client.messages.create(
            from_=settings.TWILIO_WHATSAPP_FROM,
            to=f"whatsapp:{phone}",
            body=message,
        )
        logger.info("WhatsApp enviado a %s", phone)
    except Exception as e:
        logger.error("Error enviando WhatsApp a %s: %s", phone, e)
