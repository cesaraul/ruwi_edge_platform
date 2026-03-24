from datetime import datetime
from uuid import UUID

from sqlalchemy import SmallInteger, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class SensorReading(Base):
    __tablename__ = "sensor_readings"

    time: Mapped[datetime] = mapped_column(primary_key=True)
    device_id: Mapped[UUID] = mapped_column(primary_key=True)
    org_id: Mapped[UUID]
    vertical: Mapped[str] = mapped_column(String(20))
    variable: Mapped[str] = mapped_column(String(50))
    value: Mapped[float]
    unit: Mapped[str] = mapped_column(String(20), nullable=True)
    quality: Mapped[int] = mapped_column(SmallInteger, default=100)
