import type { Device, DeviceVariable } from '../types/device'
import type { TelemetryPoint } from '../types/telemetry'
import { subMinutes, format } from 'date-fns'

// ---------------------------------------------------------------------------
// IDs fijos — coinciden con los del seed del backend
// ---------------------------------------------------------------------------

export const DEMO_AGRO_ID    = '00000000-0000-0000-0000-000000000100'
export const DEMO_ENERGIA_ID = '00000000-0000-0000-0000-000000000200'
export const DEMO_ORG_ID     = '00000000-0000-0000-0000-000000000001'

// ---------------------------------------------------------------------------
// 2 dispositivos demo (fallback cuando el backend no tiene datos aún)
// ---------------------------------------------------------------------------

export const MOCK_DEVICES: Device[] = [
  {
    id: DEMO_AGRO_ID,
    orgId: DEMO_ORG_ID,
    name: 'Sensor Parcela Norte',
    type: 'soil_sensor',
    vertical: 'agro',
    status: 'online',
    location: { lat: -15.8402, lng: -70.0219 },
    locationName: 'Puno, Perú',
    altitudeMsnm: 3820,
    cropType: 'Papa andina',
    lastSeen: subMinutes(new Date(), 1).toISOString(),
    metadata: {},
  },
  {
    id: DEMO_ENERGIA_ID,
    orgId: DEMO_ORG_ID,
    name: 'Medidor Planta A',
    type: 'energy_meter',
    vertical: 'energia',
    status: 'online',
    location: { lat: -12.066, lng: -77.036 },
    locationName: 'Lima, Perú',
    altitudeMsnm: 0,
    lastSeen: subMinutes(new Date(), 1).toISOString(),
    metadata: {},
  },
]

// ---------------------------------------------------------------------------
// Variables por defecto (fallback antes del primer ciclo del simulador)
// ---------------------------------------------------------------------------

export const DEVICE_VARIABLES: Record<string, DeviceVariable[]> = {
  [DEMO_AGRO_ID]: [
    { key: 'soil_moisture', label: 'Humedad suelo', value: 45.0, unit: '%',  trend: 'stable', trendValue: 0 },
    { key: 'temperature',   label: 'Temperatura',   value: 18.0, unit: '°C', trend: 'stable', trendValue: 0 },
    { key: 'humidity',      label: 'Hum. relativa', value: 68.0, unit: '%',  trend: 'stable', trendValue: 0 },
    { key: 'battery',       label: 'Batería',        value: 85.0, unit: '%',  trend: 'stable', trendValue: 0 },
  ],
  [DEMO_ENERGIA_ID]: [
    { key: 'voltage',      label: 'Voltaje',        value: 220.0, unit: 'V',  trend: 'stable', trendValue: 0 },
    { key: 'current',      label: 'Corriente',      value: 13.5,  unit: 'A',  trend: 'stable', trendValue: 0 },
    { key: 'power_kw',     label: 'Potencia',       value: 2.97,  unit: 'kW', trend: 'stable', trendValue: 0 },
    { key: 'power_factor', label: 'Factor potencia', value: 0.92, unit: '',   trend: 'stable', trendValue: 0 },
  ],
}

// ---------------------------------------------------------------------------
// Generador de telemetría (usado como fallback si el backend no responde)
// ---------------------------------------------------------------------------

export function generateTelemetry(
  _variable: string,
  range: '1h' | '24h' | '7d' | '30d',
  baseValue: number,
  noise = 5,
): TelemetryPoint[] {
  const now = new Date()
  const points: TelemetryPoint[] = []

  const config = {
    '1h':  { count: 60,  stepMin: 1 },
    '24h': { count: 96,  stepMin: 15 },
    '7d':  { count: 168, stepMin: 60 },
    '30d': { count: 120, stepMin: 360 },
  }[range]

  let val = baseValue
  for (let i = config.count; i >= 0; i--) {
    const t = new Date(now.getTime() - i * config.stepMin * 60 * 1000)
    val += (Math.random() - 0.5) * noise * 0.3
    val = Math.max(0, val)
    points.push({ time: format(t, "yyyy-MM-dd'T'HH:mm:ss"), value: parseFloat(val.toFixed(2)) })
  }
  return points
}

// ---------------------------------------------------------------------------
// KPIs demo (fallback)
// ---------------------------------------------------------------------------

export const AGRO_KPIS = {
  activeDevices: 1,
  offlineDevices: 0,
  avgSoilMoisture: 45.0,
  alertsThisWeek: 0,
  frostRiskLevel: 'low' as const,
  devicesWithStress: 0,
}

export const ENERGIA_KPIS = {
  totalKwh: 0,
  avgPowerFactor: 0.92,
  peakHours: '18:00–21:00',
  anomaliesDetected: 0,
  efficiencyPct: null,
  kwh_trend: null,
}
