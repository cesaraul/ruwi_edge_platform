export type TimeRange = '1h' | '24h' | '7d' | '30d'

export interface TelemetryPoint {
  time: string
  value: number
}

export interface SensorReading {
  deviceId: string
  variable: string
  value: number
  unit: string
  timestamp: string
  quality: number
}
