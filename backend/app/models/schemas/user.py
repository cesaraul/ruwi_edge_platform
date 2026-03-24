from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    role: str = "viewer"
    phone_whatsapp: str | None = None


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    email: str
    role: str
    phone_whatsapp: str | None = None
    notify_whatsapp: bool
    notify_email: bool
    active: bool
    created_at: datetime


class UserUpdate(BaseModel):
    role: str | None = None
    phone_whatsapp: str | None = None
    notify_whatsapp: bool | None = None
    notify_email: bool | None = None
    active: bool | None = None
