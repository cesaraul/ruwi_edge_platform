from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Rule(Base):
    __tablename__ = "rules"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    org_id: Mapped[UUID] = mapped_column(ForeignKey("organizations.id"))
    device_id: Mapped[UUID] = mapped_column(ForeignKey("devices.id"), nullable=True)
    name: Mapped[str] = mapped_column(String(100))
    variable: Mapped[str] = mapped_column(String(50))
    operator: Mapped[str] = mapped_column(String(10))
    threshold_low: Mapped[float] = mapped_column(nullable=True)
    threshold_high: Mapped[float] = mapped_column(nullable=True)
    severity: Mapped[str] = mapped_column(String(10), default="warning")
    notify_whatsapp: Mapped[bool] = mapped_column(default=True)
    notify_email: Mapped[bool] = mapped_column(default=False)
    notify_webhook: Mapped[bool] = mapped_column(default=False)
    webhook_url: Mapped[str] = mapped_column(nullable=True)
    cooldown_min: Mapped[int] = mapped_column(default=30)
    active: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
