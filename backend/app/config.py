from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Base de datos
    DATABASE_URL: str = "postgresql+asyncpg://ruwi:pass@timescaledb/ruwi_iot"

    # Redis
    REDIS_URL: str = "redis://:pass@redis:6379/0"

    # JWT
    JWT_SECRET_KEY: str = "change_me_in_production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_HOURS: int = 24

    # MQTT
    MQTT_HOST: str = "emqx"
    MQTT_PORT: int = 1883
    MQTT_USER: str = "backend"
    MQTT_PASSWORD: str = "mqtt_backend_pass"

    # Notificaciones
    TWILIO_SID: str = ""
    TWILIO_TOKEN: str = ""
    TWILIO_WHATSAPP_FROM: str = "whatsapp:+14155238886"
    RESEND_API_KEY: str = ""

    # App
    ENVIRONMENT: str = "production"
    DEBUG: bool = False
    FRONTEND_URL: str = "http://localhost:3000"

    model_config = {"env_file": ".env"}


settings = Settings()
