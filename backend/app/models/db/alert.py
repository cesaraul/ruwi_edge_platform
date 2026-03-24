from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Alert(Base):
    __tablename__ = "alerts_log"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    time: Mapped[datetime] = mapped_column(primary_key=True, default=datetime.utcnow)
    device_id: Mapped[UUID]
    org_id: Mapped[UUID]
    rule_id: Mapped[UUID] = mapped_column(nullable=True)
    severity: Mapped[str] = mapped_column(String(10))
    variable: Mapped[str] = mapped_column(String(50))
    value: Mapped[float] = mapped_column(nullable=True)
    threshold: Mapped[float] = mapped_column(nullable=True)
    message: Mapped[str] = mapped_column(nullable=True)
    acknowledged: Mapped[bool] = mapped_column(default=False)
    acknowledged_by: Mapped[str] = mapped_column(String(100), nullable=True)
    acknowledged_at: Mapped[datetime] = mapped_column(nullable=True)
