from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DECIMAL, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Device(Base):
    __tablename__ = "devices"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    org_id: Mapped[UUID] = mapped_column(ForeignKey("organizations.id"))
    name: Mapped[str] = mapped_column(String(100))
    type: Mapped[str] = mapped_column(String(50))
    vertical: Mapped[str] = mapped_column(String(20))
    status: Mapped[str] = mapped_column(String(20), default="offline")
    lat: Mapped[float] = mapped_column(DECIMAL(10, 8), nullable=True)
    lng: Mapped[float] = mapped_column(DECIMAL(11, 8), nullable=True)
    location_name: Mapped[str] = mapped_column(String(100), nullable=True)
    altitude_msnm: Mapped[int] = mapped_column(nullable=True)
    crop_type: Mapped[str] = mapped_column(String(50), nullable=True)
    api_key: Mapped[str] = mapped_column(String(64), unique=True)
    last_seen: Mapped[datetime] = mapped_column(nullable=True)
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)
    active: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
