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
  locationName: string
  altitudeMsnm?: number
  cropType?: string
  lastSeen: string
  metadata: Record<string, unknown>
}

export interface DeviceVariable {
  key: string
  label: string
  value: number
  unit: string
  trend: 'up' | 'down' | 'stable'
  trendValue: number
}
