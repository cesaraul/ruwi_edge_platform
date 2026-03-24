-- ============================================================
-- init.sql — Schema completo Ruwi IoT Platform
-- TimescaleDB (PostgreSQL 15) — sin PostGIS para compatibilidad ARM64
-- ============================================================

CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLAS RELACIONALES
-- ============================================================

CREATE TABLE organizations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(100) NOT NULL,
    vertical    VARCHAR(20),
    plan        VARCHAR(20) DEFAULT 'starter',
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email           VARCHAR(100) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    role            VARCHAR(20) DEFAULT 'viewer',
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
    vertical        VARCHAR(20) NOT NULL,
    status          VARCHAR(20) DEFAULT 'offline',
    lat             DECIMAL(10, 8),
    lng             DECIMAL(11, 8),
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
    device_id        UUID REFERENCES devices(id) ON DELETE CASCADE,
    name             VARCHAR(100) NOT NULL,
    variable         VARCHAR(50) NOT NULL,
    operator         VARCHAR(10) NOT NULL,
    threshold_low    DOUBLE PRECISION,
    threshold_high   DOUBLE PRECISION,
    severity         VARCHAR(10) NOT NULL DEFAULT 'warning',
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
    clientid      VARCHAR(100) PRIMARY KEY,
    password_hash VARCHAR(255) NOT NULL,
    device_id     UUID REFERENCES devices(id)
);

-- ============================================================
-- HYPERTABLES (series de tiempo)
-- ============================================================

CREATE TABLE sensor_readings (
    time        TIMESTAMPTZ NOT NULL,
    device_id   UUID NOT NULL,
    org_id      UUID NOT NULL,
    vertical    VARCHAR(20) NOT NULL,
    variable    VARCHAR(50) NOT NULL,
    value       DOUBLE PRECISION NOT NULL,
    unit        VARCHAR(20),
    quality     SMALLINT DEFAULT 100
);

SELECT create_hypertable('sensor_readings', 'time',
    chunk_time_interval => INTERVAL '1 day'
);

ALTER TABLE sensor_readings SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'device_id,variable',
    timescaledb.compress_orderby   = 'time DESC'
);

SELECT add_compression_policy('sensor_readings', INTERVAL '7 days');
SELECT add_retention_policy('sensor_readings', INTERVAL '2 years');

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

CREATE TABLE device_heartbeats (
    time      TIMESTAMPTZ NOT NULL,
    device_id UUID NOT NULL,
    battery   SMALLINT,
    rssi      SMALLINT
);

SELECT create_hypertable('device_heartbeats', 'time');

-- ============================================================
-- ÍNDICES
-- ============================================================

CREATE INDEX idx_readings_device_time
    ON sensor_readings (device_id, time DESC);

CREATE INDEX idx_readings_device_variable_time
    ON sensor_readings (device_id, variable, time DESC);

CREATE INDEX idx_alerts_org_ack
    ON alerts_log (org_id, acknowledged, time DESC);

CREATE INDEX idx_readings_org_time
    ON sensor_readings (org_id, time DESC);

-- ============================================================
-- VISTA CONTINUA (promedio horario — acelera gráficas 7d/30d)
-- ============================================================

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
GROUP BY bucket, device_id, variable
WITH NO DATA;

SELECT add_continuous_aggregate_policy('readings_hourly',
    start_offset      => INTERVAL '3 hours',
    end_offset        => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour'
);
