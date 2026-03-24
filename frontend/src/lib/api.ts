import axios from 'axios'
import type { Device, DeviceVariable } from '../types/device'
import type { Alert } from '../types/alert'
import type { TelemetryPoint, TimeRange } from '../types/telemetry'

// URL vacía = relativa al servidor nginx que proxea /api/ y /ws/ al backend.
// Funciona desde cualquier IP sin problemas de CORS.
const BASE_URL = import.meta.env.VITE_API_URL || ''

export const http = axios.create({ baseURL: BASE_URL })

// eslint-disable-next-line @typescript-eslint/no-explicit-any
http.interceptors.request.use((config: any) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// ---------------------------------------------------------------------------
// Helpers: mappers backend (snake_case) → frontend (camelCase)
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapDevice(d: any): Device {
  return {
    id: String(d.id),
    orgId: String(d.org_id),
    name: d.name,
    type: d.type,
    vertical: d.vertical,
    status: d.status ?? 'offline',
    location: { lat: d.lat ?? 0, lng: d.lng ?? 0 },
    locationName: d.location_name ?? '',
    altitudeMsnm: d.altitude_msnm,
    cropType: d.crop_type,
    lastSeen: d.last_seen ?? new Date().toISOString(),
    metadata: d.metadata ?? {},
  }
}

const VARIABLE_LABELS: Record<string, string> = {
  soil_moisture:   'Humedad suelo',
  temperature:     'Temperatura',
  humidity:        'Hum. relativa',
  battery:         'Batería',
  voltage:         'Voltaje',
  current:         'Corriente',
  power_kw:        'Potencia',
  power_factor:    'Factor potencia',
  oil_temp:        'Temp. aceite',
  load_pct:        'Carga',
  efficiency_pct:  'Eficiencia',
  kwh:             'Consumo',
  power_generated: 'Generación',
  panel_temp:      'Temp. panel',
  rssi:            'Señal WiFi',
}

const VARIABLE_UNITS: Record<string, string> = {
  soil_moisture:   '%',
  temperature:     '°C',
  humidity:        '%',
  battery:         '%',
  voltage:         'V',
  current:         'A',
  power_kw:        'kW',
  power_factor:    '',
  oil_temp:        '°C',
  load_pct:        '%',
  efficiency_pct:  '%',
  kwh:             'kWh',
  power_generated: 'kW',
  panel_temp:      '°C',
  rssi:            'dBm',
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapAlert(a: any): Alert {
  return {
    id: String(a.id),
    deviceId: String(a.device_id),
    deviceName: a.device_name ?? 'Dispositivo',
    orgId: String(a.org_id),
    vertical: a.vertical ?? 'agro',
    severity: a.severity,
    variable: a.variable,
    variableLabel: VARIABLE_LABELS[a.variable] ?? a.variable,
    value: a.value ?? 0,
    unit: VARIABLE_UNITS[a.variable] ?? '',
    threshold: a.threshold ?? 0,
    message: a.message ?? '',
    timestamp: a.time,
    acknowledged: a.acknowledged ?? false,
    acknowledgedBy: a.acknowledged_by,
    acknowledgedAt: a.acknowledged_at,
  }
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export async function login(email: string, password: string) {
  const { data: tokenData } = await http.post('/api/v1/auth/login', { email, password })
  // Guardar token antes de llamar /me
  localStorage.setItem('token', tokenData.access_token)
  const { data: me } = await http.get('/api/v1/auth/me')
  return {
    token: tokenData.access_token,
    user: {
      email: me.email,
      role: me.role,
      orgId: String(me.org_id),
    },
  }
}

// ---------------------------------------------------------------------------
// Devices
// ---------------------------------------------------------------------------

export interface DeviceCreatePayload {
  name: string
  type: string
  vertical: 'agro' | 'energia'
  lat?: number
  lng?: number
  location_name?: string
  altitude_msnm?: number
  crop_type?: string
}

export interface DeviceCreated extends Device {
  apiKey: string
}

export async function createDevice(payload: DeviceCreatePayload): Promise<DeviceCreated> {
  const { data } = await http.post('/api/v1/devices', payload)
  return { ...mapDevice(data), apiKey: data.api_key }
}

export async function deleteDevice(id: string): Promise<void> {
  await http.delete(`/api/v1/devices/${id}`)
}

export async function getDevices(vertical?: string): Promise<Device[]> {
  const params: Record<string, string> = {}
  if (vertical && vertical !== 'all') params.vertical = vertical
  const { data } = await http.get('/api/v1/devices', { params })
  return data.map(mapDevice)
}

export async function getDevice(id: string): Promise<Device> {
  const { data } = await http.get(`/api/v1/devices/${id}`)
  return mapDevice(data)
}

export async function getDeviceVariables(deviceId: string): Promise<DeviceVariable[]> {
  try {
    const { data } = await http.get(`/api/v1/devices/${deviceId}/variables`)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return data.map((v: any): DeviceVariable => ({
      key: v.variable,
      label: VARIABLE_LABELS[v.variable] ?? v.variable,
      value: v.value,
      unit: v.unit ?? VARIABLE_UNITS[v.variable] ?? '',
      trend: 'stable',
      trendValue: 0,
    }))
  } catch {
    return []
  }
}

// ---------------------------------------------------------------------------
// Telemetry
// ---------------------------------------------------------------------------

export async function getTelemetry(
  deviceId: string,
  variable: string,
  range: TimeRange,
): Promise<TelemetryPoint[]> {
  const { data } = await http.get(`/api/v1/telemetry/${deviceId}`, {
    params: { variable, range },
  })
  return data.data as TelemetryPoint[]
}

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------

export async function getAlerts(acknowledged?: boolean): Promise<Alert[]> {
  const params: Record<string, string | boolean | number> = { limit: 100 }
  if (acknowledged !== undefined) params.acknowledged = acknowledged
  const { data } = await http.get('/api/v1/alerts', { params })
  return data.map(mapAlert)
}

export async function acknowledgeAlert(alertId: string): Promise<void> {
  const user = JSON.parse(localStorage.getItem('ruwi-app') ?? '{}')?.state?.user
  const acknowledgedBy = user?.email ?? 'admin'
  await http.patch(`/api/v1/alerts/${alertId}/acknowledge`, { acknowledged_by: acknowledgedBy })
}

// ---------------------------------------------------------------------------
// KPIs
// ---------------------------------------------------------------------------

export async function getKPIs(vertical: 'agro' | 'energia') {
  const { data } = await http.get('/api/v1/analytics/kpis', { params: { vertical } })

  if (vertical === 'agro') {
    return {
      activeDevices:    data.active_devices ?? 0,
      offlineDevices:   data.offline_devices ?? 0,
      avgSoilMoisture:  data.avg_soil_moisture ?? null,
      alertsThisWeek:   data.alerts_this_week ?? 0,
      frostRiskLevel:   (data.frost_risk_devices ?? 0) > 0 ? 'high' : 'low',
      devicesWithStress: data.frost_risk_devices ?? 0,
    }
  }

  return {
    totalKwh:          data.total_kwh_24h ?? 0,
    avgPowerFactor:    data.avg_power_factor ?? null,
    peakHours:         '18:00–21:00',
    anomaliesDetected: 0,
    efficiencyPct:     null,
    kwh_trend:         null,
  }
}
