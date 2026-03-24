import secrets
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.dependencies import get_current_user, require_role
from app.database import get_db
from app.models.db.device import Device
from app.models.db.user import User
from app.models.schemas.device import DeviceCreate, DeviceResponse, DeviceUpdate
from app.models.schemas.telemetry import IngestPayload

router = APIRouter(prefix="/devices", tags=["devices"])


def _to_response(device: Device) -> DeviceResponse:
    return DeviceResponse.model_validate(device)


@router.get("", response_model=list[DeviceResponse])
async def list_devices(
    vertical: str | None = None,
    status: str | None = None,
    search: str | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(Device).where(Device.org_id == current_user.org_id, Device.active == True)
    if vertical:
        q = q.where(Device.vertical == vertical)
    if status:
        q = q.where(Device.status == status)
    if search:
        q = q.where(Device.name.ilike(f"%{search}%"))
    result = await db.execute(q)
    return [_to_response(d) for d in result.scalars().all()]


@router.post("", response_model=DeviceResponse, status_code=201)
async def create_device(
    body: DeviceCreate,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    device = Device(
        org_id=current_user.org_id,
        name=body.name,
        type=body.type,
        vertical=body.vertical,
        lat=body.lat,
        lng=body.lng,
        location_name=body.location_name,
        altitude_msnm=body.altitude_msnm,
        crop_type=body.crop_type,
        api_key=secrets.token_hex(32),
        metadata_=body.metadata,
    )
    db.add(device)
    await db.commit()
    await db.refresh(device)
    return _to_response(device)


@router.get("/{device_id}", response_model=DeviceResponse)
async def get_device(
    device_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    device = await _get_owned_device(device_id, current_user.org_id, db)
    return _to_response(device)


@router.put("/{device_id}", response_model=DeviceResponse)
async def update_device(
    device_id: UUID,
    body: DeviceUpdate,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    device = await _get_owned_device(device_id, current_user.org_id, db)
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(device, field, value)
    await db.commit()
    await db.refresh(device)
    return _to_response(device)


@router.delete("/{device_id}", status_code=204)
async def delete_device(
    device_id: UUID,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    device = await _get_owned_device(device_id, current_user.org_id, db)
    device.active = False
    await db.commit()


@router.get("/{device_id}/variables")
async def get_device_variables(
    device_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_owned_device(device_id, current_user.org_id, db)

    from app.cache import redis

    import json
    pattern = f"last:{device_id}:*"
    keys = await redis.keys(pattern)
    variables = []
    for key in keys:
        raw = await redis.get(key)
        if raw:
            variables.append(json.loads(raw))
    return variables


@router.post("/ingest", status_code=202)
async def ingest_http(
    body: IngestPayload,
    x_api_key: str = Header(...),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Device).where(Device.api_key == x_api_key, Device.active == True))
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="API Key inválida")

    from app.mqtt.handlers import process_telemetry
    from app.mqtt.topics import ParsedTopic

    parsed = ParsedTopic(
        vertical=device.vertical,
        org_id=str(device.org_id),
        device_id=str(device.id),
        type="telemetry",
    )
    await process_telemetry(parsed, body.variables, body.timestamp)
    return {"status": "accepted"}


async def _get_owned_device(device_id: UUID, org_id: UUID, db: AsyncSession) -> Device:
    device = await db.get(Device, device_id)
    if not device or device.org_id != org_id:
        raise HTTPException(status_code=404, detail="Dispositivo no encontrado")
    return device
