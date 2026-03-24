from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class AlertResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    time: datetime
    device_id: UUID
    org_id: UUID
    rule_id: UUID | None = None
    severity: str
    variable: str
    value: float | None = None
    threshold: float | None = None
    message: str | None = None
    acknowledged: bool
    acknowledged_by: str | None = None
    acknowledged_at: datetime | None = None
    # Enriquecido via JOIN con devices
    device_name: str | None = None
    vertical: str | None = None


class AcknowledgeRequest(BaseModel):
    acknowledged_by: str
