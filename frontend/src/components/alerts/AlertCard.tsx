import { CheckCircle, ExternalLink } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { cn, timeAgo } from '../../lib/utils'
import { SEVERITY_CONFIG, VERTICAL_CONFIG } from '../../constants/verticals'
import type { Alert } from '../../types/alert'

interface Props {
  alert: Alert
  onAcknowledge?: (id: string) => void
  isAcknowledging?: boolean
}

const SEVERITY_ICON: Record<string, string> = {
  critical: '🔴',
  warning: '🟡',
  info: '🔵',
}

export function AlertCard({ alert, onAcknowledge, isAcknowledging }: Props) {
  const navigate = useNavigate()
  const scfg = SEVERITY_CONFIG[alert.severity]
  const vcfg = VERTICAL_CONFIG[alert.vertical]

  return (
    <div
      className={cn(
        'rounded-lg border p-4',
        alert.acknowledged ? 'bg-bg-surface border-bg-border opacity-60' : scfg.bg,
      )}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span className="text-base">{SEVERITY_ICON[alert.severity]}</span>
          <span className={cn('font-semibold text-sm uppercase tracking-wide', scfg.color)}>
            {scfg.label}
          </span>
          <span className="text-txt-muted text-xs">·</span>
          <span className={cn('text-xs', vcfg.color)}>{vcfg.icon} {vcfg.label}</span>
        </div>
        <span className="text-xs text-txt-muted shrink-0">{timeAgo(alert.timestamp)}</span>
      </div>

      {/* Device + variable */}
      <p className="text-txt-primary text-sm font-medium mb-1">{alert.deviceName}</p>
      <p className="text-txt-secondary text-sm mb-2">
        {alert.variableLabel}:{' '}
        <span className={cn('font-mono font-semibold', scfg.color)}>
          {alert.value.toFixed(1)}{alert.unit}
        </span>
        {' '}(umbral: {alert.threshold}{alert.unit})
      </p>
      <p className="text-txt-muted text-xs mb-3">{alert.message}</p>

      {/* Actions */}
      {!alert.acknowledged && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => onAcknowledge?.(alert.id)}
            disabled={isAcknowledging}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-bg-elevated border border-bg-border
                       text-txt-primary text-xs hover:bg-bg-surface transition-colors disabled:opacity-50"
          >
            <CheckCircle className="h-3.5 w-3.5 text-status-ok" />
            Reconocer
          </button>
          <button
            onClick={() => navigate(`/devices/${alert.deviceId}`)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-bg-elevated border border-bg-border
                       text-txt-secondary text-xs hover:bg-bg-surface transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Ver dispositivo
          </button>
        </div>
      )}

      {alert.acknowledged && (
        <p className="text-xs text-txt-muted">
          ✓ Reconocida por {alert.acknowledgedBy} · {timeAgo(alert.acknowledgedAt!)}
        </p>
      )}
    </div>
  )
}
