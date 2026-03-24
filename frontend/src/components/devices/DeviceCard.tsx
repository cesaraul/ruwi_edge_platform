import { useNavigate } from 'react-router-dom'
import { TrendingUp, TrendingDown, Minus, WifiOff, Clock } from 'lucide-react'
import { cn, timeAgo } from '../../lib/utils'
import { DeviceStatusBadge } from './DeviceStatusBadge'
import { VERTICAL_CONFIG } from '../../constants/verticals'
import type { Device, DeviceVariable } from '../../types/device'

interface Props {
  device: Device
  variables?: DeviceVariable[]
}

const STATUS_BORDER: Record<string, string> = {
  online:   'border-l-status-ok',
  warning:  'border-l-status-warn',
  critical: 'border-l-status-crit',
  offline:  'border-l-status-off',
}

function TrendIcon({ trend }: { trend: 'up' | 'down' | 'stable' }) {
  if (trend === 'up') return <TrendingUp className="h-3 w-3 text-status-ok" />
  if (trend === 'down') return <TrendingDown className="h-3 w-3 text-status-crit" />
  return <Minus className="h-3 w-3 text-txt-muted" />
}

export function DeviceCard({ device, variables = [] }: Props) {
  const navigate = useNavigate()
  const vcfg = VERTICAL_CONFIG[device.vertical]
  const displayed = variables.slice(0, 3)

  return (
    <button
      onClick={() => navigate(`/devices/${device.id}`)}
      className={cn(
        'w-full text-left rounded-lg bg-bg-surface border border-bg-border border-l-4',
        'hover:bg-bg-elevated transition-colors duration-150 p-4',
        STATUS_BORDER[device.status],
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <p className="text-txt-primary font-medium text-sm truncate">{device.name}</p>
          <p className="text-txt-muted text-xs mt-0.5 truncate">{device.locationName}</p>
        </div>
        <DeviceStatusBadge status={device.status} size="sm" />
      </div>

      {/* Vertical badge */}
      <div className={cn('inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded mb-3', vcfg.bgMuted, vcfg.color)}>
        {vcfg.icon} {vcfg.label}
        {device.cropType && <span className="text-txt-muted">· {device.cropType}</span>}
      </div>

      {/* Variables */}
      {device.status !== 'offline' && displayed.length > 0 ? (
        <div className="space-y-1.5">
          {displayed.map((v) => (
            <div key={v.key} className="flex items-center justify-between">
              <span className="text-xs text-txt-secondary">{v.label}</span>
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-xs text-txt-primary">
                  {v.value.toFixed(1)}{v.unit}
                </span>
                <TrendIcon trend={v.trend} />
              </div>
            </div>
          ))}
        </div>
      ) : device.status === 'offline' ? (
        <div className="flex items-center gap-1.5 text-txt-muted text-xs">
          <WifiOff className="h-3 w-3" />
          Sin datos
        </div>
      ) : null}

      {/* Last seen */}
      <div className="flex items-center gap-1 mt-3 pt-3 border-t border-bg-border">
        <Clock className="h-3 w-3 text-txt-muted" />
        <span className="text-xs text-txt-muted">{timeAgo(device.lastSeen)}</span>
      </div>
    </button>
  )
}
