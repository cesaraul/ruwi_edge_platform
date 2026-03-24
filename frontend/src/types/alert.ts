import type { Vertical } from './device'

export type AlertSeverity = 'info' | 'warning' | 'critical'

export interface Alert {
  id: string
  deviceId: string
  deviceName: string
  orgId: string
  vertical: Vertical
  severity: AlertSeverity
  variable: string
  variableLabel: string
  value: number
  unit: string
  threshold: number
  message: string
  timestamp: string
  acknowledged: boolean
  acknowledgedBy?: string
  acknowledgedAt?: string
}
