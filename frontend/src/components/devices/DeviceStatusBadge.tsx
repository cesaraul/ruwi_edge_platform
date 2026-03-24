import { cn } from '../../lib/utils'
import { STATUS_CONFIG } from '../../constants/verticals'
import type { DeviceStatus } from '../../types/device'

interface Props {
  status: DeviceStatus
  size?: 'sm' | 'md'
}

export function DeviceStatusBadge({ status, size = 'md' }: Props) {
  const cfg = STATUS_CONFIG[status]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm',
        cfg.color,
        'bg-bg-elevated border border-bg-border',
      )}
    >
      <span
        className={cn(
          'rounded-full',
          size === 'sm' ? 'h-1.5 w-1.5' : 'h-2 w-2',
          cfg.bg,
          status === 'online' && 'animate-pulse',
        )}
      />
      {cfg.label}
    </span>
  )
}
