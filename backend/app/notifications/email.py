import logging

from app.config import settings

logger = logging.getLogger(__name__)


async def send_email(to: str, subject: str, body: str):
    if not settings.RESEND_API_KEY:
        logger.warning("Resend no configurado. Email no enviado a %s", to)
        return

    try:
        import resend

        resend.api_key = settings.RESEND_API_KEY
        resend.Emails.send({
            "from": "alertas@ruwiiot.com",
            "to": to,
            "subject": subject,
            "text": body,
        })
        logger.info("Email enviado a %s", to)
    except Exception as e:
        logger.error("Error enviando email a %s: %s", to, e)
