# Guía de Integración de Dispositivos — Ruwi IoT Platform
> Cómo conectar sensores y equipos a la plataforma
> Versión: 1.0 | Marzo 2026

---

## Tabla de Contenidos

1. [Métodos de Transmisión](#1-métodos-de-transmisión)
2. [Método 1 — MQTT (recomendado)](#2-método-1--mqtt-recomendado)
3. [Método 2 — HTTP REST (fallback)](#3-método-2--http-rest-fallback)
4. [Estructura de Topics MQTT](#4-estructura-de-topics-mqtt)
5. [Formato JSON — Telemetría](#5-formato-json--telemetría)
6. [Formato JSON — Estado del dispositivo](#6-formato-json--estado-del-dispositivo)
7. [Variables por Vertical](#7-variables-por-vertical)
8. [Credenciales y Autenticación](#8-credenciales-y-autenticación)
9. [Código de ejemplo — ESP32 (Arduino/C++)](#9-código-de-ejemplo--esp32-arduinoc)
10. [Código de ejemplo — MicroPython](#10-código-de-ejemplo--micropython)
11. [Pruebas con MQTTX o mosquitto_pub](#11-pruebas-con-mqttx-o-mosquitto_pub)
12. [Errores comunes](#12-errores-comunes)

---

## 1. Métodos de Transmisión

| Método | Cuándo usar | Autenticación |
|--------|-------------|---------------|
| **MQTT** | Dispositivos con conectividad estable (ESP32, RPi, etc.) | Usuario + contraseña MQTT |
| **HTTP POST** | Dispositivos legacy, equipos industriales, pruebas rápidas | `X-Api-Key` header |

---

## 2. Método 1 — MQTT (recomendado)

### Conexión al broker

| Parámetro | Valor |
|-----------|-------|
| Host | IP del servidor Ruwi (ej. `192.168.1.100`) |
| Puerto MQTT | `1883` (sin TLS) |
| Puerto MQTT+TLS | `8883` (con TLS) |
| Puerto MQTT-WebSocket | `8083` |
| Usuario | API Key del dispositivo (ver sección 8) |
| Contraseña | Contraseña asignada al dispositivo |
| Client ID | UUID del dispositivo (ej. `550e8400-e29b-41d4-a716-446655440000`) |
| QoS telemetría | `0` (at-most-once, alta frecuencia) |
| QoS alertas/comandos | `1` (at-least-once) |

---

## 3. Método 2 — HTTP REST (fallback)

```
POST http://<servidor>:8000/api/v1/devices/ingest
Content-Type: application/json
X-Api-Key: <api_key_del_dispositivo>
```

No requiere mantener conexión persistente. Útil para dispositivos que envían datos cada varios minutos.

---

## 4. Estructura de Topics MQTT

```
/{vertical}/{org_id}/{device_id}/{tipo}
```

| Segmento | Valores posibles | Ejemplo |
|----------|-----------------|---------|
| `vertical` | `agro`, `energia` | `agro` |
| `org_id` | UUID de la organización | `a1b2c3d4-...` |
| `device_id` | UUID del dispositivo | `550e8400-...` |
| `tipo` | `telemetry`, `status`, `commands` | `telemetry` |

### Ejemplos de topics

```
# Sensor agrícola publicando datos
/agro/a1b2c3d4-e5f6-7890-abcd-ef1234567890/550e8400-e29b-41d4-a716-446655440000/telemetry

# Medidor eléctrico publicando datos
/energia/a1b2c3d4-e5f6-7890-abcd-ef1234567890/660f9511-f3ac-52e5-b827-557766551111/telemetry

# Heartbeat del dispositivo
/agro/a1b2c3d4-.../550e8400-.../status

# Comandos hacia el dispositivo (el dispositivo suscribe a este topic)
/agro/a1b2c3d4-.../550e8400-.../commands
```

---

## 5. Formato JSON — Telemetría

Este es el payload que el dispositivo **publica** en el topic `telemetry`.

### Estructura completa

```json
{
  "device_id": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2026-03-20T18:30:00Z",
  "variables": {
    "variable_1": 42.5,
    "variable_2": 18.3
  },
  "metadata": {}
}
```

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `device_id` | string (UUID) | No* | Identificador del dispositivo. El backend lo extrae del topic |
| `timestamp` | string (ISO 8601) | **No (omitir)** | El backend usa la hora de recepción del servidor. Más confiable que el reloj del dispositivo |
| `variables` | object | **Sí** | Mapa de variables con sus valores numéricos |
| `metadata` | object | No | Campos extra libres |

> *El `device_id` en el payload es informativo. El backend usa el `device_id` del topic para identificar el dispositivo.

### Ejemplo mínimo (recomendado para dispositivos sin RTC)

```json
{
  "variables": {
    "temperature": 18.3,
    "soil_moisture": 42.5
  }
}
```

> **Sobre el timestamp:** Los dispositivos IoT generalmente no tienen reloj en tiempo real (RTC) ni acceso a NTP. **Omite el campo `timestamp`** — el backend registra la hora exacta de recepción en el servidor, que es más confiable que cualquier valor generado por el dispositivo. Solo inclúyelo si el dispositivo tiene RTC con batería o NTP sincronizado.

### Ejemplo completo — sensor agrícola (agro)

```json
{
  "device_id": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2026-03-20T18:30:00Z",
  "variables": {
    "soil_moisture": 42.5,
    "temperature": 18.3,
    "humidity": 67.0,
    "battery": 85,
    "rssi": -72
  },
  "metadata": {
    "crop_type": "papa_andina",
    "altitude_msnm": 3800
  }
}
```

### Ejemplo completo — medidor eléctrico (energía)

```json
{
  "device_id": "660f9511-f3ac-52e5-b827-557766551111",
  "timestamp": "2026-03-20T18:30:01Z",
  "variables": {
    "voltage": 220.3,
    "current": 12.5,
    "power_factor": 0.92,
    "power_kw": 2.75,
    "oil_temp": 72.0,
    "load_pct": 85.0
  }
}
```

### Reglas del campo `variables`

- Los valores deben ser **numéricos** (`int` o `float`)
- Los valores `null`, `string`, `bool` son ignorados
- Los nombres de variables son **libres** — el sistema los almacena tal cual
- Las variables con nombres estándar activan los umbrales automáticos (ver sección 7)

---

## 6. Formato JSON — Estado del dispositivo

El dispositivo publica en el topic `status` para indicar que está vivo (heartbeat).
Recomendado: **cada 60 segundos**.

```json
{
  "online": true,
  "battery": 85,
  "rssi": -72
}
```

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `online` | bool | No | Estado general |
| `battery` | int (0–100) | No | Nivel de batería en % |
| `rssi` | int (negativo) | No | Señal WiFi en dBm |

> Si el dispositivo no publica en `status` o `telemetry` por más de **2 minutos**, el sistema lo marca automáticamente como `offline` y lo notifica al dashboard.

---

## 7. Variables por Vertical

Estas son las variables con nombres **estándar** que activan el motor de reglas automáticas. Puedes enviar cualquier nombre de variable, pero solo estas generan alertas automáticas sin configuración adicional.

### Vertical: Agro

| Variable | Unidad | Rango normal | Alerta |
|----------|--------|-------------|--------|
| `soil_moisture` | % | 35–75 | `< 25` crítico, `< 35` warning |
| `temperature` | °C | 5–25 | `< -2` crítico (helada), `< 5` warning |
| `humidity` | % | 40–90 | Fuera del rango: warning |
| `battery` | % | 20–100 | `< 20` warning |

**Umbrales por cultivo (papa andina):**

| Variable | Warning bajo | Crítico bajo | Warning alto | Crítico alto |
|----------|-------------|-------------|-------------|-------------|
| `soil_moisture` | 35% | 25% | 75% | 85% |
| `temperature` | 5°C | -2°C | 25°C | 30°C |

**Umbrales por cultivo (maíz costa):**

| Variable | Warning bajo | Crítico bajo | Warning alto | Crítico alto |
|----------|-------------|-------------|-------------|-------------|
| `soil_moisture` | 50% | 40% | 80% | 90% |
| `temperature` | 15°C | 10°C | 35°C | 40°C |

---

### Vertical: Energía

| Variable | Unidad | Rango normal | Alerta |
|----------|--------|-------------|--------|
| `voltage` | V | 207–233 | `< 198` o `> 242` crítico |
| `current` | A | 0–100 | `> 100` warning |
| `power_factor` | 0.00–1.00 | 0.85–1.00 | `< 0.75` crítico, `< 0.85` warning |
| `power_kw` | kW | Depende del equipo | — |
| `oil_temp` | °C | 0–85 | `> 85` warning, `> 105` crítico |
| `load_pct` | % | 0–90 | `> 90` warning, `> 110` crítico |
| `efficiency_pct` | % | 70–100 | `< 50` crítico, `< 70` warning |

---

## 8. Credenciales y Autenticación

### Sobre los IDs (org_id y device_id)

Los IDs son **UUIDs v4** generados automáticamente por el backend — formato `550e8400-e29b-41d4-a716-446655440000`. **El dispositivo no los elige**, tampoco el administrador.

El flujo correcto es:

```
1. Admin crea el dispositivo via API (POST /api/v1/devices)
2. Backend genera automáticamente:
     - device_id  → UUID v4 único e irrepetible
     - api_key    → 64 caracteres hex aleatorios
3. Admin copia device_id y api_key de la respuesta JSON
4. Admin flashea el firmware con esos valores hardcodeados
```

No se puede usar `ruwi0001` o `device0001` — el backend, la base de datos y el parser MQTT rechazan cualquier formato que no sea UUID v4 válido. El UUID es feo de leer pero nunca se escribe a mano: se copia del API response al firmware una sola vez.

---

### ¿Cómo obtiene un dispositivo sus credenciales?

1. El administrador crea el dispositivo en la plataforma via API o dashboard
2. El sistema genera automáticamente una **API Key** única (64 caracteres hex)
3. Esa API Key es la credencial del dispositivo

### Para MQTT

| Campo | Valor |
|-------|-------|
| **Usuario** | La `api_key` del dispositivo |
| **Contraseña** | La `api_key` del dispositivo (mismo valor) |
| **Client ID** | El `device_id` (UUID) del dispositivo |

> Durante el MVP, usuario y contraseña son la misma API Key. En producción se pueden separar.

### Para HTTP

```
Header: X-Api-Key: <api_key_del_dispositivo>
```

### Crear un dispositivo y obtener credenciales (via API)

**1. Login como admin:**
```bash
curl -X POST http://<servidor>:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@org.com", "password": "tu_password"}'
```

Respuesta:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 86400
}
```

**2. Crear el dispositivo:**
```bash
curl -X POST http://<servidor>:8000/api/v1/devices \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Sensor Parcela Norte",
    "type": "soil_sensor",
    "vertical": "agro",
    "lat": -15.4915,
    "lng": -70.1399,
    "location_name": "Parcela Norte — Puno",
    "altitude_msnm": 3850,
    "crop_type": "papa_andina"
  }'
```

Respuesta (guarda el `id` y el `api_key`):
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Sensor Parcela Norte",
  "vertical": "agro",
  "api_key": "a3f8c2d1e4b7a9f0c2e5d8b1a4f7c0e3d6b9a2f5c8e1d4b7a0f3c6e9d2b5a8f1",
  ...
}
```

---

## 9. Código de ejemplo — ESP32 (Arduino/C++)

```cpp
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

// ── Configuración ─────────────────────────────────────────
const char* WIFI_SSID     = "tu_red_wifi";
const char* WIFI_PASSWORD = "tu_password_wifi";

const char* MQTT_HOST     = "192.168.1.100";  // IP del servidor Ruwi
const int   MQTT_PORT     = 1883;

// Credenciales del dispositivo (obtenidas al crear el dispositivo)
const char* DEVICE_ID     = "550e8400-e29b-41d4-a716-446655440000";
const char* API_KEY       = "a3f8c2d1e4b7a9f0c2e5d8b1a4f7c0e3...";
const char* ORG_ID        = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const char* VERTICAL      = "agro";

// Topics
char TOPIC_TELEMETRY[200];
char TOPIC_STATUS[200];

// ── Variables de sensores ─────────────────────────────────
// (reemplazar con lecturas reales)
float readSoilMoisture() { return 42.5; }
float readTemperature()  { return 18.3; }
float readHumidity()     { return 67.0; }
int   readBattery()      { return 85;   }

// ─────────────────────────────────────────────────────────
WiFiClient espClient;
PubSubClient client(espClient);

void connectWiFi() {
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
  }
}

void connectMQTT() {
  while (!client.connected()) {
    // Usuario y contraseña = API Key del dispositivo
    if (client.connect(DEVICE_ID, API_KEY, API_KEY)) {
      // Suscribirse a comandos
      char topicCmd[200];
      snprintf(topicCmd, sizeof(topicCmd), "/%s/%s/%s/commands", VERTICAL, ORG_ID, DEVICE_ID);
      client.subscribe(topicCmd);
    } else {
      delay(5000);
    }
  }
}

void publishTelemetry() {
  StaticJsonDocument<256> doc;

  doc["device_id"] = DEVICE_ID;

  // NO incluir timestamp — el backend usa la hora de recepción del servidor
  // (más confiable que el reloj del dispositivo)

  JsonObject variables = doc.createNestedObject("variables");
  variables["soil_moisture"] = readSoilMoisture();
  variables["temperature"]   = readTemperature();
  variables["humidity"]      = readHumidity();
  variables["battery"]       = readBattery();

  char payload[256];
  serializeJson(doc, payload);

  client.publish(TOPIC_TELEMETRY, payload, false);  // QoS 0
}

void publishStatus() {
  StaticJsonDocument<128> doc;
  doc["online"]  = true;
  doc["battery"] = readBattery();
  doc["rssi"]    = WiFi.RSSI();

  char payload[128];
  serializeJson(doc, payload);
  client.publish(TOPIC_STATUS, payload, false);
}

void callback(char* topic, byte* payload, unsigned int length) {
  // Recibir comandos desde el backend
  StaticJsonDocument<128> doc;
  deserializeJson(doc, payload, length);

  const char* action = doc["action"];
  if (strcmp(action, "reboot") == 0) {
    ESP.restart();
  }
}

void setup() {
  snprintf(TOPIC_TELEMETRY, sizeof(TOPIC_TELEMETRY),
           "/%s/%s/%s/telemetry", VERTICAL, ORG_ID, DEVICE_ID);
  snprintf(TOPIC_STATUS, sizeof(TOPIC_STATUS),
           "/%s/%s/%s/status", VERTICAL, ORG_ID, DEVICE_ID);

  connectWiFi();
  client.setServer(MQTT_HOST, MQTT_PORT);
  client.setCallback(callback);
}

unsigned long lastTelemetry = 0;
unsigned long lastStatus    = 0;

void loop() {
  if (!client.connected()) connectMQTT();
  client.loop();

  unsigned long now = millis();

  // Telemetría cada 60 segundos
  if (now - lastTelemetry >= 60000) {
    publishTelemetry();
    lastTelemetry = now;
  }

  // Heartbeat cada 60 segundos
  if (now - lastStatus >= 60000) {
    publishStatus();
    lastStatus = now;
  }
}
```

---

## 10. Código de ejemplo — MicroPython

```python
import ujson
import utime
from umqtt.simple import MQTTClient
import network

# ── Configuración ─────────────────────────────────────────
WIFI_SSID     = "tu_red_wifi"
WIFI_PASSWORD = "tu_password_wifi"
MQTT_HOST     = "192.168.1.100"
MQTT_PORT     = 1883

DEVICE_ID = "550e8400-e29b-41d4-a716-446655440000"
API_KEY   = "a3f8c2d1e4b7a9f0c2e5d8b1a4f7c0e3..."
ORG_ID    = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
VERTICAL  = "agro"

TOPIC_TELEMETRY = f"/{VERTICAL}/{ORG_ID}/{DEVICE_ID}/telemetry".encode()
TOPIC_STATUS    = f"/{VERTICAL}/{ORG_ID}/{DEVICE_ID}/status".encode()

# ── WiFi ──────────────────────────────────────────────────
wlan = network.WLAN(network.STA_IF)
wlan.active(True)
wlan.connect(WIFI_SSID, WIFI_PASSWORD)
while not wlan.isconnected():
    utime.sleep(0.5)

# ── MQTT ──────────────────────────────────────────────────
client = MQTTClient(
    client_id=DEVICE_ID,
    server=MQTT_HOST,
    port=MQTT_PORT,
    user=API_KEY,      # usuario = API Key
    password=API_KEY,  # contraseña = API Key
)
client.connect()

def publish_telemetry():
    # NO incluir timestamp — el backend usa la hora de recepción del servidor
    payload = ujson.dumps({
        "variables": {
            "soil_moisture": 42.5,   # reemplazar con lectura ADC real
            "temperature":   18.3,
            "humidity":      67.0,
            "battery":       85,
        }
    })
    client.publish(TOPIC_TELEMETRY, payload)

def publish_status():
    payload = ujson.dumps({
        "online":  True,
        "battery": 85,
    })
    client.publish(TOPIC_STATUS, payload)

# ── Loop principal ────────────────────────────────────────
while True:
    publish_telemetry()
    publish_status()
    utime.sleep(60)
```

---

## 11. Pruebas con MQTTX o mosquitto_pub

### Usando mosquitto_pub (desde terminal)

```bash
# Instalar: sudo apt install mosquitto-clients

# Publicar telemetría de prueba
mosquitto_pub \
  -h 192.168.1.100 \
  -p 1883 \
  -u "a3f8c2d1e4b7a9f0c2e5d8b1a4f7c0e3..." \
  -P "a3f8c2d1e4b7a9f0c2e5d8b1a4f7c0e3..." \
  -t "/agro/a1b2c3d4-e5f6-7890-abcd-ef1234567890/550e8400-e29b-41d4-a716-446655440000/telemetry" \
  -m '{"variables": {"soil_moisture": 42.5, "temperature": 18.3, "battery": 85}}'

# Publicar status
mosquitto_pub \
  -h 192.168.1.100 -p 1883 \
  -u "<api_key>" -P "<api_key>" \
  -t "/agro/<org_id>/<device_id>/status" \
  -m '{"online": true, "battery": 85, "rssi": -65}'
```

### Usando HTTP (curl)

```bash
# Ingesta por HTTP (sin MQTT)
curl -X POST http://192.168.1.100:8000/api/v1/devices/ingest \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: a3f8c2d1e4b7a9f0c2e5d8b1a4f7c0e3..." \
  -d '{
    "variables": {
      "soil_moisture": 42.5,
      "temperature": 18.3,
      "battery": 85
    }
  }'
```

Respuesta esperada: `{"status": "accepted"}`

---

## 12. Errores comunes

| Error | Causa probable | Solución |
|-------|---------------|----------|
| Conexión MQTT rechazada | API Key incorrecta | Verificar `api_key` del dispositivo en la plataforma |
| El dispositivo aparece `offline` | No envía heartbeat en +2 min | Publicar en topic `/status` cada 60s |
| Variables no aparecen en dashboard | Nombre de variable incorrecto | Verificar que `variables` tenga valores numéricos |
| `401 Unauthorized` en HTTP | Header `X-Api-Key` faltante o incorrecto | Incluir el header exactamente como `X-Api-Key` |
| Datos con timestamp erróneo | Formato de fecha incorrecto | Usar ISO 8601 (`2026-03-20T18:30:00Z`) o omitir el campo |
| Las alertas no se disparan | No hay reglas configuradas para ese cultivo/equipo | Verificar en `/api/v1/rules` o crear reglas manualmente |

---

*Documento de integración de dispositivos — Ruwi Lab IoT Platform*
*Versión 1.0 — Marzo 2026*
