from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class TelemetryPoint(BaseModel):
    time: datetime
    value: float


class TelemetryResponse(BaseModel):
    device_id: UUID
    variable: str
    unit: str | None = None
    range: str
    data: list[TelemetryPoint]


class LatestReading(BaseModel):
    variable: str
    value: float
    unit: str | None = None
    time: datetime


class IngestPayload(BaseModel):
    device_id: str
    timestamp: str | None = None
    variables: dict[str, float]
    metadata: dict = {}
