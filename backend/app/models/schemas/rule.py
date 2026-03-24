from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class RuleCreate(BaseModel):
    device_id: UUID | None = None
    name: str
    variable: str
    operator: Literal["<", ">", "between"]
    threshold_low: float | None = None
    threshold_high: float | None = None
    severity: Literal["info", "warning", "critical"] = "warning"
    notify_whatsapp: bool = True
    notify_email: bool = False
    notify_webhook: bool = False
    webhook_url: str | None = None
    cooldown_min: int = 30


class RuleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    device_id: UUID | None = None
    name: str
    variable: str
    operator: str
    threshold_low: float | None = None
    threshold_high: float | None = None
    severity: str
    notify_whatsapp: bool
    notify_email: bool
    cooldown_min: int
    active: bool
    created_at: datetime
