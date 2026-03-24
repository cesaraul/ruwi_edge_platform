import { create } from 'zustand'
import type { SensorReading } from '../types/telemetry'
import type { Alert } from '../types/alert'

interface WsState {
  connected: boolean
  lastReadings: Record<string, SensorReading>
  liveAlerts: Alert[]
  setConnected: (v: boolean) => void
  updateReading: (r: SensorReading) => void
  addAlert: (a: Alert) => void
  acknowledgeAlert: (id: string) => void
}

export const useWsStore = create<WsState>((set) => ({
  connected: false,
  lastReadings: {},
  liveAlerts: [],
  setConnected: (connected) => set({ connected }),
  updateReading: (r) =>
    set((s) => ({
      lastReadings: { ...s.lastReadings, [`${r.deviceId}:${r.variable}`]: r },
    })),
  addAlert: (a) =>
    set((s) => ({ liveAlerts: [a, ...s.liveAlerts].slice(0, 50) })),
  acknowledgeAlert: (id) =>
    set((s) => ({
      liveAlerts: s.liveAlerts.map((a) =>
        a.id === id ? { ...a, acknowledged: true } : a,
      ),
    })),
}))
