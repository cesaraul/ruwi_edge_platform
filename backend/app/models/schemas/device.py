from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class VariableSummary(BaseModel):
    variable: str
    value: float
    unit: str | None = None
    time: datetime


class DeviceCreate(BaseModel):
    name: str
    type: str
    vertical: Literal["agro", "energia"]
    lat: float | None = None
    lng: float | None = None
    location_name: str | None = None
    altitude_msnm: int | None = None
    crop_type: str | None = None
    metadata: dict = {}


class DeviceUpdate(BaseModel):
    name: str | None = None
    location_name: str | None = None
    lat: float | None = None
    lng: float | None = None
    altitude_msnm: int | None = None
    crop_type: str | None = None
    active: bool | None = None


class DeviceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    name: str
    type: str
    vertical: str
    status: str
    lat: float | None = None
    lng: float | None = None
    location_name: str | None = None
    altitude_msnm: int | None = None
    crop_type: str | None = None
    api_key: str
    last_seen: datetime | None = None
    active: bool
    created_at: datetime
    variables: list[VariableSummary] = []
