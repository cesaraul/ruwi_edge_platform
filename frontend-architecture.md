# Arquitectura Frontend — Plataforma IoT Ruwi Lab
> Diseño detallado del dashboard: estructura, componentes, UI y flujo de datos
> Versión: 1.0 | Marzo 2026 | Complementa: `stack-iot-mvp.md`

---

## Tabla de Contenidos

1. [Principios de Diseño](#1-principios-de-diseño)
2. [Sistema de Diseño](#2-sistema-de-diseño)
3. [Layout Global](#3-layout-global)
4. [Estructura de Rutas](#4-estructura-de-rutas)
5. [Páginas — Propuesta de UI](#5-páginas--propuesta-de-ui)
6. [Árbol de Componentes](#6-árbol-de-componentes)
7. [Arquitectura de Estado](#7-arquitectura-de-estado)
8. [Flujo de Datos](#8-flujo-de-datos)
9. [Estructura de Archivos](#9-estructura-de-archivos)
10. [Tipos TypeScript](#10-tipos-typescript)

---

## 1. Principios de Diseño

### Contexto del usuario

La plataforma tiene dos perfiles de usuario radicalmente distintos:

| Perfil | Contexto de uso | Dispositivo | Prioridad |
|--------|----------------|-------------|-----------|
| **Técnico agro / agrónomo** | Campo, luz solar, guantes | Celular Android económico | Mobile-first |
| **Operador energía** | Sala de control, escritorio | Desktop / tablet | Dashboard denso |
| **Gerente / dueño** | Oficina u hogar | Desktop / celular | KPIs rápidos |

### Decisiones de diseño derivadas

- **Dark theme por defecto** — estándar en dashboards de monitoreo industrial; reduce fatiga visual en uso prolongado y es más legible bajo luz directa en pantallas de bajo brillo
- **Color como lenguaje de estado** — verde / amarillo / rojo es universal y no requiere leer texto para entender el estado de un dispositivo
- **Información crítica al primer vistazo** — el usuario entra al dashboard para saber si hay problemas, no para explorar
- **Mobile-responsive real** — no solo breakpoints, sino jerarquía de información que cambia en móvil (mapa ocupa full screen, sidebar se convierte en bottom sheet)
- **Español simple** — sin tecnicismos innecesarios; "Humedad del suelo" no "Soil Moisture Volumetric Content"

### Diferenciación visual por vertical

```
Agro    → Paleta verde oscura + tierra (evoca campo, naturaleza)
Energía → Paleta azul eléctrico + gris oscuro (evoca industria, precisión)
```

---

## 2. Sistema de Diseño

### Paleta de colores

```css
/* tokens de diseño — tailwind.config.ts */

/* Fondos (dark theme) */
--bg-base:        #0d1117   /* fondo principal */
--bg-surface:     #161b22   /* tarjetas, sidebars */
--bg-elevated:    #21262d   /* inputs, dropdowns */
--bg-border:      #30363d   /* bordes sutiles */

/* Estado de dispositivos (semáforo universal) */
--status-ok:      #3fb950   /* verde — operativo */
--status-warn:    #d29922   /* amarillo — advertencia */
--status-crit:    #f85149   /* rojo — crítico */
--status-off:     #6e7681   /* gris — sin señal / apagado */

/* Vertical Agro */
--agro-primary:   #2ea043   /* verde principal */
--agro-accent:    #56d364   /* verde claro para highlights */
--agro-muted:     #1f6340   /* verde oscuro para backgrounds */

/* Vertical Energía */
--energy-primary: #388bfd   /* azul eléctrico */
--energy-accent:  #79c0ff   /* azul claro */
--energy-muted:   #1c3a6e   /* azul oscuro */

/* Texto */
--text-primary:   #e6edf3
--text-secondary: #8b949e
--text-muted:     #6e7681

/* Severidad de alertas */
--alert-critical: #f85149
--alert-warning:  #d29922
--alert-info:     #388bfd
```

### Tipografía

```typescript
// tailwind.config.ts
fontFamily: {
  sans: ['Inter', 'system-ui', 'sans-serif'],    // UI general
  mono: ['JetBrains Mono', 'monospace'],          // valores numéricos de sensores
}

// Escala de tamaños usados
// text-xs  → 12px — labels de ejes en gráficas, metadata
// text-sm  → 14px — texto de interfaz principal
// text-base → 16px — títulos de sección
// text-lg  → 18px — títulos de página
// text-2xl → 24px — valores KPI grandes
// text-4xl → 36px — número principal en KPI card hero
```

### Componentes base (shadcn/ui configurados)

```
Badge       → estado de dispositivos (OK / WARNING / CRITICAL / OFFLINE)
Card        → contenedor de KPIs y paneles
Button      → acciones primarias y secundarias
Tabs        → cambio de rango de tiempo en gráficas (1h / 24h / 7d / 30d)
Select      → filtros de vertical y dispositivo
Dialog      → confirmación de acciones (reconocer alerta, eliminar regla)
Tooltip     → contexto en valores de sensores y gráficas
Skeleton    → loading state de tarjetas y gráficas
Alert       → banners de error o desconexión de WebSocket
Switch      → activar/desactivar reglas de alerta
```

### Iconografía

Usar `lucide-react` (ya incluido en shadcn/ui):

```
Agro:    Sprout, Droplets, Thermometer, Wind, Sun, CloudRain
Energía: Zap, Battery, Activity, Gauge, TrendingUp, TrendingDown
General: MapPin, Bell, BellOff, CheckCircle, XCircle, AlertTriangle,
         Wifi, WifiOff, Settings, ChevronRight, RefreshCw
```

---

## 3. Layout Global

### Estructura visual

```
┌─────────────────────────────────────────────────────────────────┐
│  TOPBAR                                                          │
│  [≡ Logo]  [Org Selector ▼]          [🔔 3] [avatar ▼]        │
├──────────┬──────────────────────────────────────────────────────┤
│          │                                                        │
│ SIDEBAR  │              CONTENT AREA                            │
│          │                                                        │
│ 🗺 Mapa  │   <página activa se renderiza aquí>                 │
│ 📊 Disp. │                                                        │
│ 🔔 Alert │                                                        │
│ 📈 KPIs  │                                                        │
│ ⚙ Config │                                                        │
│          │                                                        │
│ [Agro]   │                                                        │
│ [Energía]│                                                        │
│          │                                                        │
└──────────┴──────────────────────────────────────────────────────┘
```

### Comportamiento responsive

```
Desktop (≥1024px): sidebar fijo visible (240px) + content area fluida
Tablet  (768-1023px): sidebar colapsado con solo iconos (64px)
Mobile  (<768px): sidebar oculto → bottom navigation bar de 5 items
```

### Topbar — contenido

```
[Izquierda]
  Logo Ruwi Lab + hamburger menu (mobile)

[Centro]
  Org Selector: dropdown con las organizaciones del usuario
  → útil para admins que gestionan múltiples clientes

[Derecha]
  Indicador WebSocket: punto verde animado = conectado | gris = desconectado
  Bell icon: badge con count de alertas no reconocidas
  Avatar dropdown: perfil, cambiar contraseña, cerrar sesión
```

### Sidebar — navegación

```typescript
const NAV_ITEMS = [
  { icon: Map,        label: 'Mapa',        path: '/',            badge: null },
  { icon: Cpu,        label: 'Dispositivos', path: '/devices',     badge: null },
  { icon: Bell,       label: 'Alertas',     path: '/alerts',      badge: 'alertCount' },
  { icon: BarChart2,  label: 'Analytics',   path: '/analytics',   badge: null },
  { icon: Settings,   label: 'Config',      path: '/settings',    badge: null },
]

// Sección inferior del sidebar: filtro de vertical activo
// Botones toggle: [Todos] [🌱 Agro] [⚡ Energía]
// Afecta el contexto global de la app (qué dispositivos mostrar)
```

---

## 4. Estructura de Rutas

```typescript
// src/router.tsx — React Router v6

<Routes>
  {/* Auth */}
  <Route path="/login"    element={<LoginPage />} />

  {/* App (requiere auth) */}
  <Route element={<AppLayout />}>
    <Route index              element={<MapDashboard />} />
    <Route path="devices"     element={<DevicesPage />} />
    <Route path="devices/:id" element={<DeviceDetailPage />} />
    <Route path="alerts"      element={<AlertsPage />} />
    <Route path="analytics"   element={<AnalyticsPage />} />
    <Route path="settings">
      <Route index            element={<SettingsDevices />} />
      <Route path="rules"     element={<SettingsRules />} />
      <Route path="users"     element={<SettingsUsers />} />
      <Route path="org"       element={<SettingsOrg />} />
    </Route>
  </Route>
</Routes>
```

---

## 5. Páginas — Propuesta de UI

### 5.1 Mapa Principal (`/`)

La pantalla de inicio. El objetivo: **¿están todos mis dispositivos bien?** debe responderse en menos de 3 segundos.

```
┌─────────────────────────────────────────────────────────────────┐
│  KPI STRIP (barra superior de contexto rápido)                  │
│  [● 47 Dispositivos]  [✓ 44 OK]  [⚠ 2 Warning]  [✕ 1 Crítico] │
├────────────────────────────────────┬────────────────────────────┤
│                                    │  PANEL LATERAL (320px)     │
│   MAPA LEAFLET (ocupa todo)        │                            │
│                                    │  [Filtro: Todos▼] [🔍]    │
│   Marcadores de dispositivos:      │  ─────────────────────── │
│   🟢 = OK                          │  ● sensor_agro_001        │
│   🟡 = Warning                     │    Humedad: 42% · Activo  │
│   🔴 = Critical                    │  ─────────────────────── │
│   ⚫ = Offline                     │  🔴 sensor_agro_007       │
│                                    │    CRÍTICO: Temp -3°C     │
│   Al hacer click en marcador:      │    Riesgo helada ⚠         │
│   ┌─────────────────────┐          │  ─────────────────────── │
│   │ Popup del dispositivo│          │  🟡 medidor_energia_002   │
│   │ Nombre: Parcela N-3  │          │    F. Potencia: 0.82     │
│   │ Humedad: 42%  ↑      │          │  ─────────────────────── │
│   │ Temp: 18°C    →      │          │                          │
│   │ Batería: 85%         │          │  FEED ALERTAS RECIENTES  │
│   │ [Ver detalle →]      │          │  ─────────────────────── │
│   └─────────────────────┘          │  🔴 15:42 sensor_007      │
│                                    │    Temp bajo umbral       │
│                                    │  🟡 15:38 medidor_002     │
│                                    │    FP bajo advertencia    │
└────────────────────────────────────┴────────────────────────────┘

MOBILE: Mapa ocupa 100vw/100vh, panel lateral se convierte en
bottom sheet deslizable (altura 40% → expandible a 80%)
```

**Detalles del mapa:**
- Clustering de marcadores al hacer zoom out (Leaflet.markercluster)
- Control de capas: satélite / mapa callejero (OpenStreetMap gratuito)
- Botón "Centrar en mis dispositivos" (fitBounds automático)
- Indicador de última actualización ("hace 23 seg" con contador)

---

### 5.2 Lista de Dispositivos (`/devices`)

```
┌─────────────────────────────────────────────────────────────────┐
│  Dispositivos (47)                              [+ Agregar]     │
│  [🔍 Buscar...]  [Vertical: Todos▼]  [Estado: Todos▼]          │
├────────────────────────────────────────────────────────────────┤
│  Vista: [📋 Lista] [⊞ Grilla]                                  │
├────────────────────────────────────────────────────────────────┤
│                                                                  │
│  GRILLA DE DEVICE CARDS (3 columnas desktop, 2 tablet, 1 móvil)│
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐ │
│  │ 🟢 sensor_agro_1 │  │ 🔴 sensor_agro_7 │  │ 🟡 medidor_2│ │
│  │ Parcela Norte 1  │  │ Parcela Sur 3    │  │ Transf. B-2 │ │
│  │ 🌱 Agro          │  │ 🌱 Agro          │  │ ⚡ Energía  │ │
│  │ ─────────────── │  │ ─────────────── │  │ ─────────── │ │
│  │ 💧 42% humedad  │  │ 🌡 -3°C CRÍTICO │  │ ⚡ 0.82 FP  │ │
│  │ 🌡 18°C         │  │ 💧 67% humedad  │  │ 45.2 kWh   │ │
│  │ 🔋 85%          │  │ 🔋 12% ⚠        │  │ 99.8% uptime│ │
│  │ ─────────────── │  │ ─────────────── │  │ ─────────── │ │
│  │ Hace 45 seg     │  │ Hace 2 min      │  │ Hace 12 seg │ │
│  └──────────────────┘  └──────────────────┘  └──────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Device Card — detalles:**
- El color del borde izquierdo indica el estado (verde/amarillo/rojo/gris)
- Las variables mostradas son las 2-3 más relevantes para esa vertical
- Badge de batería solo si < 20% (no ensuciar la tarjeta si está bien)
- Click → navega a `/devices/:id`

---

### 5.3 Detalle de Dispositivo (`/devices/:id`)

La vista más densa de información. Dividida en secciones claras.

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Volver    sensor_agro_001 — Parcela Norte 1         🟢 OK   │
│  🌱 Agro · Papa andina · 3820 msnm · 📍 Puno, Perú            │
│  Última lectura: hace 45 segundos  [↻ Actualizar]              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  VALORES ACTUALES (grid de variable cards)                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │  💧 Humedad │  │ 🌡 Temp     │  │ 💨 Humedad  │            │
│  │   suelo     │  │  ambiente   │  │  relativa   │            │
│  │             │  │             │  │             │            │
│  │  42.5 %     │  │  18.3 °C    │  │  67.0 %     │            │
│  │  ▲ +2.1     │  │  ▼ -0.8     │  │  → estable  │            │
│  │  vs hora ant│  │  vs hora ant│  │             │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
│  ┌─────────────┐  ┌─────────────┐                              │
│  │ 🔋 Batería  │  │ 📡 Señal    │                              │
│  │   nivel     │  │  RSSI       │                              │
│  │   85 %      │  │  -72 dBm    │                              │
│  │   bueno     │  │  buena      │                              │
│  └─────────────┘  └─────────────┘                              │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  GRÁFICA DE SERIES DE TIEMPO                                    │
│  Variable: [Humedad suelo▼]  Rango: [1h] [24h] [7d] [30d]     │
│                                                                  │
│  100% ┤                                                         │
│   80% ┤          ╭───╮                                         │
│   60% ┤    ──────╯   ╰──────────────────  ← línea actual       │
│   40% ┤ ─────                          ╰──                     │
│   20% ┤ · · · · threshold bajo (35%)                           │
│    0% └──────────────────────────────────────────────          │
│        00:00    06:00    12:00    18:00    ahora               │
│                                                                  │
│  [📥 Exportar CSV]                                              │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  PREDICCIONES AI (solo si vertical = agro)                      │
│  ┌──────────────────────────┐  ┌──────────────────────────┐   │
│  │ 🧊 Riesgo de Helada      │  │ 💧 Estrés Hídrico        │   │
│  │                          │  │                          │   │
│  │  BAJO en las próx. 6h    │  │  MODERADO                │   │
│  │  Temp. proyectada: 8°C   │  │  Humedad bajando a 32%   │   │
│  │  Umbral cultivo: 2°C     │  │  en ~4 horas             │   │
│  │  Confianza: 87%          │  │  Considerar riego        │   │
│  └──────────────────────────┘  └──────────────────────────┘   │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ALERTAS ACTIVAS DEL DISPOSITIVO                                │
│  (vacío si no hay alertas)                                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ No hay alertas activas para este dispositivo ✓          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Notas de la gráfica (ECharts):**
- Líneas horizontales punteadas para umbrales (warning y critical)
- Área sombreada bajo la línea en color muy sutil
- Tooltip en hover: valor exacto + timestamp + estado en ese momento
- Zoom con scroll del mouse o pinch en mobile
- Múltiples variables en la misma gráfica como líneas de colores distintos

---

### 5.4 Panel de Alertas (`/alerts`)

```
┌─────────────────────────────────────────────────────────────────┐
│  Alertas                                    [✓ Reconocer todas] │
│                                                                  │
│  FILTROS                                                         │
│  Severidad: [Todas] [🔴 Críticas] [🟡 Avisos] [🔵 Info]        │
│  Vertical:  [Todas▼]   Dispositivo: [Todos▼]   Fecha: [Hoy▼]  │
│                                                                  │
│  TABS: [No reconocidas (3)] [Reconocidas] [Historial completo]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  FEED EN TIEMPO REAL (WebSocket, auto-scroll deshabilitado)     │
│  [● LIVE] Nueva alerta recibida — click para ver ▼             │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 🔴 CRÍTICO        sensor_agro_007 · Parcela Sur 3       │   │
│  │ Temperatura ambiente: -3.2°C (umbral: 2°C)              │   │
│  │ 🌱 Papa andina · 3820 msnm · Puno                       │   │
│  │ ⏱ Hace 8 minutos · 15:42:33                             │   │
│  │ [Reconocer ✓]  [Ver dispositivo →]                      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 🟡 AVISO          medidor_energia_002 · Transf. B-2     │   │
│  │ Factor de potencia: 0.82 (mínimo: 0.85)                 │   │
│  │ ⚡ Energía · Planta industrial Lima                      │   │
│  │ ⏱ Hace 25 minutos · 15:25:11                            │   │
│  │ [Reconocer ✓]  [Ver dispositivo →]                      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Comportamiento de alertas:**
- Las nuevas alertas llegan via WebSocket y se insertan al tope del feed
- Un banner no intrusivo aparece si hay nueva alerta mientras el usuario está scrolleando abajo
- Reconocer una alerta la mueve a la pestaña "Reconocidas" con animación suave
- Sonido de notificación opcional (configurable en settings) — útil para salas de control

---

### 5.5 Analytics / KPIs (`/analytics`)

Dashboard diferenciado por vertical. Cambia completamente según qué vertical está activa.

#### Vista Agro

```
┌─────────────────────────────────────────────────────────────────┐
│  Analytics — Agro                    Período: [Última semana▼] │
│                                                                  │
│  KPIs RESUMEN                                                   │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐  │
│  │ 🌱 Cultivos│ │💧 Hum. Prom│ │🧊 Riesgo   │ │⚠ Alertas  │  │
│  │ activos    │ │  general   │ │  helada    │  │  semana   │  │
│  │   12       │ │  54.3%     │ │   BAJO     │ │   7       │  │
│  │ +2 vs mes  │ │ ▼ -2.1%    │ │  tendencia │ │ ▼ -3      │  │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘  │
│                                                                  │
│  MAPA DE CALOR DE HUMEDAD (mapa Leaflet con overlay de colores) │
│  ┌─────────────────────────────────────┐                        │
│  │                                     │  Leyenda:             │
│  │   [mapa con zonas coloreadas        │  🔵 >70% óptimo       │
│  │    según humedad promedio de        │  🟢 50-70% bueno      │
│  │    sensores en cada zona]           │  🟡 30-50% bajo       │
│  │                                     │  🔴 <30% crítico      │
│  └─────────────────────────────────────┘                        │
│                                                                  │
│  TENDENCIAS POR CULTIVO                                          │
│  Cultivo: [Papa andina▼]                                        │
│  [Gráfica multi-variable: humedad + temperatura 7 días]         │
│                                                                  │
│  PREDICCIÓN PRÓXIMAS 48H                                        │
│  [Gráfica de temperatura proyectada con banda de confianza]     │
│  Zona de riesgo de helada marcada con fondo rojo semi-transparente│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### Vista Energía

```
┌─────────────────────────────────────────────────────────────────┐
│  Analytics — Energía                 Período: [Este mes▼]      │
│                                                                  │
│  KPIs RESUMEN                                                    │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │
│  │ ⚡ Consumo   │ │ Ø Factor     │ │ 📈 Horas     │            │
│  │ total        │ │ potencia     │ │ pico         │            │
│  │ 4,823 kWh    │ │ 0.89         │ │ 18:00-21:00  │            │
│  │ ▲ +8.2% mes  │ │ ✓ normal     │ │ +12% vs mes  │            │
│  └──────────────┘ └──────────────┘ └──────────────┘            │
│                                                                  │
│  CONSUMO DIARIO (bar chart 30 días)                             │
│  [gráfica de barras, barra de hoy resaltada]                    │
│                                                                  │
│  GAUGE DE FACTOR DE POTENCIA (ECharts gauge)                    │
│  ┌──────────────────────────┐  ANOMALÍAS DETECTADAS            │
│  │     ╭──────────╮        │  ┌─────────────────────┐         │
│  │   ╭─╯  0.89    ╰─╮      │  │ 3 anomalías esta    │         │
│  │   │   NORMAL      │      │  │ semana (▼ -2)       │         │
│  │   ╰──────────────╯      │  │ [Ver detalle →]     │         │
│  └──────────────────────────┘  └─────────────────────┘         │
│                                                                  │
│  MAPA DE CALOR HORARIO (heatmap 24h x 7 días)                  │
│  [Cada celda = consumo promedio a esa hora/día]                 │
│  Permite identificar patrones de consumo visualmente           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

### 5.6 Configuración (`/settings`)

Navegación interna por sub-secciones via tabs verticales:

```
┌────────────┬────────────────────────────────────────────────────┐
│ SETTINGS   │                                                     │
│ TABS       │  CONTENIDO DE LA SECCIÓN ACTIVA                    │
│            │                                                     │
│ Dispositivos│  Tabla de dispositivos con acciones:               │
│ Reglas     │  [Nombre] [Tipo] [Vertical] [Estado] [Acciones]    │
│ Usuarios   │  Botón [+ Agregar dispositivo]                      │
│ Organización│  Por dispositivo: [✏ Editar] [🗑 Eliminar]        │
│ Notificac. │                                                     │
│            │                                                     │
└────────────┴────────────────────────────────────────────────────┘
```

**Sección Reglas de Alerta:**
```
Tabla de reglas con:
- Nombre de regla
- Dispositivo afectado
- Variable vigilada
- Condición (ej: "temp < 2°C")
- Severidad
- Notificaciones (íconos: 💬 WhatsApp, 📧 Email)
- Switch ON/OFF para activar/desactivar
- [✏ Editar] [🗑 Eliminar]

Botón [+ Nueva Regla] → Drawer lateral con formulario:
  - Seleccionar dispositivo
  - Seleccionar variable (dropdown con variables del dispositivo)
  - Operador (mayor que, menor que, entre, igual)
  - Umbral(es)
  - Severidad
  - Cooldown entre alertas
  - Canales de notificación
```

---

## 6. Árbol de Componentes

```
src/
└── components/
    │
    ├── layout/
    │   ├── AppLayout.tsx          # Wrapper general: topbar + sidebar + outlet
    │   ├── TopBar.tsx             # Org selector, WS indicator, notif, avatar
    │   ├── Sidebar.tsx            # Nav links + vertical filter
    │   └── BottomNav.tsx          # Solo mobile: reemplaza al sidebar
    │
    ├── map/
    │   ├── DeviceMap.tsx          # Componente Leaflet principal
    │   ├── DeviceMarker.tsx       # Marcador custom coloreado por estado
    │   ├── DevicePopup.tsx        # Popup al click con datos rápidos
    │   ├── MapSidePanel.tsx       # Panel lateral: lista + alert feed
    │   └── HeatmapLayer.tsx       # Capa de calor para analytics agro
    │
    ├── charts/
    │   ├── TimeseriesChart.tsx    # Gráfica de línea principal (ECharts)
    │   ├── MultiVarChart.tsx      # Múltiples variables en una gráfica
    │   ├── ConsumptionBar.tsx     # Barras de consumo energético
    │   ├── PowerFactorGauge.tsx   # Gauge circular para factor de potencia
    │   ├── HourlyHeatmap.tsx      # Heatmap 24h x 7 días
    │   └── TrendPrediction.tsx    # Línea histórica + proyección punteada
    │
    ├── devices/
    │   ├── DeviceCard.tsx         # Tarjeta en la grilla de /devices
    │   ├── DeviceStatusBadge.tsx  # Badge: OK / WARNING / CRITICAL / OFFLINE
    │   ├── VariableCard.tsx       # Tarjeta individual de valor actual
    │   ├── DeviceHeader.tsx       # Cabecera en /devices/:id
    │   └── DeviceList.tsx         # Lista compacta (sidebar del mapa)
    │
    ├── alerts/
    │   ├── AlertCard.tsx          # Card individual de alerta
    │   ├── AlertFeed.tsx          # Lista de alertas con scroll infinito
    │   ├── AlertBanner.tsx        # Banner "nueva alerta recibida"
    │   └── AlertBadge.tsx         # Severidad como badge coloreado
    │
    ├── analytics/
    │   ├── KpiCard.tsx            # Tarjeta de KPI con valor + tendencia
    │   ├── KpiCardHero.tsx        # KPI con número grande (hero section)
    │   ├── AgroAnalytics.tsx      # Dashboard completo vertical agro
    │   └── EnergiaAnalytics.tsx   # Dashboard completo vertical energía
    │
    ├── predictions/
    │   ├── FrostRiskCard.tsx      # Riesgo de helada con nivel + proyección
    │   └── WaterStressCard.tsx    # Estrés hídrico proyectado
    │
    └── ui/                        # shadcn/ui components (no modificar)
        └── [badge, card, button, tabs, select, dialog, ...]
```

---

## 7. Arquitectura de Estado

### Zustand — stores globales

```typescript
// stores/appStore.ts
// Estado de la aplicación: vertical activa, org, UI

interface AppState {
  activeVertical: 'all' | 'agro' | 'energia'
  selectedOrgId: string
  sidebarCollapsed: boolean
  setVertical: (v: AppState['activeVertical']) => void
  setOrg: (id: string) => void
  toggleSidebar: () => void
}

// stores/wsStore.ts
// Estado de la conexión WebSocket y últimos datos recibidos

interface WsState {
  connected: boolean
  lastReadings: Record<string, SensorReading>  // key: `${device_id}:${variable}`
  activeAlerts: Alert[]
  setConnected: (v: boolean) => void
  updateReading: (reading: SensorReading) => void
  addAlert: (alert: Alert) => void
  acknowledgeAlert: (alertId: string) => void
}
```

### TanStack Query — datos del servidor

```typescript
// queries organizadas por dominio:

// hooks/queries/useDevices.ts
export const useDevices = (filters?: DeviceFilters) =>
  useQuery({
    queryKey: ['devices', filters],
    queryFn: () => api.getDevices(filters),
    staleTime: 30_000,       // 30 segundos antes de refetch
  })

// hooks/queries/useTelemetry.ts
export const useTelemetry = (deviceId: string, variable: string, range: TimeRange) =>
  useQuery({
    queryKey: ['telemetry', deviceId, variable, range],
    queryFn: () => api.getTelemetry(deviceId, variable, range),
    staleTime: 60_000,
  })

// hooks/queries/useAlerts.ts
export const useAlerts = (filters?: AlertFilters) =>
  useInfiniteQuery({
    queryKey: ['alerts', filters],
    queryFn: ({ pageParam = 0 }) => api.getAlerts({ ...filters, offset: pageParam }),
    getNextPageParam: (last) => last.nextOffset,
  })

// mutations
export const useAcknowledgeAlert = () =>
  useMutation({
    mutationFn: (alertId: string) => api.acknowledgeAlert(alertId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] })
    },
  })
```

### Flujo de datos en tiempo real

```
WebSocket message recibido
         │
         ▼
  wsStore.updateReading()    ← Zustand (in-memory, instant)
         │
         ├── DeviceMap markers se re-colorean
         ├── VariableCards muestran nuevo valor
         └── Si es alerta → wsStore.addAlert()
                  │
                  └── AlertFeed muestra nueva card
                      TopBar badge count + 1
                      (Si hay alerta crítica → sonido opcional)
```

---

## 8. Flujo de Datos

### Diagrama completo

```
┌──────────────────────────────────────────────────────────────┐
│                      FRONTEND                                 │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │               AppLayout (montado 1 vez)              │    │
│  │                                                       │    │
│  │  useWebSocket()  ←──── wss://api/ws/{org_id}        │    │
│  │       │                        ↑                     │    │
│  │       │          ┌─────────────┘                     │    │
│  │       ▼          │  Backend emite mensajes:           │    │
│  │  wsStore         │  - { type: 'reading', ... }        │    │
│  │  ┌──────────┐    │  - { type: 'alert', ... }          │    │
│  │  │readings  │    │  - { type: 'device_status', ... }  │    │
│  │  │alerts    │    └───────────────────────────────────  │    │
│  │  └──────────┘                                         │    │
│  │       │                                               │    │
│  │       ▼                                               │    │
│  │  Componentes suscritos a wsStore (Zustand selectors)  │    │
│  │  DeviceMarker, VariableCard, AlertFeed, TopBar badge  │    │
│  │                                                       │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │          Datos históricos — TanStack Query           │    │
│  │                                                       │    │
│  │  useDevices()     → GET /api/v1/devices              │    │
│  │  useTelemetry()   → GET /api/v1/telemetry/{id}       │    │
│  │  useAlerts()      → GET /api/v1/alerts               │    │
│  │  useKPIs()        → GET /api/v1/analytics/kpis       │    │
│  │                                                       │    │
│  │  Cache automático, refetch en background,            │    │
│  │  stale-while-revalidate                              │    │
│  └─────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

### Hook WebSocket centralizado

```typescript
// hooks/useWebSocket.ts
// Se instancia UNA SOLA VEZ en AppLayout

export function useWebSocket(orgId: string) {
  const { setConnected, updateReading, addAlert } = useWsStore()

  useEffect(() => {
    const ws = new WebSocket(`${WS_URL}/ws/${orgId}`)

    ws.onopen    = () => setConnected(true)
    ws.onclose   = () => setConnected(false)
    ws.onerror   = () => setConnected(false)

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data)

      switch (msg.type) {
        case 'reading':
          updateReading(msg.data)
          break
        case 'alert':
          addAlert(msg.data)
          queryClient.invalidateQueries({ queryKey: ['alerts'] })
          break
        case 'device_status':
          queryClient.invalidateQueries({ queryKey: ['devices'] })
          break
      }
    }

    // Reconexión automática exponencial
    ws.onclose = () => {
      setConnected(false)
      setTimeout(() => reconnect(), Math.min(1000 * 2 ** retries++, 30000))
    }

    return () => ws.close()
  }, [orgId])
}
```

---

## 9. Estructura de Archivos

```
frontend/
├── public/
│   └── favicon.ico
│
├── src/
│   ├── main.tsx                    # Entry point
│   ├── App.tsx                     # Router + QueryClient + providers
│   ├── router.tsx                  # Definición de rutas
│   │
│   ├── pages/
│   │   ├── auth/
│   │   │   └── LoginPage.tsx
│   │   ├── MapDashboard.tsx
│   │   ├── DevicesPage.tsx
│   │   ├── DeviceDetailPage.tsx
│   │   ├── AlertsPage.tsx
│   │   ├── AnalyticsPage.tsx
│   │   └── settings/
│   │       ├── SettingsLayout.tsx
│   │       ├── SettingsDevices.tsx
│   │       ├── SettingsRules.tsx
│   │       ├── SettingsUsers.tsx
│   │       └── SettingsOrg.tsx
│   │
│   ├── components/
│   │   └── [ver Árbol de Componentes — sección 6]
│   │
│   ├── hooks/
│   │   ├── useWebSocket.ts
│   │   ├── queries/
│   │   │   ├── useDevices.ts
│   │   │   ├── useTelemetry.ts
│   │   │   ├── useAlerts.ts
│   │   │   ├── useKPIs.ts
│   │   │   └── usePredictions.ts
│   │   └── mutations/
│   │       ├── useAcknowledgeAlert.ts
│   │       ├── useUpdateDevice.ts
│   │       └── useUpdateRule.ts
│   │
│   ├── stores/
│   │   ├── appStore.ts             # vertical activa, org, UI state
│   │   └── wsStore.ts              # WS connection + real-time data
│   │
│   ├── lib/
│   │   ├── api.ts                  # Cliente axios con interceptors JWT
│   │   ├── queryClient.ts          # Instancia TanStack Query
│   │   └── utils.ts                # cn(), formatters de fecha, valores
│   │
│   ├── types/
│   │   ├── device.ts
│   │   ├── telemetry.ts
│   │   ├── alert.ts
│   │   └── user.ts
│   │
│   └── constants/
│       ├── verticals.ts            # Config de colores y labels por vertical
│       └── timeRanges.ts           # 1h, 24h, 7d, 30d con labels
│
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── Dockerfile
```

---

## 10. Tipos TypeScript

```typescript
// types/device.ts

export type DeviceStatus = 'online' | 'warning' | 'critical' | 'offline'
export type Vertical = 'agro' | 'energia'

export interface Device {
  id: string
  orgId: string
  name: string
  type: string
  vertical: Vertical
  status: DeviceStatus
  location: { lat: number; lng: number }
  altitudeMsnm?: number
  cropType?: string            // solo agro
  lastSeen: string             // ISO timestamp
  metadata: Record<string, unknown>
}

// types/telemetry.ts

export interface SensorReading {
  deviceId: string
  variable: string
  value: number
  unit: string
  timestamp: string
  quality: number              // 0-100
}

export type TimeRange = '1h' | '24h' | '7d' | '30d'

export interface TelemetryPoint {
  time: string
  value: number
  min?: number
  max?: number
}

// types/alert.ts

export type AlertSeverity = 'info' | 'warning' | 'critical'

export interface Alert {
  id: string
  deviceId: string
  deviceName: string
  orgId: string
  vertical: Vertical
  severity: AlertSeverity
  variable: string
  value: number
  threshold: number
  message: string
  timestamp: string
  acknowledged: boolean
  acknowledgedBy?: string
  acknowledgedAt?: string
}

// types/analytics.ts

export interface AgroKPIs {
  activeCrops: number
  avgSoilMoisture: number
  frostRiskLevel: 'low' | 'medium' | 'high'
  alertsThisWeek: number
  devicesWithStress: number
}

export interface EnergiaKPIs {
  totalKwh: number
  avgPowerFactor: number
  peakHours: string
  anomaliesDetected: number
  efficiencyPct: number
}
```

---

## Apéndice — Decisiones técnicas clave

| Decisión | Alternativa descartada | Razón |
|----------|----------------------|-------|
| ECharts para gráficas | Recharts / Victory | ECharts tiene mejor performance con series largas (miles de puntos), soporte de heatmap y gauge nativos |
| Leaflet para mapas | Google Maps / Mapbox | Costo cero, sin límites de requests, suficiente para el MVP |
| Zustand solo para WS state | Solo TanStack Query | Los datos WS son in-memory y mutan frecuentemente; React Query es para datos del servidor |
| Single WebSocket en AppLayout | WS por componente | Una sola conexión es más eficiente y evita duplicar mensajes |
| Dark theme por defecto | Light theme | Estándar en dashboards industriales; usuarios en sala de control agradecen menos luz |
| shadcn/ui (copy-paste) | MUI / Ant Design | Control total sobre el código, sin bundle bloat, se personaliza sin conflictos |

---

*Documento de arquitectura frontend — Ruwi Lab IoT Platform*
*Versión 1.0 — Marzo 2026 | Ver también: `stack-iot-mvp.md`*
