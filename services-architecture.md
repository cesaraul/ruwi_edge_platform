# Arquitectura de Servicios — Plataforma IoT Ruwi Lab
> Diseño detallado de la infraestructura: EMQX, TimescaleDB, Redis y red Docker
> Versión: 1.0 | Marzo 2026 | Complementa: `backend-architecture.md`, `stack-iot-mvp.md`

---

## Tabla de Contenidos

1. [Topología de Servicios](#1-topología-de-servicios)
2. [EMQX — Message Broker](#2-emqx--message-broker)
3. [TimescaleDB — Base de Datos](#3-timescaledb--base-de-datos)
4. [Redis — Cache y Queue](#4-redis--cache-y-queue)
5. [Red Docker](#5-red-docker)
6. [docker-compose.yml Completo](#6-docker-composeyml-completo)
7. [Flujos de Datos por Caso de Uso](#7-flujos-de-datos-por-caso-de-uso)
8. [Estrategia de Persistencia y Retención](#8-estrategia-de-persistencia-y-retención)
9. [Monitoreo de Servicios](#9-monitoreo-de-servicios)
10. [Arranque, Orden de Dependencias y Salud](#10-arranque-orden-de-dependencias-y-salud)

---

## 1. Topología de Servicios

```
┌───────────────────────────────────────────────────────────────────────────┐
│                          RED DOCKER: iot_network                           │
│                                                                             │
│  ┌──────────────────┐         ┌──────────────────────────────────────┐    │
│  │   DISPOSITIVOS   │         │            EMQX BROKER               │    │
│  │                  │──MQTT──▶│  Puerto 1883 (MQTT)                  │    │
│  │  ESP32 / LoRa    │         │  Puerto 8083 (MQTT-WS)               │    │
│  │  Modbus / HTTP   │         │  Puerto 8883 (MQTT-TLS)              │    │
│  └──────────────────┘         │  Puerto 18083 (Dashboard admin)      │    │
│           │                   └───────────────┬──────────────────────┘    │
│           │ HTTP fallback                      │ subscribe                 │
│           ▼                                    ▼                           │
│  ┌──────────────────────────────────────────────────────────────────┐     │
│  │                    BACKEND FASTAPI                                │     │
│  │                                                                   │     │
│  │  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────┐   │     │
│  │  │ MQTT Sub    │  │  REST API    │  │  WebSocket Server    │   │     │
│  │  │ (asyncio)   │  │  /api/v1/*   │  │  /ws/{org_id}        │   │     │
│  │  └──────┬──────┘  └──────┬───────┘  └──────────┬───────────┘   │     │
│  │         └────────────────┴──────────────────────┘               │     │
│  │                           │                                       │     │
│  │              Motor de Reglas + Analytics                         │     │
│  └─────────────────┬─────────────────────┬────────────────────────┘     │
│                    │                     │                                 │
│          ┌─────────▼──────┐   ┌──────────▼──────┐                       │
│          │  TIMESCALEDB   │   │     REDIS        │                       │
│          │  Puerto 5432   │   │   Puerto 6379    │                       │
│          │  (PostgreSQL)  │   │   (cache/queue)  │                       │
│          └────────────────┘   └─────────────────┘                       │
│                                                                             │
│  ┌──────────────────┐                                                      │
│  │    FRONTEND      │◀── HTTP :3000 ── Usuarios externos                  │
│  │   NGINX :80      │◀── navegador                                        │
│  └──────────────────┘                                                      │
└───────────────────────────────────────────────────────────────────────────┘

EXTERNO (solo backend):
  Twilio WhatsApp API  →  notificaciones salientes
  Resend Email API     →  notificaciones salientes
```

### Puertos expuestos al host

| Servicio | Puerto Host | Puerto Contenedor | Descripción |
|----------|-------------|-------------------|-------------|
| Frontend | 3000 | 80 | Dashboard web |
| Backend  | 8000 | 8000 | REST API + WebSocket |
| EMQX MQTT | 1883 | 1883 | Dispositivos IoT |
| EMQX MQTT-WS | 8083 | 8083 | MQTT sobre WebSocket |
| EMQX MQTT-TLS | 8883 | 8883 | MQTT seguro |
| EMQX Admin | 18083 | 18083 | Dashboard EMQX |
| TimescaleDB | 5432 | 5432 | Solo acceso interno (no exponer en prod) |
| Redis | — | 6379 | Solo red interna |

---

## 2. EMQX — Message Broker

### Por qué EMQX sobre Mosquitto

| Criterio | Mosquitto | EMQX |
|----------|-----------|------|
| Dashboard admin | No | Sí (web UI completo) |
| Rule engine interno | No | Sí (preprocesamiento sin código) |
| Autenticación por base de datos | Plugin externo | Nativo |
| Clustering | Manual | Nativo |
| Métricas y monitoring | Manual | Nativo (Prometheus) |
| Conexiones concurrentes | ~50k | 1M+ |

### Configuración

```hocon
# emqx/etc/emqx.conf
# Archivo montado en el contenedor via volume

node {
  name = "emqx@127.0.0.1"
  cookie = "ruwi_secret_cookie"
}

listeners.tcp.default {
  bind = "0.0.0.0:1883"
  max_connections = 10000
}

listeners.ws.default {
  bind = "0.0.0.0:8083"
  max_connections = 1000
}

# Autenticación: verificar contra tabla de dispositivos en PostgreSQL
authn-1 {
  mechanism = password_based
  backend   = postgresql
  server    = "timescaledb:5432"
  database  = "ruwi_iot"
  username  = "ruwi"
  password  = "${env:DB_PASSWORD}"
  query     = "SELECT password_hash FROM mqtt_credentials WHERE clientid = ${clientid} LIMIT 1"
}

# Autorización: dispositivos solo pueden publicar en su propio topic
authz-1 {
  type  = postgresql
  server    = "timescaledb:5432"
  database  = "ruwi_iot"
  query = """
    SELECT allow FROM mqtt_acl
    WHERE clientid = ${clientid}
      AND topic    = ${topic}
      AND action   = ${action}
    LIMIT 1
  """
}
```

### Estructura de Topics

```
Telemetría (dispositivo → backend):
  /{vertical}/{org_id}/{device_id}/telemetry

Estado del dispositivo (heartbeat):
  /{vertical}/{org_id}/{device_id}/status
  Payload: { "online": true, "battery": 85, "rssi": -72 }

Comandos (backend → dispositivo):
  /{vertical}/{org_id}/{device_id}/commands
  Payload: { "action": "reboot" | "update_interval", "params": {} }

Sistema:
  /system/{device_id}/heartbeat
  Payload: { "ts": 1741132800 }
```

### QoS recomendado por tipo de mensaje

| Tipo | QoS | Razón |
|------|-----|-------|
| Telemetría de sensores | 0 | Alta frecuencia, pérdida ocasional aceptable |
| Alertas / comandos | 1 | At-least-once, el receptor maneja duplicados |
| Comandos críticos | 2 | Exactly-once garantizado |
| Heartbeat | 0 | Solo indica presencia, no datos críticos |

### EMQX Rule Engine (preprocesamiento sin código)

Reglas configuradas directamente en el dashboard de EMQX:

```sql
-- Regla 1: Reenviar telemetría al backend via webhook
-- (backup si el subscriber MQTT falla)
SELECT * FROM "/+/+/+/telemetry"
  WHERE is_not_null(payload.variables)

-- Regla 2: Guardar heartbeats en base de datos directamente
SELECT clientid, timestamp FROM "/system/+/heartbeat"
  ACTION: insert into timescaledb (tabla device_heartbeats)

-- Regla 3: Alertar si un dispositivo no envía en 5 minutos
-- (usando la función built-in de EMQX para device_offline)
```

---

## 3. TimescaleDB — Base de Datos

### Por qué TimescaleDB sobre InfluxDB

| Criterio | InfluxDB | TimescaleDB |
|----------|----------|-------------|
| Lenguaje de query | Flux (propietario) | SQL estándar |
| Datos relacionales | No | Sí (es PostgreSQL) |
| Joins con otras tablas | No | Sí |
| Migraciones con Alembic | No | Sí |
| Extensiones PostGIS (geometría) | No | Sí (coordenadas GPS) |
| Licencia | BSL (v2+) | Apache 2.0 |
| Compresión automática | Sí | Sí |

### Schema completo

```sql
-- ============================================================
-- EXTENSIONES
-- ============================================================
CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE EXTENSION IF NOT EXISTS postgis;        -- coordenadas GPS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";    -- UUID v4

-- ============================================================
-- TABLAS RELACIONALES (datos de negocio)
-- ============================================================

CREATE TABLE organizations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(100) NOT NULL,
    vertical    VARCHAR(20),
    plan        VARCHAR(20) DEFAULT 'starter',
    created_at  TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email           VARCHAR(100) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    role            VARCHAR(20) DEFAULT 'viewer',   -- 'admin' | 'viewer'
    phone_whatsapp  VARCHAR(20),
    notify_whatsapp BOOLEAN DEFAULT TRUE,
    notify_email    BOOLEAN DEFAULT FALSE,
    active          BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE devices (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name            VARCHAR(100) NOT NULL,
    type            VARCHAR(50) NOT NULL,
    vertical        VARCHAR(20) NOT NULL,            -- 'agro' | 'energia'
    status          VARCHAR(20) DEFAULT 'offline',   -- 'online'|'warning'|'critical'|'offline'
    location        GEOGRAPHY(POINT, 4326),          -- PostGIS: lat/lng
    location_name   VARCHAR(100),
    altitude_msnm   INTEGER,
    crop_type       VARCHAR(50),
    api_key         VARCHAR(64) UNIQUE NOT NULL,
    last_seen       TIMESTAMPTZ,
    metadata        JSONB DEFAULT '{}',
    active          BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE rules (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id           UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    device_id        UUID REFERENCES devices(id) ON DELETE CASCADE,  -- NULL = aplica a todos
    name             VARCHAR(100) NOT NULL,
    variable         VARCHAR(50) NOT NULL,
    operator         VARCHAR(10) NOT NULL,  -- '<' | '>' | 'between'
    threshold_low    DOUBLE PRECISION,
    threshold_high   DOUBLE PRECISION,
    severity         VARCHAR(10) NOT NULL,  -- 'info'|'warning'|'critical'
    notify_whatsapp  BOOLEAN DEFAULT TRUE,
    notify_email     BOOLEAN DEFAULT FALSE,
    notify_webhook   BOOLEAN DEFAULT FALSE,
    webhook_url      TEXT,
    cooldown_min     INTEGER DEFAULT 30,
    active           BOOLEAN DEFAULT TRUE,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Credenciales MQTT para autenticación en EMQX
CREATE TABLE mqtt_credentials (
    clientid      VARCHAR(100) PRIMARY KEY,  -- mismo que device.id
    password_hash VARCHAR(255) NOT NULL,
    device_id     UUID REFERENCES devices(id)
);

-- ACL MQTT (qué topics puede publicar/suscribir cada dispositivo)
CREATE TABLE mqtt_acl (
    id        SERIAL PRIMARY KEY,
    clientid  VARCHAR(100) NOT NULL,
    topic     VARCHAR(200) NOT NULL,
    action    VARCHAR(10) NOT NULL,  -- 'publish' | 'subscribe'
    allow     BOOLEAN DEFAULT TRUE
);

-- ============================================================
-- HYPERTABLES (series de tiempo — particionadas por tiempo)
-- ============================================================

-- Lecturas de sensores (tabla principal, millones de filas)
CREATE TABLE sensor_readings (
    time        TIMESTAMPTZ NOT NULL,
    device_id   UUID NOT NULL,
    org_id      UUID NOT NULL,
    vertical    VARCHAR(20) NOT NULL,
    variable    VARCHAR(50) NOT NULL,
    value       DOUBLE PRECISION NOT NULL,
    unit        VARCHAR(20),
    quality     SMALLINT DEFAULT 100    -- 0-100
);

SELECT create_hypertable('sensor_readings', 'time',
    chunk_time_interval => INTERVAL '1 day'
);

-- Comprimir chunks > 7 días (ahorra ~90% de espacio)
ALTER TABLE sensor_readings SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'device_id, variable',
    timescaledb.compress_orderby   = 'time DESC'
);

SELECT add_compression_policy('sensor_readings', INTERVAL '7 days');

-- Eliminar datos > 2 años (configurable)
SELECT add_retention_policy('sensor_readings', INTERVAL '2 years');

-- Log de alertas disparadas (también particionado por tiempo)
CREATE TABLE alerts_log (
    id              UUID DEFAULT gen_random_uuid(),
    time            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    device_id       UUID NOT NULL,
    org_id          UUID NOT NULL,
    rule_id         UUID,
    severity        VARCHAR(10) NOT NULL,
    variable        VARCHAR(50) NOT NULL,
    value           DOUBLE PRECISION,
    threshold       DOUBLE PRECISION,
    message         TEXT,
    acknowledged    BOOLEAN DEFAULT FALSE,
    acknowledged_by VARCHAR(100),
    acknowledged_at TIMESTAMPTZ,
    PRIMARY KEY (id, time)
);

SELECT create_hypertable('alerts_log', 'time',
    chunk_time_interval => INTERVAL '7 days'
);

-- Heartbeats de dispositivos
CREATE TABLE device_heartbeats (
    time      TIMESTAMPTZ NOT NULL,
    device_id UUID NOT NULL,
    battery   SMALLINT,
    rssi      SMALLINT
);

SELECT create_hypertable('device_heartbeats', 'time');

-- ============================================================
-- ÍNDICES (optimizar queries del frontend)
-- ============================================================

-- Query más común: datos de un dispositivo en las últimas N horas
CREATE INDEX idx_readings_device_time
    ON sensor_readings (device_id, time DESC);

-- Filtrar por variable dentro de un dispositivo
CREATE INDEX idx_readings_device_variable_time
    ON sensor_readings (device_id, variable, time DESC);

-- Alertas no reconocidas por organización (panel de alertas)
CREATE INDEX idx_alerts_org_ack
    ON alerts_log (org_id, acknowledged, time DESC);

-- Último valor de cada variable (usado en VariableCards)
CREATE INDEX idx_readings_org_time
    ON sensor_readings (org_id, time DESC);

-- ============================================================
-- VISTAS CONTINUAS (pre-cálculo automático)
-- ============================================================

-- Promedio horario por dispositivo/variable (acelera gráficas 7d/30d)
CREATE MATERIALIZED VIEW readings_hourly
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', time) AS bucket,
    device_id,
    variable,
    AVG(value)  AS avg_value,
    MIN(value)  AS min_value,
    MAX(value)  AS max_value,
    COUNT(*)    AS sample_count
FROM sensor_readings
GROUP BY bucket, device_id, variable;

SELECT add_continuous_aggregate_policy('readings_hourly',
    start_offset => INTERVAL '3 hours',
    end_offset   => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour'
);

-- ============================================================
-- QUERIES FRECUENTES (ejemplos optimizados)
-- ============================================================

-- 1. Gráfica 24h (usa hypertable directamente)
SELECT time_bucket('15 minutes', time) AS t,
       AVG(value) AS avg
FROM sensor_readings
WHERE device_id = $1 AND variable = $2
  AND time > NOW() - INTERVAL '24 hours'
GROUP BY t ORDER BY t;

-- 2. Gráfica 7d (usa vista continua readings_hourly)
SELECT bucket AS t, avg_value AS avg
FROM readings_hourly
WHERE device_id = $1 AND variable = $2
  AND bucket > NOW() - INTERVAL '7 days'
ORDER BY bucket;

-- 3. Último valor de cada variable (VariableCards del frontend)
SELECT DISTINCT ON (variable)
    variable, value, unit, time
FROM sensor_readings
WHERE device_id = $1
ORDER BY variable, time DESC;

-- 4. Estado de todos los dispositivos de una org
SELECT d.id, d.name, d.status, d.last_seen,
       r.variable, r.value, r.time
FROM devices d
LEFT JOIN LATERAL (
    SELECT variable, value, time
    FROM sensor_readings
    WHERE device_id = d.id
    ORDER BY time DESC
    LIMIT 3
) r ON true
WHERE d.org_id = $1 AND d.active = true;
```

### Política de datos

| Retención | Resolución | Storage estimado (500 devices × 5 vars × 60s) |
|-----------|------------|------------------------------------------------|
| 0–7 días | Raw (cada 60s) | ~180MB |
| 7 días–3 meses | Comprimido (raw) | ~800MB |
| 3–24 meses | Raw comprimido | ~3GB |
| > 24 meses | Eliminado (retention policy) | — |
| **Total** | | **~4GB para 2 años** |

---

## 4. Redis — Cache y Queue

### Bases de datos Redis (namespacing por DB index)

```
DB 0 → Cache de últimas lecturas y rate limiting (TTL corto, 5-30 min)
DB 1 → Cola de notificaciones pendientes
DB 2 → Sesiones WebSocket activas (opcional)
```

### Patrones de uso

```python
# ── 1. Cache del último valor de cada variable (evita query a TimescaleDB) ──
key = f"last:{device_id}:{variable}"
await redis.setex(key, 300, json.dumps({"value": 42.5, "time": "..."}))

# El frontend consulta /telemetry/{id}/latest
# El backend lee de Redis primero, si no existe va a la BD
async def get_latest(device_id, variable):
    cached = await redis.get(f"last:{device_id}:{variable}")
    if cached:
        return json.loads(cached)
    return await db_query_latest(device_id, variable)


# ── 2. Cooldown de alertas (evitar spam de WhatsApp) ──
key = f"alert_cooldown:{rule_id}:{device_id}"
if not await redis.exists(key):
    await send_notification(...)
    await redis.setex(key, rule.cooldown_min * 60, "1")


# ── 3. Estado online/offline de dispositivos (actualización rápida) ──
key = f"device_online:{device_id}"
await redis.setex(key, 120, "1")   # expira a los 2 min sin heartbeat

# Worker que verifica devices offline cada 60 segundos:
async def check_offline_devices():
    while True:
        devices = await db.query_all_active_devices()
        for device in devices:
            is_online = await redis.exists(f"device_online:{device.id}")
            if not is_online and device.status != 'offline':
                await mark_offline(device.id)
                await ws_manager.broadcast_to_org(device.org_id, {
                    "type": "device_status",
                    "device_id": str(device.id),
                    "status": "offline"
                })
        await asyncio.sleep(60)


# ── 4. Cola de notificaciones (desacopla envío del pipeline de ingesta) ──
# Push a la cola (sin bloquear el pipeline principal)
await redis.lpush("notifications", json.dumps({
    "type": "whatsapp",
    "to": "+51999000111",
    "body": "⚠️ Alerta crítica: ...",
    "alert_id": str(alert.id)
}))

# Worker consumidor (proceso separado en background)
async def notification_worker():
    while True:
        item = await redis.brpop("notifications", timeout=5)
        if item:
            notification = json.loads(item[1])
            await process_notification(notification)


# ── 5. Rate limiting de endpoints API (protección básica) ──
key = f"ratelimit:{user_id}:{endpoint}"
count = await redis.incr(key)
if count == 1:
    await redis.expire(key, 60)    # ventana de 1 minuto
if count > 100:
    raise HTTPException(429, "Too many requests")
```

### Configuración Redis

```
maxmemory          256mb           # límite RAM en RPi
maxmemory-policy   allkeys-lru     # evict LRU cuando llega al límite
appendonly         yes             # persistencia AOF
appendfsync        everysec        # fsync cada segundo (balance perf/durabilidad)
save               900 1           # RDB snapshot cada 15 min si hay ≥1 cambio
```

---

## 5. Red Docker

### Diseño de la red interna

```
iot_network (bridge)
  ├── emqx          → emqx:1883, emqx:8083
  ├── timescaledb   → timescaledb:5432
  ├── redis         → redis:6379
  ├── backend       → backend:8000
  └── frontend      → frontend:80

Solo backend tiene acceso a timescaledb y redis.
Solo backend se suscribe a emqx.
Frontend solo habla con backend (proxy Nginx → backend en producción).
timescaledb y redis NO están expuestos al host en producción.
```

### DNS interno

Dentro de la red `iot_network`, cada servicio resuelve por nombre:

```python
# backend/config.py — URLs de servicios
DATABASE_URL = "postgresql+asyncpg://ruwi:pass@timescaledb/ruwi_iot"
REDIS_URL    = "redis://:pass@redis:6379/0"
MQTT_HOST    = "emqx"
MQTT_PORT    = 1883
```

---

## 6. docker-compose.yml Completo

```yaml
# docker-compose.yml — MVP completo
# Raspberry Pi 5 (ARM64) — todas las imágenes son compatibles

services:

  # ── MQTT Broker ──────────────────────────────────────────
  emqx:
    image: emqx/emqx:5.4
    container_name: ruwi_emqx
    restart: unless-stopped
    ports:
      - "1883:1883"     # MQTT (dispositivos)
      - "8083:8083"     # MQTT sobre WebSocket
      - "8883:8883"     # MQTT sobre TLS
      - "18083:18083"   # Dashboard admin (solo acceso local)
    environment:
      EMQX_NAME: ruwi_broker
      EMQX_HOST: "0.0.0.0"
      EMQX_DASHBOARD__DEFAULT_USERNAME: admin
      EMQX_DASHBOARD__DEFAULT_PASSWORD: ${EMQX_ADMIN_PASSWORD}
    volumes:
      - emqx_data:/opt/emqx/data
      - ./emqx/etc/emqx.conf:/opt/emqx/etc/emqx.conf:ro
    networks:
      - iot_network
    healthcheck:
      test: ["CMD", "emqx", "ping"]
      interval: 30s
      timeout: 10s
      retries: 5

  # ── Base de datos ─────────────────────────────────────────
  timescaledb:
    image: timescale/timescaledb-ha:pg15-latest
    container_name: ruwi_timescaledb
    restart: unless-stopped
    environment:
      POSTGRES_USER:     ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB:       ruwi_iot
    volumes:
      - timescale_data:/var/lib/postgresql/data
      - ./sql/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    networks:
      - iot_network
    # NO exponer puerto al host en producción
    # ports: ["5432:5432"]  # solo descomentar para debug local
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER} -d ruwi_iot"]
      interval: 10s
      timeout: 5s
      retries: 10

  # ── Cache y Queue ─────────────────────────────────────────
  redis:
    image: redis:7-alpine
    container_name: ruwi_redis
    restart: unless-stopped
    command: >
      redis-server
      --requirepass ${REDIS_PASSWORD}
      --maxmemory 256mb
      --maxmemory-policy allkeys-lru
      --appendonly yes
      --appendfsync everysec
    volumes:
      - redis_data:/data
    networks:
      - iot_network
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # ── Backend API ───────────────────────────────────────────
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: ruwi_backend
    restart: unless-stopped
    env_file: .env
    ports:
      - "8000:8000"
    depends_on:
      timescaledb:
        condition: service_healthy
      redis:
        condition: service_healthy
      emqx:
        condition: service_healthy
    networks:
      - iot_network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # ── Frontend ──────────────────────────────────────────────
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: ruwi_frontend
    restart: unless-stopped
    ports:
      - "3000:80"
    depends_on:
      - backend
    networks:
      - iot_network

volumes:
  emqx_data:
  timescale_data:
  redis_data:

networks:
  iot_network:
    driver: bridge
```

### Variables de entorno (.env)

```bash
# .env — NO commitear, agregar al .gitignore

# Base de datos
DB_USER=ruwi
DB_PASSWORD=cambia_esto_en_prod
DB_HOST=timescaledb
DB_PORT=5432
DB_NAME=ruwi_iot

# Redis
REDIS_PASSWORD=redis_password_seguro

# JWT
JWT_SECRET_KEY=genera_con_openssl_rand_hex_32

# EMQX
EMQX_ADMIN_PASSWORD=emqx_admin_seguro
MQTT_USER=backend
MQTT_PASSWORD=mqtt_backend_pass

# Notificaciones
TWILIO_SID=ACxxx
TWILIO_TOKEN=xxx
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
RESEND_API_KEY=re_xxx

# App
ENVIRONMENT=production
DEBUG=false
FRONTEND_URL=http://192.168.18.25:3000
```

---

## 7. Flujos de Datos por Caso de Uso

### Caso 1: Lectura normal de sensor (camino feliz)

```
[ESP32]
  │ MQTT PUBLISH
  │ topic: /agro/org-001/device-001/telemetry
  │ payload: { variables: { soil_moisture: 42.5, temp: 18.3 } }
  ▼
[EMQX]
  │ Verifica autenticación (API Key del dispositivo)
  │ Enruta al subscriber
  ▼
[Backend — MQTT Subscriber]
  │ parse_topic() → org-001, device-001, agro
  │ json.loads() → variables
  ├── INSERT sensor_readings (TimescaleDB)   ~2ms
  ├── UPDATE devices SET last_seen (PostgreSQL) ~1ms
  ├── SETEX last:device-001:* (Redis)          ~0.5ms
  ├── RuleEngine.evaluate() → no alerts        ~1ms
  └── ws_manager.broadcast_to_org("org-001")  ~0.5ms
          │
          ▼
[Frontend — WebSocket]
  │ Recibe { type: "reading", device_id, variables }
  ├── wsStore.updateReading() → Zustand
  ├── DeviceMarker re-colorea (verde, sin cambio)
  └── VariableCards actualizan valores
```

**Latencia total: ~50ms extremo a extremo**

### Caso 2: Sensor con temperatura bajo umbral crítico (helada)

```
[ESP32]
  │ MQTT: { variables: { temperature: -1.5 } }
  ▼
[Backend — RuleEngine]
  │ Consulta reglas activas para device-001
  │ Regla: "Helada crítica" → temp < 2°C → severity=critical
  │
  ├── Verifica Redis: ¿existe alert_cooldown:rule-1:device-001? NO
  │
  ├── INSERT alerts_log → TimescaleDB
  ├── SETEX alert_cooldown:rule-1:device-001 1800 (30 min cooldown)
  │
  ├── ws_manager.broadcast_to_org → { type: "alert", data: {...} }
  │       └── Frontend: AlertFeed muestra nueva alerta 🔴
  │           TopBar badge +1
  │
  └── LPUSH notifications → Redis queue
          │
          ▼
[Notification Worker]
  │ BRPOP notifications
  ├── send_whatsapp(+51999xxx) → Twilio API
  │   "🧊 ALERTA CRÍTICA — Sensor Parcela Sur 3
  │    Temperatura: -1.5°C (umbral: 2°C)
  │    Riesgo de helada en papa andina — Puno"
  └── (si notify_email=true) → Resend
```

### Caso 3: Frontend carga gráfica histórica (7 días)

```
[Frontend]
  │ useTelemetry("device-001", "soil_moisture", "7d")
  │ TanStack Query → GET /api/v1/telemetry/device-001?variable=soil_moisture&range=7d
  ▼
[Backend]
  │ Verifica JWT → org-001
  │ Verifica device pertenece a org-001
  │
  ├── range="7d" → usa vista continua readings_hourly
  │   SELECT bucket, avg_value FROM readings_hourly
  │   WHERE device_id=... AND variable=... AND bucket > NOW()-7d
  │   ORDER BY bucket
  │   → 168 puntos, ~5ms
  │
  └── Responde TelemetryResponse { data: [...168 points] }
          │
          ▼
[Frontend]
  │ TimeseriesChart recibe 168 puntos
  └── ECharts renderiza gráfica con área y thresholds
```

---

## 8. Estrategia de Persistencia y Retención

### Qué vive en cada capa

```
┌──────────────────────────────────────────────────────────────────┐
│  REDIS (volátil, rápido, ~50MB)                                  │
│  ├── Últimas lecturas de sensores (TTL: 5 min)                   │
│  ├── Cooldowns de alertas (TTL: configurable, 30 min default)    │
│  ├── Estado online/offline de dispositivos (TTL: 2 min)          │
│  └── Cola de notificaciones pendientes (sin TTL)                 │
├──────────────────────────────────────────────────────────────────┤
│  TIMESCALEDB (persistente, ~4GB para 2 años)                     │
│  ├── Raw: sensor_readings (hypertable) — toda la historia        │
│  ├── Agregado: readings_hourly (vista continua) — precalculado   │
│  ├── alerts_log (hypertable) — historial de alertas              │
│  ├── Tablas relacionales: devices, users, rules, organizations   │
│  └── device_heartbeats (hypertable)                              │
└──────────────────────────────────────────────────────────────────┘
```

### Regla de decisión: ¿Redis o TimescaleDB?

```
¿Necesito el ÚLTIMO valor (VariableCards, popup del mapa)?
  → Redis  (< 1ms, sin query)

¿Necesito una SERIE HISTÓRICA (gráficas)?
  → TimescaleDB (5–20ms, query SQL)

¿Necesito AGREGAR en tiempo real (KPI promedio)?
  → TimescaleDB + continuous aggregate (pre-calculado)

¿Es un estado TEMPORAL (cooldown, online/offline)?
  → Redis con TTL
```

---

## 9. Monitoreo de Servicios

### Health checks (integrados en Docker)

```bash
# Verificar estado de todos los servicios
docker compose ps

# Ver logs en tiempo real
docker compose logs -f backend
docker compose logs -f emqx

# Métricas de TimescaleDB
docker compose exec timescaledb psql -U ruwi ruwi_iot -c "
  SELECT hypertable_name,
         pg_size_pretty(hypertable_size(format('%I', hypertable_name)::regclass))
  FROM timescaledb_information.hypertables;
"

# Estado de compresión
docker compose exec timescaledb psql -U ruwi ruwi_iot -c "
  SELECT * FROM timescaledb_information.compression_settings;
"

# Conexiones MQTT activas en EMQX
curl -u admin:${EMQX_ADMIN_PASSWORD} http://localhost:18083/api/v5/clients
```

### Endpoint /health del backend

```python
# api/v1/health.py
@router.get("/health")
async def health(db: AsyncSession = Depends(get_db)):
    try:
        await db.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        db_ok = False

    redis_ok = await redis.ping()

    return {
        "status": "ok" if (db_ok and redis_ok) else "degraded",
        "database": "ok" if db_ok else "error",
        "redis":    "ok" if redis_ok else "error",
        "version":  "1.0.0",
    }
```

---

## 10. Arranque, Orden de Dependencias y Salud

### Orden de arranque con `depends_on`

```
timescaledb (healthy) ─┐
redis       (healthy) ─┼──▶ backend (healthy) ──▶ frontend
emqx        (healthy) ─┘
```

El backend no arranca hasta que TimescaleDB, Redis y EMQX estén healthy.
Esto es crítico porque el backend ejecuta migraciones con Alembic al arrancar.

### Migraciones automáticas al arrancar

```python
# main.py — ejecutar migraciones antes de aceptar requests
from alembic.config import Config
from alembic import command

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Aplicar migraciones pendientes
    alembic_cfg = Config("alembic.ini")
    command.upgrade(alembic_cfg, "head")

    # Arrancar MQTT subscriber
    mqtt_task = asyncio.create_task(start_mqtt_subscriber())
    # Arrancar worker de notificaciones
    notif_task = asyncio.create_task(notification_worker())
    # Arrancar worker de device offline check
    offline_task = asyncio.create_task(check_offline_devices())

    yield

    mqtt_task.cancel()
    notif_task.cancel()
    offline_task.cancel()
```

### Comandos operacionales de referencia

```bash
# Iniciar todo
docker compose up -d

# Ver logs de un servicio
docker compose logs -f backend

# Reiniciar solo el backend (sin afectar BD)
docker compose restart backend

# Entrar a la BD
docker compose exec timescaledb psql -U ruwi ruwi_iot

# Entrar a Redis
docker compose exec redis redis-cli -a ${REDIS_PASSWORD}

# Ejecutar migraciones manualmente
docker compose exec backend alembic upgrade head

# Ver uso de disco de volumes
docker system df -v
```

---

*Documento de arquitectura de servicios — Ruwi Lab IoT Platform*
*Versión 1.0 — Marzo 2026 | Ver también: `backend-architecture.md`, `stack-iot-mvp.md`*
