# Guía de Usuario — Ruwi IoT Platform
> Cómo acceder, navegar y agregar dispositivos a la plataforma
> Versión 1.1 | Marzo 2026

---

## Tabla de Contenidos

1. [Acceso a la plataforma](#1-acceso-a-la-plataforma)
2. [Navegación principal](#2-navegación-principal)
3. [Mapa de dispositivos](#3-mapa-de-dispositivos)
4. [Lista y detalle de dispositivos](#4-lista-y-detalle-de-dispositivos)
5. [Alertas](#5-alertas)
6. [Analytics y KPIs](#6-analytics-y-kpis)
7. [Agregar un dispositivo nuevo](#7-agregar-un-dispositivo-nuevo)
8. [Conectar un dispositivo físico](#8-conectar-un-dispositivo-físico)
9. [Configurar reglas de alerta](#9-configurar-reglas-de-alerta)
10. [Usuarios y permisos](#10-usuarios-y-permisos)
11. [URLs y puertos del sistema](#11-urls-y-puertos-del-sistema)

---

## 1. Acceso a la plataforma

Abre un navegador y ve a:

```
http://<IP-del-servidor>:3000
```

> Si accedes desde el mismo servidor: `http://localhost:3000`

### Credenciales demo

| Campo | Valor |
|-------|-------|
| Email | `admin@ruwi.io` |
| Contraseña | `demo1234` |

Después del login serás dirigido al mapa principal con los dispositivos activos.

---

## 2. Navegación principal

La barra lateral izquierda contiene:

| Icono | Sección | Descripción |
|-------|---------|-------------|
| Mapa | **Dashboard** | Mapa interactivo + strip de alertas activas |
| Lista | **Dispositivos** | Grilla con todos los sensores y medidores |
| Campana | **Alertas** | Gestión de alertas pendientes y reconocidas |
| Gráfico | **Analytics** | KPIs y tendencias por vertical |
| Engranaje | **Configuración** | Organización, reglas, usuarios |

En la parte superior puedes filtrar por vertical:
- **Todos** — muestra agro + energía
- **Agro** — sensores de suelo, clima, cultivos
- **Energía** — medidores, transformadores, paneles

---

## 3. Mapa de dispositivos

El mapa muestra la ubicación geográfica de cada dispositivo con un marcador de color:

| Color | Estado |
|-------|--------|
| 🟢 Verde | Online — datos recientes |
| 🟡 Amarillo | Warning — alguna variable fuera de rango |
| 🔴 Rojo | Critical — alerta activa |
| ⚫ Gris | Offline — sin datos por más de 2 minutos |

**Al hacer click en un marcador** aparece un popup con:
- Nombre del dispositivo
- Última lectura de las variables principales
- Botón para ir al detalle completo

En la parte inferior del mapa hay un strip con las alertas activas en tiempo real.

---

## 4. Lista y detalle de dispositivos

### Vista de lista (`/devices`)

Muestra todos los dispositivos en tarjetas con:
- Estado (badge de color)
- Variables principales con su valor actual
- Última conexión
- Botones de filtro por vertical y estado

### Vista de detalle (`/devices/:id`)

Al hacer click en un dispositivo verás:

- **Variables actuales** — las lecturas más recientes de cada sensor
- **Gráfico histórico** — selecciona la variable y el rango (1h / 24h / 7d / 30d)
- **Alertas del dispositivo** — historial de alertas generadas
- **Predicciones** — proyección de temperatura (solo agro)

---

## 5. Alertas

La página de alertas (`/alerts`) tiene dos pestañas:

### Pendientes
Alertas activas que requieren atención. Cada alerta muestra:
- Severidad (Critical / Warning)
- Dispositivo y variable afectada
- Valor actual vs umbral configurado
- Mensaje descriptivo
- Tiempo transcurrido

**Reconocer una alerta:** click en el botón "Reconocer" → la alerta pasa a la pestaña de Historial.

### Historial
Alertas ya reconocidas con quién las atendió y cuándo.

---

## 6. Analytics y KPIs

La página de Analytics (`/analytics`) muestra KPIs calculados en tiempo real desde la base de datos:

### Vertical Agro

| KPI | Descripción |
|-----|-------------|
| Dispositivos activos | Sensores con datos en los últimos 2 minutos |
| Humedad suelo promedio | Promedio de `soil_moisture` última hora |
| Riesgo de helada | Dispositivos con temperatura < 2°C |
| Alertas esta semana | Total de alertas generadas en 7 días |

### Vertical Energía

| KPI | Descripción |
|-----|-------------|
| Factor de potencia | Promedio de `power_factor` última hora |
| Consumo 24h | Suma de `power_kw` convertido a kWh |
| Dispositivos activos | Medidores con datos recientes |

---

## 7. Agregar un dispositivo nuevo

Los dispositivos se crean directamente desde la interfaz web, sin necesidad de comandos.

### Paso 1 — Ir a Configuración

En la barra lateral, haz click en el icono de **Engranaje** (Configuración) y luego en la pestaña **Dispositivos**.

Verás la lista de dispositivos registrados con su estado, tipo y última conexión.

### Paso 2 — Abrir el formulario

Haz click en el botón **+ Agregar** (esquina superior derecha de la sección Dispositivos).

Se abre el modal de creación con los siguientes campos:

| Campo | Descripción |
|-------|-------------|
| **Nombre** | Nombre descriptivo del dispositivo (requerido) |
| **Vertical** | Toggle **Agro** / **Energía** — define el sector |
| **Tipo** | Selecciona el tipo según la vertical elegida |
| **Ubicación** | Nombre del lugar (ej: "Puno, Perú") |
| **Latitud / Longitud** | Coordenadas GPS para el mapa (opcionales) |
| **Altitud (msnm)** | Solo relevante para agro |
| **Tipo de cultivo** | Solo visible cuando la vertical es Agro |

### Tipos de dispositivo disponibles

**Vertical Agro:**

| Tipo | Descripción |
|------|-------------|
| `soil_sensor` | Sensor de humedad y temperatura de suelo |
| `weather_station` | Estación meteorológica |

**Vertical Energía:**

| Tipo | Descripción |
|------|-------------|
| `energy_meter` | Medidor de energía eléctrica |
| `transformer_monitor` | Monitor de transformador |
| `solar_monitor` | Monitor de panel solar |

### Paso 3 — Crear y guardar las credenciales

Al hacer click en **Crear dispositivo**, se muestra automáticamente el modal de credenciales con toda la información necesaria para conectar el hardware:

| Dato | Descripción |
|------|-------------|
| **Device ID** | UUID del dispositivo — usar como `DEVICE_ID` en el firmware |
| **Org ID** | UUID de la organización — usar como `ORG_ID` en el firmware |
| **API Key** | Clave secreta — usar como usuario y contraseña MQTT |
| **Topic MQTT** | Topic completo donde publicar telemetría |
| **Payload de ejemplo** | Formato JSON esperado por el servidor |

Cada campo tiene un botón de **copiar al portapapeles**. La API Key puede mostrarse u ocultarse con el ícono de ojo.

> **Importante:** La API Key solo se muestra en este momento. Guárdala antes de cerrar el modal — no se puede recuperar luego.

### Eliminar un dispositivo

En la lista de dispositivos, haz click en el ícono de **papelera** a la derecha del dispositivo. Se pedirá confirmación antes de eliminarlo definitivamente.

---

## 8. Conectar un dispositivo físico

Una vez creado el dispositivo en la plataforma, configura tu hardware.

### Credenciales de conexión

| Parámetro | Valor |
|-----------|-------|
| Servidor MQTT | `<IP-del-servidor>` |
| Puerto | `1883` |
| Usuario MQTT | `<api_key>` |
| Contraseña MQTT | `<api_key>` |
| Client ID | `<device_id>` (UUID) |

### Topic para publicar telemetría

```
/agro/<org_id>/<device_id>/telemetry
/energia/<org_id>/<device_id>/telemetry
```

### Formato del payload (JSON mínimo)

```json
{
  "variables": {
    "soil_moisture": 45.2,
    "temperature": 18.1,
    "humidity": 67.0,
    "battery": 85
  }
}
```

> No incluir `timestamp` — el servidor registra la hora de recepción, que es más confiable.

### Ejemplo ESP32 — publicar telemetría

```cpp
// En setup():
snprintf(topic, sizeof(topic),
  "/agro/%s/%s/telemetry", ORG_ID, DEVICE_ID);

// En loop() cada 60 segundos:
String payload = "{\"variables\":{";
payload += "\"soil_moisture\":" + String(readMoisture(), 1) + ",";
payload += "\"temperature\":" + String(readTemp(), 1) + ",";
payload += "\"battery\":" + String(readBattery());
payload += "}}";
client.publish(topic, payload.c_str());
```

### Prueba rápida desde terminal

```bash
mosquitto_pub \
  -h <IP-servidor> -p 1883 \
  -u "<api_key>" -P "<api_key>" \
  -t "/agro/<org_id>/<device_id>/telemetry" \
  -m '{"variables":{"soil_moisture":45.2,"temperature":18.1}}'
```

Si la conexión es exitosa, el dispositivo aparecerá como **online** en el mapa en segundos.

---

## 9. Configurar reglas de alerta

Las reglas definen cuándo se genera una alerta. Se configuran por dispositivo o para toda la organización.

### Crear una regla

```bash
curl -X POST http://<servidor>:3000/api/v1/rules \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Helada crítica",
    "variable": "temperature",
    "operator": "<",
    "threshold_high": 2.0,
    "severity": "critical",
    "device_id": "<device_id-opcional>",
    "notify_email": true,
    "cooldown_min": 60
  }'
```

### Operadores disponibles

| Operador | Ejemplo | Uso |
|----------|---------|-----|
| `<` | `"< 2.0"` | Alerta si valor menor a umbral |
| `>` | `"> 90.0"` | Alerta si valor mayor a umbral |
| `between` | `threshold_low: 35, threshold_high: 75` | Alerta si sale del rango |

### Reglas recomendadas por tipo de dispositivo

**Sensor de suelo (agro):**

| Variable | Operador | Umbral | Severidad |
|----------|---------|--------|-----------|
| `temperature` | `<` | `2.0` | critical (helada) |
| `temperature` | `<` | `5.0` | warning |
| `soil_moisture` | `<` | `25.0` | critical |
| `soil_moisture` | `<` | `35.0` | warning |
| `battery` | `<` | `20.0` | warning |

**Medidor eléctrico (energía):**

| Variable | Operador | Umbral | Severidad |
|----------|---------|--------|-----------|
| `power_factor` | `<` | `0.75` | critical |
| `power_factor` | `<` | `0.85` | warning |
| `voltage` | `<` | `198.0` | warning |
| `voltage` | `>` | `242.0` | warning |

### Gestionar reglas

```bash
# Listar todas las reglas
curl -H "Authorization: Bearer <token>" http://<servidor>:3000/api/v1/rules

# Activar/desactivar una regla
curl -X PATCH http://<servidor>:3000/api/v1/rules/<rule_id>/toggle \
  -H "Authorization: Bearer <token>"

# Eliminar una regla
curl -X DELETE http://<servidor>:3000/api/v1/rules/<rule_id> \
  -H "Authorization: Bearer <token>"
```

---

## 10. Usuarios y permisos

### Roles disponibles

| Rol | Puede ver | Puede crear/editar | Puede administrar |
|-----|-----------|-------------------|-------------------|
| `admin` | Todo | Sí | Sí |
| `viewer` | Todo | No | No |

### Crear un usuario

```bash
curl -X POST http://<servidor>:3000/api/v1/users \
  -H "Authorization: Bearer <token-admin>" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "tecnico@empresa.com",
    "password": "contraseña_segura",
    "role": "viewer",
    "phone_whatsapp": "+51999999999"
  }'
```

### Listar usuarios

```bash
curl -H "Authorization: Bearer <token>" http://<servidor>:3000/api/v1/users
```

---

## 11. URLs y puertos del sistema

| Servicio | URL | Descripción |
|---------|-----|-------------|
| **Dashboard** | `http://<servidor>:3000` | Interfaz web principal |
| **API REST** | `http://<servidor>:3000/api/v1/` | API (también accesible en `:8000`) |
| **Docs API** | `http://<servidor>:8000/docs` | Swagger UI interactivo |
| **EMQX Dashboard** | `http://<servidor>:18083` | Admin del broker MQTT |
| **MQTT** | `<servidor>:1883` | Conexión de dispositivos |

### Credenciales EMQX (broker MQTT admin)

| Campo | Valor |
|-------|-------|
| Usuario | `admin` |
| Contraseña | Ver `.env` → `EMQX_ADMIN_PASSWORD` |

### Referencia rápida de la API

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/v1/auth/login` | POST | Obtener token JWT |
| `/api/v1/auth/me` | GET | Datos del usuario actual |
| `/api/v1/devices` | GET | Listar dispositivos |
| `/api/v1/devices` | POST | Crear dispositivo |
| `/api/v1/devices/{id}` | GET | Detalle de dispositivo |
| `/api/v1/devices/{id}/variables` | GET | Lecturas más recientes |
| `/api/v1/telemetry/{id}` | GET | Historial (params: `variable`, `range`) |
| `/api/v1/alerts` | GET | Listar alertas |
| `/api/v1/alerts/{id}/acknowledge` | PATCH | Reconocer alerta |
| `/api/v1/rules` | GET/POST | Gestión de reglas |
| `/api/v1/analytics/kpis` | GET | KPIs por vertical |

---

*Ruwi Lab IoT Platform — Guía de usuario v1.1 — Marzo 2026*
