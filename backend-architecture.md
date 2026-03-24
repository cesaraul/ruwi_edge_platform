# Arquitectura Backend — Plataforma IoT Ruwi Lab
> Diseño detallado del core: API, WebSocket, MQTT, reglas, analytics y modelos de datos
> Versión: 1.0 | Marzo 2026 | Complementa: `stack-iot-mvp.md`, `frontend-architecture.md`

---

## Tabla de Contenidos

1. [Visión General](#1-visión-general)
2. [Estructura del Proyecto](#2-estructura-del-proyecto)
3. [Modelos de Datos (Pydantic + ORM)](#3-modelos-de-datos-pydantic--orm)
4. [API REST — Endpoints](#4-api-rest--endpoints)
5. [Autenticación y Multi-tenancy](#5-autenticación-y-multi-tenancy)
6. [MQTT Subscriber](#6-mqtt-subscriber)
7. [Pipeline de Ingesta](#7-pipeline-de-ingesta)
8. [WebSocket — Tiempo Real](#8-websocket--tiempo-real)
9. [Motor de Reglas](#9-motor-de-reglas)
10. [Analytics por Vertical](#10-analytics-por-vertical)
11. [Sistema de Notificaciones](#11-sistema-de-notificaciones)
12. [Configuración y Variables de Entorno](#12-configuración-y-variables-de-entorno)
13. [Dockerfile](#13-dockerfile)
14. [Mapeo Frontend → Backend](#14-mapeo-frontend--backend)

---

## 1. Visión General

### Rol del backend en la arquitectura global

```
Dispositivos → EMQX Broker → [MQTT Subscriber]
                                      │
                  REST API ←──── FastAPI Core ──→ TimescaleDB
                  WebSocket ←──────── │ ──────→ Redis
                                      │
                              Motor de Reglas
                                      │
                              WhatsApp / Email
```

El backend es un **monolito modular**: un solo proceso FastAPI que agrupa cuatro responsabilidades:

| Responsabilidad | Descripción |
|-----------------|-------------|
| **REST API** | CRUD de dispositivos, consulta de telemetría, gestión de alertas y reglas |
| **MQTT Subscriber** | Consume mensajes del broker EMQX en tiempo real |
| **WebSocket Server** | Empuja datos en vivo al frontend |
| **Worker asíncrono** | Evalúa reglas y dispara notificaciones |

### Por qué un monolito para el MVP

- Un solo proceso = un solo `docker-compose up`
- Sin overhead de red entre servicios internos
- Debug local simple
- Escala vertical hasta ~500 dispositivos con un CX31 de Hetzner
- Se puede extraer en microservicios cuando la carga lo justifique (Fase 3)

---

## 2. Estructura del Proyecto

```
backend/
├── app/
│   ├── main.py                    # Entry point: instancia FastAPI, registra routers,
│   │                              # arranca MQTT subscriber al inicio
│   ├── config.py                  # Settings via pydantic-settings (lee .env)
│   ├── database.py                # Engine SQLAlchemy async + get_db dependency
│   ├── cache.py                   # Conexión Redis async (aioredis)
│   │
│   ├── api/
│   │   └── v1/
│   │       ├── router.py          # Agrupa todos los sub-routers con prefijo /api/v1
│   │       ├── auth.py            # POST /login, POST /refresh
│   │       ├── devices.py         # CRUD /devices
│   │       ├── telemetry.py       # GET /telemetry (series de tiempo)
│   │       ├── alerts.py          # GET/PATCH /alerts
│   │       ├── rules.py           # CRUD /rules
│   │       ├── organizations.py   # CRUD /organizations (admin)
│   │       ├── users.py           # CRUD /users
│   │       └── analytics.py       # GET /analytics/kpis, /analytics/predictions
│   │
│   ├── mqtt/
│   │   ├── client.py              # Conexión asyncio-mqtt al broker EMQX
│   │   ├── handlers.py            # Enruta mensajes por topic a su handler
│   │   └── topics.py              # Constantes y parsers de topics
│   │
│   ├── websocket/
│   │   ├── manager.py             # ConnectionManager: conectar, desconectar, broadcast
│   │   └── router.py              # GET /ws/{org_id} (WebSocket endpoint)
│   │
│   ├── rules/
│   │   ├── engine.py              # RuleEngine: evalúa lecturas contra reglas activas
│   │   ├── agro_rules.py          # Umbrales por cultivo y altitud
│   │   └── energia_rules.py       # Umbrales por tipo de equipo eléctrico
│   │
│   ├── analytics/
│   │   ├── base.py                # Clase base con helpers de consulta TimescaleDB
│   │   ├── agro/
│   │   │   ├── kpis.py            # humedad prom., riesgo helada, estrés hídrico
│   │   │   └── predictions.py     # tendencia temperatura, predicción helada
│   │   └── energia/
│   │       ├── kpis.py            # consumo kWh, factor potencia, horas pico
│   │       └── anomaly.py         # Z-score sobre series de tiempo
│   │
│   ├── notifications/
│   │   ├── dispatcher.py          # Decide canal según regla (WhatsApp / email / webhook)
│   │   ├── whatsapp.py            # Cliente Twilio WhatsApp
│   │   ├── email.py               # Cliente Resend
│   │   └── webhook.py             # HTTP POST genérico
│   │
│   ├── models/
│   │   ├── db/                    # Modelos SQLAlchemy (tablas)
│   │   │   ├── device.py
│   │   │   ├── sensor_reading.py
│   │   │   ├── alert.py
│   │   │   ├── rule.py
│   │   │   ├── organization.py
│   │   │   └── user.py
│   │   └── schemas/               # Schemas Pydantic (request/response)
│   │       ├── device.py
│   │       ├── telemetry.py
│   │       ├── alert.py
│   │       ├── rule.py
│   │       └── auth.py
│   │
│   └── core/
│       ├── security.py            # JWT encode/decode, hash de contraseñas
│       └── dependencies.py        # get_current_user, require_role, get_org_id
│
├── alembic/                       # Migraciones de base de datos
│   ├── env.py
│   └── versions/
│       └── 001_initial_schema.py
│
├── tests/
│   ├── test_api/
│   ├── test_rules/
│   └── conftest.py
│
├── Dockerfile
├── requirements.txt
└── .env.example
```

---

## 3. Modelos de Datos (Pydantic + ORM)

### Modelos de base de datos (SQLAlchemy)

```python
# models/db/device.py
from sqlalchemy.orm import Mapped, mapped_column
from geoalchemy2 import Geometry

class Device(Base):
    __tablename__ = "devices"

    id:             Mapped[UUID]    = mapped_column(primary_key=True, default=uuid4)
    org_id:         Mapped[UUID]    = mapped_column(ForeignKey("organizations.id"))
    name:           Mapped[str]     = mapped_column(String(100))
    type:           Mapped[str]     = mapped_column(String(50))
    vertical:       Mapped[str]     = mapped_column(String(20))   # 'agro' | 'energia'
    status:         Mapped[str]     = mapped_column(String(20), default="offline")
    location:       Mapped[Any]     = mapped_column(Geometry("POINT"), nullable=True)
    altitude_msnm:  Mapped[int]     = mapped_column(nullable=True)
    crop_type:      Mapped[str]     = mapped_column(String(50), nullable=True)
    api_key:        Mapped[str]     = mapped_column(String(64), unique=True)
    last_seen:      Mapped[datetime]= mapped_column(nullable=True)
    metadata_:      Mapped[dict]    = mapped_column("metadata", JSONB, default=dict)
    created_at:     Mapped[datetime]= mapped_column(default=datetime.utcnow)

# models/db/sensor_reading.py
# TimescaleDB hypertable — NO usa primary key convencional
class SensorReading(Base):
    __tablename__ = "sensor_readings"

    time:       Mapped[datetime] = mapped_column(primary_key=True)
    device_id:  Mapped[UUID]
    org_id:     Mapped[UUID]
    vertical:   Mapped[str]
    variable:   Mapped[str]      = mapped_column(String(50))
    value:      Mapped[float]
    unit:       Mapped[str]      = mapped_column(String(20), nullable=True)
    quality:    Mapped[int]      = mapped_column(SmallInteger, default=100)

# models/db/alert.py
class Alert(Base):
    __tablename__ = "alerts_log"

    id:             Mapped[UUID]    = mapped_column(primary_key=True, default=uuid4)
    time:           Mapped[datetime]= mapped_column(default=datetime.utcnow)
    device_id:      Mapped[UUID]    = mapped_column(ForeignKey("devices.id"))
    org_id:         Mapped[UUID]
    rule_id:        Mapped[UUID]    = mapped_column(nullable=True)
    severity:       Mapped[str]     = mapped_column(String(10))
    variable:       Mapped[str]     = mapped_column(String(50))
    value:          Mapped[float]
    threshold:      Mapped[float]
    message:        Mapped[str]
    acknowledged:   Mapped[bool]    = mapped_column(default=False)
    acknowledged_by:Mapped[str]     = mapped_column(nullable=True)
    acknowledged_at:Mapped[datetime]= mapped_column(nullable=True)

# models/db/rule.py
class Rule(Base):
    __tablename__ = "rules"

    id:              Mapped[UUID]  = mapped_column(primary_key=True, default=uuid4)
    org_id:          Mapped[UUID]  = mapped_column(ForeignKey("organizations.id"))
    device_id:       Mapped[UUID]  = mapped_column(ForeignKey("devices.id"), nullable=True)
    name:            Mapped[str]   = mapped_column(String(100))
    variable:        Mapped[str]   = mapped_column(String(50))
    operator:        Mapped[str]   = mapped_column(String(10))  # '<' | '>' | 'between'
    threshold_low:   Mapped[float] = mapped_column(nullable=True)
    threshold_high:  Mapped[float] = mapped_column(nullable=True)
    severity:        Mapped[str]   = mapped_column(String(10))
    notify_whatsapp: Mapped[bool]  = mapped_column(default=True)
    notify_email:    Mapped[bool]  = mapped_column(default=False)
    cooldown_min:    Mapped[int]   = mapped_column(default=30)
    active:          Mapped[bool]  = mapped_column(default=True)
```

### Schemas Pydantic (API)

```python
# models/schemas/telemetry.py
class TelemetryPoint(BaseModel):
    time:  datetime
    value: float

class TelemetryResponse(BaseModel):
    device_id: UUID
    variable:  str
    unit:      str
    range:     str
    data:      list[TelemetryPoint]

# models/schemas/device.py
class DeviceCreate(BaseModel):
    name:          str
    type:          str
    vertical:      Literal['agro', 'energia']
    lat:           float
    lng:           float
    altitude_msnm: int | None = None
    crop_type:     str | None = None
    metadata:      dict = {}

class DeviceResponse(BaseModel):
    id:            UUID
    name:          str
    type:          str
    vertical:      str
    status:        str
    location_name: str
    altitude_msnm: int | None
    crop_type:     str | None
    last_seen:     datetime | None
    variables:     list[VariableSummary]  # última lectura de cada variable

    model_config = ConfigDict(from_attributes=True)

# models/schemas/auth.py
class LoginRequest(BaseModel):
    email:    EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token:  str
    token_type:    str = "bearer"
    expires_in:    int

class TokenPayload(BaseModel):
    sub:      str        # user_id
    org_id:   str
    role:     str        # 'admin' | 'viewer' | 'device'
    vertical: str | None
    exp:      int
```

---

## 4. API REST — Endpoints

Todos los endpoints requieren `Authorization: Bearer <token>` salvo `/auth/login`.
El prefijo base es `/api/v1`.

### Auth

```
POST   /auth/login          → { access_token, expires_in }
POST   /auth/refresh        → { access_token }
GET    /auth/me             → { user_id, email, role, org_id }
```

### Devices

```
GET    /devices             → list[DeviceResponse]
       ?vertical=agro|energia
       ?status=online|warning|critical|offline
       ?search=<string>

POST   /devices             → DeviceResponse          [admin]
GET    /devices/{id}        → DeviceResponse
PUT    /devices/{id}        → DeviceResponse          [admin]
DELETE /devices/{id}                                  [admin]
GET    /devices/{id}/variables  → list[VariableSummary]  # último valor de cada variable
POST   /ingest              → 202 Accepted            # fallback HTTP para dispositivos sin MQTT
```

### Telemetry

```
GET    /telemetry/{device_id}
       ?variable=soil_moisture
       ?range=1h|24h|7d|30d
       → TelemetryResponse

GET    /telemetry/{device_id}/latest
       → dict[variable, LatestReading]  # usado por frontend en VariableCards
```

### Alerts

```
GET    /alerts
       ?acknowledged=true|false
       ?severity=critical|warning|info
       ?vertical=agro|energia
       ?device_id=<uuid>
       ?limit=50&offset=0
       → PaginatedResponse[AlertResponse]

GET    /alerts/{id}         → AlertResponse
PATCH  /alerts/{id}/acknowledge  → AlertResponse
DELETE /alerts/{id}              [admin]
```

### Rules

```
GET    /rules               → list[RuleResponse]
POST   /rules               → RuleResponse       [admin]
GET    /rules/{id}          → RuleResponse
PUT    /rules/{id}          → RuleResponse       [admin]
DELETE /rules/{id}          [admin]
PATCH  /rules/{id}/toggle   → RuleResponse       # activar / desactivar
```

### Analytics

```
GET    /analytics/kpis?vertical=agro|energia     → KpiResponse
GET    /analytics/predictions/{device_id}        → PredictionResponse
GET    /analytics/anomalies/{device_id}
       ?variable=<string>&window_hours=24        → list[AnomalyPoint]
```

### Organizations y Users

```
GET    /organizations/me    → OrganizationResponse
PUT    /organizations/me    → OrganizationResponse    [admin]
GET    /users               → list[UserResponse]      [admin]
POST   /users               → UserResponse            [admin]
PUT    /users/{id}          → UserResponse            [admin]
DELETE /users/{id}          [admin]
```

### WebSocket

```
WS     /ws/{org_id}         # autenticado via ?token=<jwt> en query param
```

---

## 5. Autenticación y Multi-tenancy

### JWT con org_id embebido

```python
# core/security.py
from jose import jwt
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"])

def create_access_token(user: User) -> str:
    payload = {
        "sub":      str(user.id),
        "org_id":   str(user.org_id),
        "role":     user.role,
        "vertical": user.vertical,
        "exp":      datetime.utcnow() + timedelta(hours=24),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")

# core/dependencies.py
async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
    except JWTError:
        raise HTTPException(status_code=401, detail="Token inválido")

    user = await db.get(User, UUID(payload["sub"]))
    if not user:
        raise HTTPException(status_code=401, detail="Usuario no encontrado")
    return user

def require_role(*roles: str):
    async def checker(user: User = Depends(get_current_user)):
        if user.role not in roles:
            raise HTTPException(status_code=403, detail="Sin permisos")
        return user
    return checker
```

### Row-Level Security — aislamiento por organización

```python
# Todos los queries filtran por org_id del token, nunca del request body
# Esto evita que un cliente acceda a datos de otro cliente

async def get_devices(
    db: AsyncSession,
    current_user: User = Depends(get_current_user),
    vertical: str | None = None,
) -> list[Device]:
    query = select(Device).where(Device.org_id == current_user.org_id)
    if vertical:
        query = query.where(Device.vertical == vertical)
    result = await db.execute(query)
    return result.scalars().all()
```

### Autenticación de dispositivos (API Key)

Los dispositivos se autentican con una API Key fija (no JWT, ya que no tienen fecha de expiración):

```python
# En el endpoint /ingest
async def ingest_data(
    payload: IngestPayload,
    x_api_key: str = Header(...),
    db: AsyncSession = Depends(get_db),
):
    device = await db.execute(
        select(Device).where(Device.api_key == x_api_key)
    )
    if not device:
        raise HTTPException(status_code=401)
    # procesar datos...
```

---

## 6. MQTT Subscriber

### Conexión al broker

```python
# mqtt/client.py
import asyncio
import asyncio_mqtt as mqtt
from app.mqtt.handlers import handle_message

async def start_mqtt_subscriber():
    async with mqtt.Client(
        hostname=settings.MQTT_HOST,
        port=settings.MQTT_PORT,
        username=settings.MQTT_USER,
        password=settings.MQTT_PASSWORD,
    ) as client:
        # Suscribirse a todos los topics de telemetría
        await client.subscribe("#")   # wildcard — todos los topics

        async for message in client.messages:
            asyncio.create_task(
                handle_message(str(message.topic), message.payload.decode())
            )
```

### Entry point — arranque junto a FastAPI

```python
# main.py
from contextlib import asynccontextmanager
from fastapi import FastAPI
from app.mqtt.client import start_mqtt_subscriber

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Arrancar MQTT subscriber en background al iniciar el servidor
    mqtt_task = asyncio.create_task(start_mqtt_subscriber())
    yield
    # Al apagar, cancelar la tarea limpiamente
    mqtt_task.cancel()

app = FastAPI(lifespan=lifespan)
```

### Handler de mensajes

```python
# mqtt/handlers.py
import json
from app.mqtt.topics import parse_topic
from app.database import get_db_context
from app.rules.engine import RuleEngine
from app.websocket.manager import ws_manager

async def handle_message(topic: str, raw_payload: str):
    parsed = parse_topic(topic)
    if not parsed:
        return

    try:
        payload = json.loads(raw_payload)
    except json.JSONDecodeError:
        return

    async with get_db_context() as db:
        # 1. Persistir lecturas en TimescaleDB
        readings = await persist_readings(db, parsed, payload)

        # 2. Actualizar last_seen del dispositivo
        await update_device_status(db, parsed.device_id)

        # 3. Cache en Redis (último valor por variable)
        await cache_latest_readings(parsed.device_id, payload["variables"])

        # 4. Evaluar reglas → generar alertas
        engine = RuleEngine(db)
        alerts = await engine.evaluate(parsed.device_id, payload["variables"])

        # 5. Emitir por WebSocket a la organización
        await ws_manager.broadcast_to_org(parsed.org_id, {
            "type":      "reading",
            "device_id": parsed.device_id,
            "variables": payload["variables"],
            "timestamp": payload["timestamp"],
        })

        if alerts:
            for alert in alerts:
                await ws_manager.broadcast_to_org(parsed.org_id, {
                    "type":  "alert",
                    "data":  alert.dict(),
                })

# mqtt/topics.py
import re
from dataclasses import dataclass

# Topic pattern: /{vertical}/{org_id}/{device_id}/telemetry
TOPIC_PATTERN = re.compile(
    r"^/?(agro|energia)/([a-f0-9-]+)/([a-f0-9-]+)/(telemetry|status|commands)$"
)

@dataclass
class ParsedTopic:
    vertical:  str
    org_id:    str
    device_id: str
    type:      str

def parse_topic(topic: str) -> ParsedTopic | None:
    match = TOPIC_PATTERN.match(topic)
    if not match:
        return None
    return ParsedTopic(*match.groups())
```

---

## 7. Pipeline de Ingesta

Flujo completo desde que llega un dato hasta que aparece en el frontend:

```
┌──────────────────────────────────────────────────────────────────┐
│  PIPELINE DE INGESTA (< 500ms extremo a extremo)                 │
│                                                                   │
│  1. Mensaje MQTT llega al broker EMQX                            │
│     topic: /agro/org-001/device-001/telemetry                    │
│     payload: { device_id, timestamp, variables: {...} }          │
│                           │                                       │
│  2. MQTT Subscriber recibe el mensaje (asyncio_mqtt)             │
│     → parse_topic() extrae vertical, org_id, device_id          │
│     → json.loads() parsea el payload                             │
│                           │                                       │
│  3. Validación y persistencia (async, paralelo)                  │
│     a) INSERT INTO sensor_readings → TimescaleDB hypertable      │
│     b) UPDATE devices SET last_seen = NOW()                      │
│     c) SETEX cache:{device_id}:{variable} 300 → Redis            │
│                           │                                       │
│  4. Motor de Reglas evalúa las nuevas lecturas                   │
│     → Si hay alerta: INSERT INTO alerts_log                      │
│     → Verificar cooldown en Redis antes de notificar             │
│                           │                                       │
│  5. WebSocket broadcast a todos los clientes del org_id          │
│     → { type: "reading", device_id, variables, timestamp }       │
│     → Frontend actualiza VariableCards y marcadores del mapa     │
│                           │                                       │
│  6. Si hay alerta: notificación asíncrona                        │
│     → WhatsApp / Email / Webhook via cola Redis                  │
└──────────────────────────────────────────────────────────────────┘
```

### Persistencia de lecturas

```python
# mqtt/handlers.py (detalle)
async def persist_readings(
    db: AsyncSession,
    topic: ParsedTopic,
    payload: dict,
) -> list[SensorReading]:
    timestamp = datetime.fromisoformat(payload["timestamp"])
    readings = []

    for variable, value in payload["variables"].items():
        if not isinstance(value, (int, float)):
            continue
        reading = SensorReading(
            time=timestamp,
            device_id=UUID(topic.device_id),
            org_id=UUID(topic.org_id),
            vertical=topic.vertical,
            variable=variable,
            value=float(value),
        )
        db.add(reading)
        readings.append(reading)

    await db.commit()
    return readings
```

---

## 8. WebSocket — Tiempo Real

### Connection Manager

```python
# websocket/manager.py
from fastapi import WebSocket
import asyncio

class ConnectionManager:
    def __init__(self):
        # org_id → lista de WebSockets activos
        self._connections: dict[str, list[WebSocket]] = {}

    async def connect(self, ws: WebSocket, org_id: str):
        await ws.accept()
        self._connections.setdefault(org_id, []).append(ws)

    def disconnect(self, ws: WebSocket, org_id: str):
        conns = self._connections.get(org_id, [])
        if ws in conns:
            conns.remove(ws)

    async def broadcast_to_org(self, org_id: str, data: dict):
        dead = []
        for ws in self._connections.get(org_id, []):
            try:
                await ws.send_json(data)
            except Exception:
                dead.append(ws)
        # limpiar conexiones muertas
        for ws in dead:
            self.disconnect(ws, org_id)

ws_manager = ConnectionManager()  # singleton global

# websocket/router.py
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from app.core.security import decode_token

router = APIRouter()

@router.websocket("/ws/{org_id}")
async def websocket_endpoint(
    ws: WebSocket,
    org_id: str,
    token: str = Query(...),
):
    # Validar token antes de aceptar la conexión
    payload = decode_token(token)
    if not payload or payload["org_id"] != org_id:
        await ws.close(code=4001)
        return

    await ws_manager.connect(ws, org_id)
    try:
        # Mantener la conexión viva, escuchar ping/pong
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(ws, org_id)
```

### Mensajes emitidos por WebSocket

```typescript
// Tipos de mensajes que recibe el frontend
type WsMessage =
  | { type: 'reading';       device_id: string; variables: Record<string, number>; timestamp: string }
  | { type: 'alert';         data: Alert }
  | { type: 'device_status'; device_id: string; status: DeviceStatus }
  | { type: 'ping' }
```

---

## 9. Motor de Reglas

### Evaluador

```python
# rules/engine.py
class RuleEngine:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def evaluate(
        self,
        device_id: UUID,
        variables: dict[str, float],
    ) -> list[Alert]:

        device  = await self._get_device(device_id)
        rules   = await self._get_active_rules(device_id, device.org_id)
        alerts  = []

        for rule in rules:
            value = variables.get(rule.variable)
            if value is None:
                continue

            severity = self._check(value, rule)
            if not severity:
                continue

            # Verificar cooldown en Redis (evitar spam)
            cooldown_key = f"alert_cooldown:{rule.id}:{device_id}"
            if await redis.exists(cooldown_key):
                continue

            # Crear alerta
            alert = Alert(
                device_id=device_id,
                org_id=device.org_id,
                rule_id=rule.id,
                severity=severity,
                variable=rule.variable,
                value=value,
                threshold=rule.threshold_high or rule.threshold_low,
                message=self._build_message(device, rule, value, severity),
            )
            self.db.add(alert)
            await self.db.commit()
            await self.db.refresh(alert)

            # Activar cooldown
            await redis.setex(cooldown_key, rule.cooldown_min * 60, "1")

            alerts.append(alert)

        return alerts

    def _check(self, value: float, rule: Rule) -> str | None:
        if rule.operator == "<" and value < rule.threshold_low:
            return rule.severity
        if rule.operator == ">" and value > rule.threshold_high:
            return rule.severity
        if rule.operator == "between":
            if value < rule.threshold_low or value > rule.threshold_high:
                return rule.severity
        return None
```

### Reglas pre-configuradas por vertical

```python
# rules/agro_rules.py
# Se insertan en BD al arrancar si no existen (seed automático por org)

CROP_TEMPLATES = {
    "papa_andina": [
        Rule(name="Helada crítica",    variable="temperature",  operator="<",  threshold_low=2,   severity="critical"),
        Rule(name="Temperatura baja",  variable="temperature",  operator="<",  threshold_low=5,   severity="warning"),
        Rule(name="Humedad crítica",   variable="soil_moisture", operator="<", threshold_low=25,  severity="critical"),
        Rule(name="Humedad baja",      variable="soil_moisture", operator="<", threshold_low=35,  severity="warning"),
        Rule(name="Batería baja",      variable="battery",      operator="<",  threshold_low=20,  severity="warning"),
    ],
    "maiz_costa": [
        Rule(name="Temperatura alta",  variable="temperature",  operator=">",  threshold_high=38, severity="warning"),
        Rule(name="Humedad crítica",   variable="soil_moisture", operator="<", threshold_low=40,  severity="critical"),
    ],
}

# rules/energia_rules.py
EQUIPMENT_TEMPLATES = {
    "transformer": [
        Rule(name="FP bajo crítico",   variable="power_factor",   operator="<", threshold_low=0.75, severity="critical"),
        Rule(name="FP bajo aviso",     variable="power_factor",   operator="<", threshold_low=0.85, severity="warning"),
        Rule(name="Temp aceite alta",  variable="oil_temp",       operator=">", threshold_high=100, severity="critical"),
        Rule(name="Sobrecarga",        variable="load_pct",       operator=">", threshold_high=110, severity="critical"),
    ],
    "solar_panel": [
        Rule(name="Baja eficiencia",   variable="efficiency_pct", operator="<", threshold_low=50,   severity="warning"),
        Rule(name="Temp panel alta",   variable="panel_temp",     operator=">", threshold_high=80,  severity="warning"),
    ],
}
```

---

## 10. Analytics por Vertical

### Base común (TimescaleDB)

```python
# analytics/base.py
class AnalyticsBase:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def _query_timebucket(
        self,
        device_id: UUID,
        variable: str,
        bucket: str,     # '1 hour', '15 minutes', etc.
        since: timedelta,
    ) -> list[dict]:
        result = await self.db.execute(text("""
            SELECT
                time_bucket(:bucket, time) AS t,
                AVG(value) AS avg,
                MIN(value) AS min,
                MAX(value) AS max
            FROM sensor_readings
            WHERE device_id = :device_id
              AND variable   = :variable
              AND time > NOW() - :since::interval
            GROUP BY t
            ORDER BY t
        """), {"bucket": bucket, "device_id": device_id,
               "variable": variable, "since": str(since)})
        return [dict(row) for row in result]
```

### KPIs Agro

```python
# analytics/agro/kpis.py
class AgroKPIs(AnalyticsBase):
    async def calculate(self, org_id: UUID) -> dict:
        devices = await self._get_devices(org_id, vertical="agro")

        # Promedio de humedad en todas las parcelas activas
        avg_moisture = await self.db.execute(text("""
            SELECT AVG(value) FROM sensor_readings
            WHERE org_id = :org_id
              AND variable = 'soil_moisture'
              AND time > NOW() - INTERVAL '1 hour'
        """), {"org_id": org_id})

        # Riesgo de helada: ¿algún sensor con tendencia bajando < umbral cultivo?
        frost_risk = await self._evaluate_frost_risk(devices)

        return {
            "active_devices":    sum(1 for d in devices if d.status != 'offline'),
            "offline_devices":   sum(1 for d in devices if d.status == 'offline'),
            "avg_soil_moisture": round(avg_moisture.scalar() or 0, 1),
            "frost_risk_level":  frost_risk,
            "alerts_this_week":  await self._count_alerts(org_id, days=7),
            "devices_with_stress": await self._count_stressed_devices(org_id),
        }
```

### Predicciones (regresión lineal simple)

```python
# analytics/agro/predictions.py
import numpy as np
from sklearn.linear_model import LinearRegression

class AgroPredictions(AnalyticsBase):
    async def predict_temperature(
        self,
        device_id: UUID,
        hours_ahead: int = 6,
    ) -> dict:
        # Últimas 12h en buckets de 15 min
        data = await self._query_timebucket(
            device_id, "temperature", "15 minutes", timedelta(hours=12)
        )
        if len(data) < 4:
            return {"available": False}

        X = np.arange(len(data)).reshape(-1, 1)
        y = np.array([d["avg"] for d in data])

        model = LinearRegression().fit(X, y)
        future_x = np.array([[len(data) + hours_ahead * 4]])
        predicted = model.predict(future_x)[0]
        confidence = max(0, model.score(X, y))

        device = await self.db.get(Device, device_id)
        frost_threshold = CROP_THRESHOLDS.get(
            device.crop_type, {}
        ).get("frost_risk_temp", 2)

        return {
            "available":        True,
            "predicted_value":  round(predicted, 1),
            "hours_ahead":      hours_ahead,
            "confidence":       round(confidence, 2),
            "frost_risk":       predicted < frost_threshold,
            "frost_threshold":  frost_threshold,
        }
```

---

## 11. Sistema de Notificaciones

```python
# notifications/dispatcher.py
# Corre en background (asyncio.create_task) para no bloquear el pipeline

async def dispatch_alert(alert: Alert, device: Device, rule: Rule):
    tasks = []

    if rule.notify_whatsapp:
        # Obtener teléfonos de usuarios admin de la org con WhatsApp habilitado
        phones = await get_admin_phones(device.org_id)
        for phone in phones:
            tasks.append(send_whatsapp(phone, alert, device))

    if rule.notify_email:
        emails = await get_admin_emails(device.org_id)
        for email in emails:
            tasks.append(send_email(email, alert, device))

    # Ejecutar todas las notificaciones en paralelo
    await asyncio.gather(*tasks, return_exceptions=True)
```

---

## 12. Configuración y Variables de Entorno

```python
# config.py
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Base de datos
    DATABASE_URL: str = "postgresql+asyncpg://ruwi:pass@timescaledb/ruwi_iot"

    # Redis
    REDIS_URL: str = "redis://:pass@redis:6379/0"

    # JWT
    JWT_SECRET_KEY: str
    JWT_ALGORITHM:  str = "HS256"
    JWT_EXPIRE_HOURS: int = 24

    # MQTT
    MQTT_HOST:     str = "emqx"
    MQTT_PORT:     int = 1883
    MQTT_USER:     str = "backend"
    MQTT_PASSWORD: str

    # Notificaciones
    TWILIO_SID:             str = ""
    TWILIO_TOKEN:           str = ""
    TWILIO_WHATSAPP_FROM:   str = "whatsapp:+14155238886"
    RESEND_API_KEY:         str = ""

    # App
    ENVIRONMENT: str = "production"
    DEBUG:       bool = False

    class Config:
        env_file = ".env"

settings = Settings()
```

---

## 13. Dockerfile

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Dependencias del sistema para psycopg2/asyncpg y geoalchemy
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
```

```txt
# requirements.txt
fastapi==0.115.0
uvicorn[standard]==0.31.0
pydantic==2.9.0
pydantic-settings==2.5.0
sqlalchemy[asyncio]==2.0.36
asyncpg==0.30.0
alembic==1.13.3
geoalchemy2==0.15.2
redis[asyncio]==5.1.1
asyncio-mqtt==0.16.2
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
httpx==0.27.2
twilio==9.3.4
resend==2.4.0
scikit-learn==1.5.2
pandas==2.2.3
numpy==2.1.2
```

---

## 14. Mapeo Frontend → Backend

Cada acción del frontend y el endpoint que la resuelve:

| Vista / Acción en Frontend | Endpoint Backend |
|---------------------------|-----------------|
| Login | `POST /auth/login` |
| Cargar mapa de dispositivos | `GET /devices?vertical=<activo>` |
| Popup del dispositivo | `GET /devices/{id}/variables` (desde Redis) |
| Grilla de dispositivos | `GET /devices` |
| Buscar / filtrar dispositivos | `GET /devices?status=&search=` |
| Valores actuales (VariableCards) | `GET /telemetry/{id}/latest` |
| Gráfica histórica | `GET /telemetry/{id}?variable=&range=` |
| Predicciones agro | `GET /analytics/predictions/{id}` |
| Alertas activas | `GET /alerts?acknowledged=false` |
| Reconocer alerta | `PATCH /alerts/{id}/acknowledge` |
| KPIs Analytics | `GET /analytics/kpis?vertical=` |
| Tabla de configuración de dispositivos | `GET /devices` |
| Crear / editar regla | `POST /rules`, `PUT /rules/{id}` |
| Toggle regla activa | `PATCH /rules/{id}/toggle` |
| Datos en tiempo real (mapa, VariableCards, alertas) | `WS /ws/{org_id}` |
| Ingesta desde dispositivo HTTP | `POST /ingest` |

---

*Documento de arquitectura backend — Ruwi Lab IoT Platform*
*Versión 1.0 — Marzo 2026 | Ver también: `services-architecture.md`, `stack-iot-mvp.md`*
