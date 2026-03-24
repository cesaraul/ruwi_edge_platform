import type { Vertical } from '../types/device'

export const VERTICAL_CONFIG: Record<
  Vertical,
  { label: string; color: string; bgMuted: string; icon: string }
> = {
  agro: {
    label: 'Agro',
    color: 'text-agro-accent',
    bgMuted: 'bg-agro-muted',
    icon: '🌱',
  },
  energia: {
    label: 'Energía',
    color: 'text-energy-accent',
    bgMuted: 'bg-energy-muted',
    icon: '⚡',
  },
}

export const STATUS_CONFIG = {
  online:   { label: 'En línea',  color: 'text-status-ok',   bg: 'bg-status-ok',   dot: '🟢' },
  warning:  { label: 'Aviso',     color: 'text-status-warn', bg: 'bg-status-warn', dot: '🟡' },
  critical: { label: 'Crítico',   color: 'text-status-crit', bg: 'bg-status-crit', dot: '🔴' },
  offline:  { label: 'Sin señal', color: 'text-status-off',  bg: 'bg-status-off',  dot: '⚫' },
}

export const SEVERITY_CONFIG = {
  critical: { label: 'Crítico', color: 'text-status-crit', bg: 'bg-red-950 border-status-crit' },
  warning:  { label: 'Aviso',   color: 'text-status-warn', bg: 'bg-yellow-950 border-status-warn' },
  info:     { label: 'Info',    color: 'text-energy-accent', bg: 'bg-blue-950 border-energy-primary' },
}

export const TIME_RANGES = [
  { value: '1h',  label: '1h' },
  { value: '24h', label: '24h' },
  { value: '7d',  label: '7 días' },
  { value: '30d', label: '30 días' },
] as const
