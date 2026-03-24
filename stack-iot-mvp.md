# Stack Tecnológico — MVP Plataforma IoT Vertical-Native
> Documento técnico para startup IoT — Camino 1: Plataforma con módulos especializados en Agro y Energía  
> Versión: 1.0 | Fecha: Marzo 2026

---

## Tabla de Contenidos

1. [Visión General de la Arquitectura](#1-visión-general-de-la-arquitectura)
2. [Capa 1 — Ingesta de Datos (Device Layer)](#2-capa-1--ingesta-de-datos-device-layer)
3. [Capa 2 — Backend (Core de la Plataforma)](#3-capa-2--backend-core-de-la-plataforma)
4. [Capa 3 — Base de Datos (Data Layer)](#4-capa-3--base-de-datos-data-layer)
5. [Capa 4 — Motor de Reglas y AI](#5-capa-4--motor-de-reglas-y-ai)
6. [Capa 5 — Frontend (Dashboard)](#6-capa-5--frontend-dashboard)
7. [Capa 6 — Notificaciones](#7-capa-6--notificaciones)
8. [Infraestructura y DevOps](#8-infraestructura-y-devops)
9. [Resumen del Stack](#9-resumen-del-stack)
10. [Roadmap Técnico por Fases](#10-roadmap-técnico-por-fases)
11. [Errores Críticos a Evitar](#11-errores-críticos-a-evitar)
12. [Estimación de Costos Mensuales](#12-estimación-de-costos-mensuales)

---

## 1. Visión General de la Arquitectura

### Diagrama de flujo general

```
┌─────────────────────────────────────────────────────────────────┐
│                     DISPOSITIVOS / SENSORES                      │
│           ESP32 / LoRa / Modbus / HTTP devices                  │
└──────────────────────┬──────────────────────────────────────────┘
                       │  MQTT / HTTP
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    MESSAGE BROKER (EMQX)                         │
│         Topics: /agro/{device_id}/data                          │
│                 /energia/{device_id}/data                        │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                   BACKEND API (FastAPI)                          │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  MQTT Sub   │  │  REST API    │  │  WebSocket Server    │  │
│  └──────┬──────┘  └──────┬───────┘  └──────────┬───────────┘  │
│         │                │                       │              │
│  ┌──────▼──────────────────────────────────────▼───────────┐  │
│  │              Motor de Reglas + AI Analytics              │  │
│  │         (Módulos verticales: Agro / Energía)             │  │
│  └─────────────────────────────────────────────────────────┘  │
└──────────────────────┬──────────────────────────────────────────┘
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
  ┌──────────────┐ ┌────────┐ ┌──────────────────┐
  │ TimescaleDB  │ │ Redis  │ │  Notificaciones  │
  │ (series de   │ │(cache/ │ │ WhatsApp / Email │
  │  tiempo +    │ │ queue) │ │ / Webhook        │
  │  relacional) │ └────────┘ └──────────────────┘
  └──────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                FRONTEND DASHBOARD (React)                        │
│    Mapa de dispositivos │ Gráficas live │ Alertas │ KPIs        │
└─────────────────────────────────────────────────────────────────┘
```

### Principios de diseño para el MVP

- **Monolito modular:** un solo backend bien organizado. No microservicios.
- **Vertical-native:** los módulos de agro y energía son ciudadanos de primera clase, no add-ons.
- **Latam-first:** WhatsApp para alertas, soporte offline, costos accesibles.
- **Self-hosted:** control total sobre los datos, costos predecibles.

---

## 2. Capa 1 — Ingesta de Datos (Device Layer)

### Protocolo principal: MQTT

MQTT (Message Queuing Telemetry Transport) es el estándar de facto en IoT. Opera sobre TCP con un modelo publish/subscribe que lo hace ideal para dispositivos con recursos limitados.

**Características técnicas relevantes:**
- Overhead mínimo: headers de solo 2 bytes
- QoS niveles: 0 (at most once), 1 (at least once), 2 (exactly once)
- Soporte nativo en ESP32, Arduino, Raspberry Pi
- Compatible con TLS para comunicación segura

**Estructura de topics recomendada:**

```
# Agro
/agro/{org_id}/{device_id}/telemetry      # datos de sensores
/agro/{org_id}/{device_id}/status         # estado del dispositivo
/agro/{org_id}/{device_id}/commands       # comandos hacia el dispositivo

# Energía
/energia/{org_id}/{device_id}/telemetry
/energia/{org_id}/{device_id}/status
/energia/{org_id}/{device_id}/commands

# Sistema
/system/{device_id}/heartbeat             # ping cada 60 segundos
```

**Payload JSON estándar:**

```json
{
  "device_id": "sensor_agro_001",
  "timestamp": "2026-03-04T14:23:01Z",
  "variables": {
    "soil_moisture": 42.5,
    "temperature": 18.3,
    "humidity": 67.0,
    "battery_level": 85
  },
  "metadata": {
    "vertical": "agro",
    "crop_type": "papa_andina",
    "altitude_msnm": 3800
  }
}
```

### Broker: EMQX (Open Source)

**Por qué EMQX sobre Mosquitto:**
- Mosquitto es excelente para desarrollo, pero EMQX escala mejor en producción
- Dashboard web de administración incluido
- Reglas internas (Rule Engine) para preprocesamiento de mensajes
- Soporte nativo para clustering cuando escales

**Instalación con Docker:**

```yaml
# docker-compose.yml
emqx:
  image: emqx/emqx:5.4
  ports:
    - "1883:1883"    # MQTT
    - "8083:8083"    # MQTT sobre WebSocket
    - "8883:8883"    # MQTT sobre TLS
    - "18083:18083"  # Dashboard admin
  environment:
    - EMQX_NAME=ruwi_broker
    - EMQX_HOST=0.0.0.0
  volumes:
    - emqx_data:/opt/emqx/data
```

### Fallback HTTP/REST

Para dispositivos que no soportan MQTT (equipos industriales legacy, medidores eléctricos con firmware antiguo):

```
POST /api/v1/ingest
Authorization: Bearer {device_token}
Content-Type: application/json

{
  "device_id": "medidor_001",
  "vertical": "energia",
  "variables": { ... }
}
```

### Soporte LoRaWAN (para zonas sin conectividad)

Para el mercado agro en zonas rurales remotas (prioridad alta en Perú), integrar con un Network Server LoRaWAN:

- **ChirpStack** (open source, self-hosted): recibe datos de gateways LoRa y los reenvía via MQTT o HTTP a tu backend
- Hardware de gateway: RAK7268 (~$150) o fabricado en FabLab con RAK2287
- Alcance: 2-15 km en zonas rurales, bajo consumo de batería en sensores

```
[Sensor LoRa] → [Gateway LoRa] → [ChirpStack NS] → [MQTT] → [EMQX] → [Backend]
```

---

## 3. Capa 2 — Backend (Core de la Plataforma)

### Framework: FastAPI (Python 3.11+)

**Justificación técnica:**
- Async nativo con `asyncio` — maneja miles de conexiones concurrentes
- Generación automática de documentación OpenAPI (Swagger UI)
- Tipado estático con Pydantic — validación de datos robusta
- Ecosistema AI/ML en Python sin fricciones (scikit-learn, Pandas, etc.)
- Performance comparable a Node.js para workloads I/O-bound

### Estructura del proyecto

```
backend/
├── app/
│   ├── main.py                    # Entry point FastAPI
│   ├── config.py                  # Variables de entorno
│   ├── database.py                # Conexión TimescaleDB
│   ├── cache.py                   # Conexión Redis
│   │
│   ├── api/                       # Endpoints REST
│   │   ├── v1/
│   │   │   ├── devices.py         # CRUD dispositivos
│   │   │   ├── telemetry.py       # Consulta de datos históricos
│   │   │   ├── alerts.py          # Gestión de alertas
│   │   │   ├── dashboards.py      # Configuración de dashboards
│   │   │   ├── organizations.py   # Multi-tenancy
│   │   │   └── auth.py            # Autenticación JWT
│   │
│   ├── mqtt/                      # MQTT subscriber
│   │   ├── client.py              # Conexión al broker EMQX
│   │   ├── handlers.py            # Procesamiento de mensajes
│   │   └── topics.py              # Definición de topics
│   │
│   ├── rules/                     # Motor de reglas
│   │   ├── engine.py              # Evaluador de reglas
│   │   ├── agro_rules.py          # Reglas pre-configuradas agro
│   │   └── energia_rules.py       # Reglas pre-configuradas energía
│   │
│   ├── analytics/                 # Módulos verticales AI
│   │   ├── base.py                # Clase base analytics
│   │   ├── agro/
│   │   │   ├── anomaly.py         # Detección anomalías agro
│   │   │   ├── predictions.py     # Predicciones (estrés hídrico, heladas)
│   │   │   └── kpis.py            # KPIs por cultivo
│   │   └── energia/
│   │       ├── anomaly.py         # Detección anomalías energía
│   │       ├── predictions.py     # Predicción de demanda
│   │       └── kpis.py            # KPIs eléctricos
│   │
│   ├── websocket/                 # Tiempo real hacia frontend
│   │   └── manager.py             # WebSocket connection manager
│   │
│   ├── notifications/             # Sistema de notificaciones
│   │   ├── whatsapp.py
│   │   ├── email.py
│   │   └── webhook.py
│   │
│   └── models/                    # Schemas Pydantic + ORM
│       ├── device.py
│       ├── telemetry.py
│       ├── alert.py
│       └── user.py
│
├── tests/
├── Dockerfile
├── requirements.txt
└── docker-compose.yml
```

### Multi-tenancy

Cada organización (cliente) ve únicamente sus dispositivos y datos. Implementación via Row-Level Security en PostgreSQL + JWT con `org_id` embebido:

```python
# Ejemplo: query filtrada por organización
async def get_devices(org_id: str, db: AsyncSession):
    result = await db.execute(
        select(Device).where(Device.org_id == org_id)
    )
    return result.scalars().all()
```

### Autenticación

- **JWT (JSON Web Tokens)** para usuarios del dashboard
- **API Keys** para dispositivos y integraciones externas
- **Librería:** `python-jose` + `passlib`

```python
# Token payload
{
  "sub": "user_id_123",
  "org_id": "org_456",
  "role": "admin",        # admin | viewer | device
  "vertical": "agro",
  "exp": 1741132800
}
```

### WebSockets para tiempo real

```python
# websocket/manager.py
class ConnectionManager:
    def __init__(self):
        self.connections: dict[str, list[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, org_id: str):
        await websocket.accept()
        self.connections.setdefault(org_id, []).append(websocket)

    async def broadcast_to_org(self, org_id: str, data: dict):
        for ws in self.connections.get(org_id, []):
            await ws.send_json(data)
```

Flujo: `Sensor → MQTT → Backend → WebSocket → Dashboard (live, <500ms latencia)`

---

## 4. Capa 3 — Base de Datos (Data Layer)

### TimescaleDB — Series de tiempo + Relacional en uno

TimescaleDB es una extensión de PostgreSQL optimizada para datos temporales. La ventaja clave: **una sola base de datos** maneja tanto las lecturas de sensores (millones de filas) como los datos relacionales del negocio (usuarios, dispositivos, reglas).

**Instalación:**

```yaml
# docker-compose.yml
timescaledb:
  image: timescale/timescaledb:latest-pg15
  environment:
    POSTGRES_USER: ruwi
    POSTGRES_PASSWORD: ${DB_PASSWORD}
    POSTGRES_DB: ruwi_iot
  volumes:
    - timescale_data:/var/lib/postgresql/data
  ports:
    - "5432:5432"
```

### Schema de base de datos

**Tablas de series de tiempo (TimescaleDB hypertables):**

```sql
-- Lecturas de sensores (hypertable particionada por tiempo)
CREATE TABLE sensor_readings (
    time          TIMESTAMPTZ NOT NULL,
    device_id     UUID NOT NULL,
    org_id        UUID NOT NULL,
    vertical      VARCHAR(20) NOT NULL,  -- 'agro' | 'energia'
    variable      VARCHAR(50) NOT NULL,  -- 'soil_moisture', 'voltage', etc.
    value         DOUBLE PRECISION,
    unit          VARCHAR(20),
    quality       SMALLINT DEFAULT 100   -- 0-100, calidad del dato
);

-- Convertir a hypertable (partición automática por tiempo)
SELECT create_hypertable('sensor_readings', 'time');

-- Política de compresión: comprimir datos > 7 días
SELECT add_compression_policy('sensor_readings',
    INTERVAL '7 days');

-- Política de retención: eliminar datos > 2 años
SELECT add_retention_policy('sensor_readings',
    INTERVAL '2 years');

-- Log de alertas disparadas
CREATE TABLE alerts_log (
    id            UUID DEFAULT gen_random_uuid(),
    time          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    device_id     UUID NOT NULL,
    org_id        UUID NOT NULL,
    rule_id       UUID NOT NULL,
    severity      VARCHAR(10),  -- 'info' | 'warning' | 'critical'
    variable      VARCHAR(50),
    value         DOUBLE PRECISION,
    threshold     DOUBLE PRECISION,
    acknowledged  BOOLEAN DEFAULT FALSE,
    message       TEXT
);

SELECT create_hypertable('alerts_log', 'time');
```

**Tablas relacionales (PostgreSQL estándar):**

```sql
-- Organizaciones (multi-tenancy)
CREATE TABLE organizations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(100) NOT NULL,
    vertical    VARCHAR(20),   -- vertical principal del cliente
    plan        VARCHAR(20) DEFAULT 'starter',
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Dispositivos
CREATE TABLE devices (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID REFERENCES organizations(id),
    name            VARCHAR(100),
    type            VARCHAR(50),     -- 'soil_sensor', 'weather_station', etc.
    vertical        VARCHAR(20),
    location        GEOGRAPHY(POINT),  -- coordenadas GPS
    altitude_msnm   INTEGER,
    crop_type       VARCHAR(50),     -- para agro: 'papa', 'maiz', etc.
    status          VARCHAR(20) DEFAULT 'active',
    last_seen       TIMESTAMPTZ,
    metadata        JSONB,           -- campos extra flexibles
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Usuarios
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID REFERENCES organizations(id),
    email           VARCHAR(100) UNIQUE NOT NULL,
    hashed_password VARCHAR(255),
    role            VARCHAR(20) DEFAULT 'viewer',
    phone_whatsapp  VARCHAR(20),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Reglas de alerta
CREATE TABLE rules (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID REFERENCES organizations(id),
    device_id       UUID REFERENCES devices(id),
    name            VARCHAR(100),
    variable        VARCHAR(50),
    operator        VARCHAR(10),   -- '<', '>', '==', 'between'
    threshold_low   DOUBLE PRECISION,
    threshold_high  DOUBLE PRECISION,
    severity        VARCHAR(10),
    notify_whatsapp BOOLEAN DEFAULT TRUE,
    notify_email    BOOLEAN DEFAULT FALSE,
    cooldown_min    INTEGER DEFAULT 30,  -- minutos entre alertas repetidas
    active          BOOLEAN DEFAULT TRUE
);
```

**Queries de ejemplo optimizadas con TimescaleDB:**

```sql
-- Promedio de humedad de suelo por hora (últimas 24h)
SELECT
    time_bucket('1 hour', time) AS bucket,
    AVG(value) AS avg_moisture,
    MIN(value) AS min_moisture,
    MAX(value) AS max_moisture
FROM sensor_readings
WHERE
    device_id = 'uuid-del-sensor'
    AND variable = 'soil_moisture'
    AND time > NOW() - INTERVAL '24 hours'
GROUP BY bucket
ORDER BY bucket;

-- Último valor de cada variable por dispositivo
SELECT DISTINCT ON (device_id, variable)
    device_id, variable, value, time
FROM sensor_readings
WHERE org_id = 'uuid-org'
ORDER BY device_id, variable, time DESC;
```

### Redis — Cache y Queue

```yaml
# docker-compose.yml
redis:
  image: redis:7-alpine
  command: redis-server --appendonly yes
  volumes:
    - redis_data:/data
```

**Usos en el MVP:**

```python
# 1. Cache del último valor de cada sensor (evita query a BD en dashboard)
await redis.setex(
    f"last_value:{device_id}:{variable}",
    ttl=300,  # 5 minutos
    value=json.dumps({"value": 42.5, "timestamp": "..."})
)

# 2. Rate limiting de alertas (evitar spam de notificaciones)
key = f"alert_cooldown:{rule_id}"
if not await redis.exists(key):
    await send_alert(...)
    await redis.setex(key, ttl=1800)  # 30 min cooldown

# 3. Queue de notificaciones (async, no bloquea el pipeline de datos)
await redis.lpush("notification_queue", json.dumps(notification))
```

---

## 5. Capa 4 — Motor de Reglas y AI

### Motor de Reglas — Threshold-based con contexto vertical

El diferenciador clave vs. Ubidots: **los umbrales vienen pre-configurados por cultivo o tipo de equipo**. El cliente no configura nada desde cero.

```python
# rules/agro_rules.py

# Umbrales pre-configurados por cultivo y altitud
CROP_THRESHOLDS = {
    "papa_andina": {
        "altitude_range": (3000, 4500),
        "soil_moisture": {"critical_low": 25, "warning_low": 35,
                          "warning_high": 75, "critical_high": 85},
        "temperature":   {"critical_low": -2, "warning_low": 5,
                          "warning_high": 25, "critical_high": 30},
        "frost_risk_temp": 2  # alerta de helada si temp < 2°C
    },
    "maiz_costa": {
        "altitude_range": (0, 800),
        "soil_moisture": {"critical_low": 40, "warning_low": 50,
                          "warning_high": 80, "critical_high": 90},
        "temperature":   {"critical_low": 10, "warning_low": 15,
                          "warning_high": 35, "critical_high": 40},
    },
    "quinua": {
        "altitude_range": (3500, 4200),
        "soil_moisture": {"critical_low": 20, "warning_low": 30,
                          "warning_high": 65, "critical_high": 75},
    }
}

# rules/energia_rules.py

ENERGY_THRESHOLDS = {
    "transformador_distribucion": {
        "temperatura_aceite": {"warning_high": 85, "critical_high": 105},
        "factor_potencia":    {"warning_low": 0.85, "critical_low": 0.75},
        "sobrecarga_pct":     {"warning_high": 90, "critical_high": 110},
    },
    "panel_solar": {
        "eficiencia_pct":     {"warning_low": 70, "critical_low": 50},
        "temperatura_panel":  {"warning_high": 65, "critical_high": 80},
    }
}
```

**Evaluador de reglas:**

```python
# rules/engine.py

class RuleEngine:
    async def evaluate(self, reading: SensorReading) -> list[Alert]:
        alerts = []
        device = await get_device(reading.device_id)
        thresholds = self._get_thresholds(device)

        for variable, value in reading.variables.items():
            if variable not in thresholds:
                continue

            limits = thresholds[variable]
            severity = self._check_threshold(value, limits)

            if severity:
                alerts.append(Alert(
                    device_id=device.id,
                    variable=variable,
                    value=value,
                    severity=severity,
                    message=self._build_message(device, variable, value, severity)
                ))

        return alerts

    def _check_threshold(self, value: float, limits: dict) -> str | None:
        if value <= limits.get("critical_low", -999):
            return "critical"
        if value >= limits.get("critical_high", 999):
            return "critical"
        if value <= limits.get("warning_low", -999):
            return "warning"
        if value >= limits.get("warning_high", 999):
            return "warning"
        return None
```

### AI Analytics — Fase MVP

Para el MVP se usan técnicas estadísticas simples pero efectivas. No se necesita ML complejo hasta tener datos reales de campo.

**1. Detección de anomalías con Z-score:**

```python
# analytics/agro/anomaly.py
import pandas as pd
import numpy as np

class AgroAnomalyDetector:
    def detect_zscore(self, device_id: str, variable: str,
                      window_hours: int = 24) -> list[Anomaly]:
        """
        Detecta valores que se desvían más de 2.5 desviaciones estándar
        respecto al comportamiento histórico reciente del mismo sensor.
        """
        df = self._get_recent_data(device_id, variable, window_hours)

        mean = df['value'].mean()
        std = df['value'].std()

        anomalies = df[np.abs((df['value'] - mean) / std) > 2.5]
        return [Anomaly(timestamp=row.time, value=row.value,
                        zscore=abs((row.value - mean) / std))
                for _, row in anomalies.iterrows()]
```

**2. Predicción de tendencia (regresión lineal):**

```python
# analytics/agro/predictions.py
from sklearn.linear_model import LinearRegression
import numpy as np

class AgroPredictions:
    def predict_trend(self, device_id: str, variable: str,
                      hours_ahead: int = 6) -> Prediction:
        """
        Predice el valor de una variable N horas en el futuro
        basándose en la tendencia de las últimas 12 horas.
        """
        df = self._get_recent_data(device_id, variable, hours=12)

        X = np.array(range(len(df))).reshape(-1, 1)
        y = df['value'].values

        model = LinearRegression()
        model.fit(X, y)

        future_x = np.array([[len(df) + hours_ahead]])
        predicted_value = model.predict(future_x)[0]

        return Prediction(
            variable=variable,
            predicted_value=predicted_value,
            hours_ahead=hours_ahead,
            confidence=model.score(X, y)  # R²
        )

    def predict_frost_risk(self, device_id: str) -> FrostRisk:
        """
        Alerta de helada: si la temperatura tiende a bajar
        y la predicción a 3h es < umbral del cultivo.
        """
        prediction = self.predict_trend(device_id, "temperature", hours_ahead=3)
        device = get_device(device_id)
        frost_threshold = CROP_THRESHOLDS[device.crop_type]["frost_risk_temp"]

        return FrostRisk(
            risk_level="high" if prediction.predicted_value < frost_threshold else "low",
            predicted_temp=prediction.predicted_value,
            hours_to_event=3
        )
```

**3. KPIs verticales pre-calculados:**

```python
# analytics/energia/kpis.py

class EnergiaKPIs:
    def calculate(self, device_id: str, period_hours: int = 24) -> dict:
        return {
            "consumo_kwh":      self._total_consumption(device_id, period_hours),
            "factor_potencia":  self._avg_power_factor(device_id, period_hours),
            "horas_pico":       self._peak_hours(device_id, period_hours),
            "eficiencia_pct":   self._efficiency_score(device_id, period_hours),
            "anomalias_count":  self._count_anomalies(device_id, period_hours),
            "costo_estimado":   self._estimated_cost(device_id, period_hours)
        }
```

### Roadmap AI post-MVP

```
FASE 2 (con datos reales de campo):
  → Isolation Forest para anomalías multivariable
  → LSTM para predicción de series de tiempo
  → Modelos por cultivo entrenados con data local (ventaja vs. plataformas gringas)

FASE 3 (escala):
  → Federated learning: modelos mejoran con data de todos los clientes
    sin compartir datos individuales
  → LLM integrado: "¿Por qué falló mi bomba?" → respuesta en lenguaje natural
```

---

## 6. Capa 5 — Frontend (Dashboard)

### Stack Frontend

```
React 18 + TypeScript
  ├── Vite                    → build tool (más rápido que CRA)
  ├── React Query (TanStack)  → fetching, cache, sync de datos
  ├── Zustand                 → state management liviano
  ├── TailwindCSS             → estilos utilitarios
  ├── shadcn/ui               → componentes base (no-lib, copy-paste)
  ├── Apache ECharts          → gráficas de series de tiempo (mejor que Recharts para IoT)
  ├── Leaflet + React-Leaflet → mapas (open source, sin costo por requests)
  └── date-fns                → manejo de fechas y zonas horarias
```

### Estructura del Frontend

```
frontend/
├── src/
│   ├── pages/
│   │   ├── Dashboard.tsx          # Vista principal con mapa
│   │   ├── DeviceDetail.tsx       # Detalle de un dispositivo
│   │   ├── Alerts.tsx             # Panel de alertas
│   │   ├── Analytics.tsx          # Análisis y predicciones
│   │   └── Settings.tsx           # Configuración
│   │
│   ├── components/
│   │   ├── map/
│   │   │   └── DeviceMap.tsx      # Mapa Leaflet con marcadores
│   │   ├── charts/
│   │   │   ├── TimeseriesChart.tsx  # Gráfica principal de series
│   │   │   └── KpiCard.tsx        # Tarjeta de KPI
│   │   ├── alerts/
│   │   │   └── AlertFeed.tsx      # Lista de alertas en tiempo real
│   │   └── devices/
│   │       └── DeviceStatus.tsx   # Estado verde/amarillo/rojo
│   │
│   ├── hooks/
│   │   ├── useWebSocket.ts        # Conexión WebSocket
│   │   ├── useTelemetry.ts        # Datos históricos via REST
│   │   └── useAlerts.ts           # Suscripción a alertas
│   │
│   └── lib/
│       ├── api.ts                 # Cliente HTTP (axios)
│       └── websocket.ts           # Cliente WebSocket
```

### Datos en tiempo real — WebSocket

```typescript
// hooks/useWebSocket.ts
export function useDeviceWebSocket(orgId: string) {
  const [latestReadings, setLatestReadings] = useState<Record<string, Reading>>({});

  useEffect(() => {
    const ws = new WebSocket(`wss://api.tudominio.com/ws/${orgId}`);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setLatestReadings(prev => ({
        ...prev,
        [`${data.device_id}:${data.variable}`]: data
      }));
    };

    return () => ws.close();
  }, [orgId]);

  return latestReadings;
}
```

### Vistas MVP requeridas

**1. Mapa principal (home)**
- Dispositivos como marcadores coloreados (verde/amarillo/rojo según estado)
- Popup al click: última lectura + estado de alertas
- Filtro por vertical (agro / energía)

**2. Vista de dispositivo**
- Gráficas de series de tiempo por variable (últimas 24h / 7d / 30d)
- Tabla de últimas lecturas
- Alertas activas del dispositivo
- Predicciones (estrés hídrico, riesgo de helada para agro)

**3. Panel de alertas**
- Feed en tiempo real de alertas (WebSocket)
- Filtro por severidad y vertical
- Botón "Reconocer alerta"
- Historial de alertas

**4. Analytics / KPIs**
- Dashboard de KPIs pre-calculados según vertical
- Agro: humedad promedio, estrés hídrico, riesgo de helada, eficiencia de riego
- Energía: consumo kWh, factor de potencia, horas pico, anomalías detectadas

---

## 7. Capa 6 — Notificaciones

### WhatsApp Business API (prioritario en Latam)

Un agricultor en Puno no revisa email. Sí revisa WhatsApp. Esta es una ventaja competitiva real sobre plataformas de origen gringo.

**Opción recomendada para MVP: Twilio WhatsApp API**
- Setup en horas, no días
- $0.005 por mensaje en Latam (muy económico)
- Templates de mensajes pre-aprobados por Meta

```python
# notifications/whatsapp.py
from twilio.rest import Client

class WhatsAppNotifier:
    def __init__(self):
        self.client = Client(settings.TWILIO_SID, settings.TWILIO_TOKEN)

    async def send_alert(self, phone: str, alert: Alert, device: Device):
        # Mensaje contextualizado por vertical
        if device.vertical == "agro":
            message = (
                f"⚠️ *ALERTA {alert.severity.upper()}* — {device.name}\n"
                f"🌱 Cultivo: {device.crop_type}\n"
                f"📊 {alert.variable}: {alert.value} {alert.unit}\n"
                f"📍 {device.location_name}\n"
                f"🕐 {alert.timestamp.strftime('%H:%M')}\n\n"
                f"{alert.message}"
            )
        elif device.vertical == "energia":
            message = (
                f"⚡ *ALERTA {alert.severity.upper()}* — {device.name}\n"
                f"📊 {alert.variable}: {alert.value} {alert.unit}\n"
                f"📍 {device.location_name}\n"
                f"🕐 {alert.timestamp.strftime('%H:%M')}\n\n"
                f"{alert.message}"
            )

        self.client.messages.create(
            from_='whatsapp:+14155238886',
            to=f'whatsapp:{phone}',
            body=message
        )
```

### Email: Resend

```python
# notifications/email.py
import resend

resend.api_key = settings.RESEND_API_KEY

async def send_alert_email(to: str, alert: Alert, device: Device):
    resend.Emails.send({
        "from": "alertas@tudominio.com",
        "to": to,
        "subject": f"[{alert.severity.upper()}] Alerta en {device.name}",
        "html": render_alert_template(alert, device)
    })
```

Plan gratuito de Resend: 3,000 emails/mes — suficiente para MVP.

### Webhook (para integraciones)

```python
# notifications/webhook.py
import httpx

async def send_webhook(url: str, payload: dict):
    async with httpx.AsyncClient() as client:
        await client.post(url, json=payload, timeout=10.0)
```

---

## 8. Infraestructura y DevOps

### Servidor: Hetzner VPS

**Por qué Hetzner sobre AWS para MVP:**
- AWS tiene curva de aprendizaje alta y costos impredecibles
- Hetzner: hardware de calidad, datacenter en EU/US, precios fijos

**Configuración recomendada MVP:**

```
CX31 (€12.49/mes):
  - 2 vCPU AMD
  - 8 GB RAM
  - 80 GB NVMe SSD
  - 20 TB bandwidth

Suficiente para: hasta ~500 dispositivos con lecturas cada 60 segundos
```

Cuando escales a 1,000+ dispositivos: migrar a CX41 (€18.49/mes, 4 vCPU, 16GB RAM).

### Docker Compose completo

```yaml
# docker-compose.yml
version: '3.8'

services:

  # Message Broker
  emqx:
    image: emqx/emqx:5.4
    restart: always
    ports:
      - "1883:1883"
      - "8883:8883"
      - "8083:8083"
    environment:
      - EMQX_DASHBOARD__DEFAULT_PASSWORD=${EMQX_ADMIN_PASSWORD}
    volumes:
      - emqx_data:/opt/emqx/data
    networks:
      - iot_network

  # Base de datos
  timescaledb:
    image: timescale/timescaledb:latest-pg15
    restart: always
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ruwi_iot
    volumes:
      - timescale_data:/var/lib/postgresql/data
      - ./sql/init.sql:/docker-entrypoint-initdb.d/init.sql
    networks:
      - iot_network

  # Cache y Queue
  redis:
    image: redis:7-alpine
    restart: always
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    networks:
      - iot_network

  # Backend API
  backend:
    build: ./backend
    restart: always
    env_file: .env
    depends_on:
      - timescaledb
      - redis
      - emqx
    ports:
      - "8000:8000"
    networks:
      - iot_network

  # Frontend
  frontend:
    build: ./frontend
    restart: always
    ports:
      - "3000:80"
    networks:
      - iot_network

  # Reverse proxy + SSL
  nginx:
    image: nginx:alpine
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
      - certbot_data:/etc/letsencrypt
    depends_on:
      - backend
      - frontend
    networks:
      - iot_network

volumes:
  emqx_data:
  timescale_data:
  redis_data:
  certbot_data:

networks:
  iot_network:
    driver: bridge
```

### Variables de entorno (.env)

```bash
# Base de datos
DB_USER=ruwi
DB_PASSWORD=supersecurepassword
DB_HOST=timescaledb
DB_PORT=5432
DB_NAME=ruwi_iot

# Redis
REDIS_PASSWORD=redispassword

# JWT
JWT_SECRET_KEY=your-256-bit-secret
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=1440

# EMQX
EMQX_ADMIN_PASSWORD=adminpassword
MQTT_HOST=emqx
MQTT_PORT=1883

# Notificaciones
TWILIO_SID=ACxxx
TWILIO_TOKEN=xxx
TWILIO_WHATSAPP_FROM=+14155238886

RESEND_API_KEY=re_xxx

# App
ENVIRONMENT=production
DEBUG=false
```

### CI/CD: GitHub Actions

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Run tests
        run: |
          cd backend
          pip install -r requirements.txt
          pytest tests/ -v

      - name: Deploy via SSH
        uses: appleboy/ssh-action@v0.1.10
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: deploy
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /opt/ruwi-iot
            git pull origin main
            docker compose pull
            docker compose up -d --build
            docker compose exec backend alembic upgrade head
```

### SSL/TLS con Let's Encrypt

```bash
# Obtener certificado gratuito
docker run --rm -v certbot_data:/etc/letsencrypt certbot/certbot \
  certonly --standalone -d tudominio.com -d api.tudominio.com \
  --email tu@email.com --agree-tos
```

---

## 9. Resumen del Stack

| Capa | Tecnología | Versión | Licencia | Costo |
|------|-----------|---------|----------|-------|
| Protocolo IoT | MQTT | 3.1.1 / 5.0 | Open | Gratis |
| Message Broker | EMQX | 5.4 | Open Source | Gratis |
| LoRaWAN NS | ChirpStack | 4.x | MIT | Gratis |
| Backend Framework | FastAPI | 0.110+ | MIT | Gratis |
| Lenguaje Backend | Python | 3.11+ | PSF | Gratis |
| Base de datos | TimescaleDB | pg15 | Apache 2.0 | Gratis |
| Cache / Queue | Redis | 7 | BSD | Gratis |
| AI / Analytics | scikit-learn + Pandas | latest | BSD | Gratis |
| Frontend | React + TypeScript | 18 | MIT | Gratis |
| Build Tool | Vite | 5.x | MIT | Gratis |
| Gráficas | Apache ECharts | 5.x | Apache 2.0 | Gratis |
| Mapas | Leaflet | 1.9 | BSD | Gratis |
| State | Zustand | 4.x | MIT | Gratis |
| Data Fetching | TanStack Query | 5.x | MIT | Gratis |
| UI Components | shadcn/ui | latest | MIT | Gratis |
| Reverse Proxy | Nginx | alpine | BSD | Gratis |
| SSL | Let's Encrypt | — | — | Gratis |
| Contenedores | Docker + Compose | 24+ | Apache 2.0 | Gratis |
| CI/CD | GitHub Actions | — | — | Gratis |
| Servidor | Hetzner CX31 | — | — | €12.49/mes |
| Notif. WhatsApp | Twilio | — | — | ~$0.005/msg |
| Notif. Email | Resend | — | — | Gratis ≤3k/mes |

**Costo total infraestructura MVP: ~€15/mes (~$16 USD)**

---

## 10. Roadmap Técnico por Fases

### Fase 1 — MVP (0 a 4 meses)

```
Mes 1-2: Core Platform
  ✓ Setup infraestructura Docker en Hetzner
  ✓ EMQX broker funcionando
  ✓ Backend FastAPI: ingesta MQTT, API REST básica
  ✓ TimescaleDB: schema de sensores y organizaciones
  ✓ Autenticación JWT + multi-tenancy básico
  ✓ Frontend: mapa de dispositivos + gráficas básicas

Mes 3: Vertical Module
  ✓ Motor de reglas con umbrales pre-configurados (agro O energía)
  ✓ Detección de anomalías básica (Z-score)
  ✓ Notificaciones WhatsApp + Email
  ✓ WebSocket para datos en tiempo real

Mes 4: Hardening y Pilots
  ✓ KPIs verticales en dashboard
  ✓ Predicción de tendencia (regresión lineal)
  ✓ Tests de carga (Locust)
  ✓ 3-5 clientes piloto conectados
```

### Fase 2 — Post-tracción (4 a 12 meses)

```
  → Edge AI: gateway con inferencia local (sin internet)
  → Modelos ML más sofisticados (Isolation Forest, LSTM)
  → Segunda vertical (agro → energía o viceversa)
  → API pública para integraciones de terceros
  → Mobile app básica (React Native)
  → Migrar a Kubernetes cuando superes 50 clientes
```

### Fase 3 — Escala (12+ meses)

```
  → Modelos entrenados con data local peruana/latinoamericana
  → Marketplace de integraciones hardware
  → White-label para integradores
  → Expansión regional (Colombia, Ecuador, Bolivia)
```

---

## 11. Errores Críticos a Evitar

### ❌ Error 1: Microservicios desde el inicio
Un monolito bien estructurado con FastAPI soporta sin problema hasta 50-100 clientes y miles de dispositivos. Los microservicios agregan complejidad operacional que ralentiza el desarrollo cuando más necesitas velocidad.

### ❌ Error 2: Construir ambas verticales simultáneamente
El stack es el mismo, pero los módulos verticales (KPIs, umbrales, modelos, UX del dashboard) son completamente distintos. Lanza con una sola vertical, valida con clientes reales, luego construye la segunda.

### ❌ Error 3: Rule engine genérico
Ubidots ya tiene eso. Tu ventaja es que las reglas vienen pre-configuradas para el dominio. Empieza con umbrales hardcodeados por cultivo/equipo si es necesario — puedes hacer el sistema más configurable después.

### ❌ Error 4: InfluxDB como base de datos
InfluxDB es popular pero su query language (Flux) es poco estándar, y perderás la flexibilidad relacional que necesitas para el resto del negocio. TimescaleDB al ser PostgreSQL te da lo mejor de ambos mundos.

### ❌ Error 5: Empezar con AWS
Curva de aprendizaje alta, costos variables difíciles de predecir, complejidad de configuración innecesaria para un MVP. Hetzner VPS + Docker Compose es suficiente para validar el producto.

### ❌ Error 6: Ignorar WhatsApp en Latam
Plataformas gringas mandan alertas por email. Tus clientes en Perú viven en WhatsApp. Esta diferencia aparentemente pequeña puede ser un factor decisivo en la adopción del producto.

---

## 12. Estimación de Costos Mensuales

### Infraestructura (MVP — hasta ~500 dispositivos)

| Ítem | Costo mensual |
|------|--------------|
| Hetzner CX31 (servidor principal) | €12.49 |
| Dominio (.com) | ~€1.00 |
| SSL (Let's Encrypt) | €0.00 |
| Backup VPS (Hetzner snapshot) | €0.39 |
| **Total infraestructura** | **~€14/mes** |

### Servicios externos (variable)

| Ítem | Estimado (100 alertas/mes) |
|------|---------------------------|
| Twilio WhatsApp | ~$0.50 |
| Resend Email | $0.00 (plan gratuito) |
| GitHub (código + CI/CD) | $0.00 |
| **Total servicios** | **~$0.50/mes** |

### Costo total operacional MVP: **~$16 USD/mes**

---

*Documento preparado para Ruwi Lab | Stack IoT MVP — Camino 1: Plataforma Vertical-Native*  
*Versión 1.0 — Marzo 2026*
