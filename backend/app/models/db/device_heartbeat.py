from datetime import datetime
from uuid import UUID

from sqlalchemy import SmallInteger
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class DeviceHeartbeat(Base):
    __tablename__ = "device_heartbeats"

    time: Mapped[datetime] = mapped_column(primary_key=True)
    device_id: Mapped[UUID] = mapped_column(primary_key=True)
    battery: Mapped[int] = mapped_column(SmallInteger, nullable=True)
    rssi: Mapped[int] = mapped_column(SmallInteger, nullable=True)
