from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(String(100))
    vertical: Mapped[str] = mapped_column(String(20), nullable=True)
    plan: Mapped[str] = mapped_column(String(20), default="starter")
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
