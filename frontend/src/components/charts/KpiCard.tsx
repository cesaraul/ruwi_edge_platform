import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '../../lib/utils'

interface Props {
  label: string
  value: string | number
  unit?: string
  trend?: number
  trendLabel?: string
  icon?: string
  color?: string
  size?: 'sm' | 'md' | 'lg'
}

export function KpiCard({ label, value, unit, trend, trendLabel, icon, color = 'text-txt-primary', size = 'md' }: Props) {
  const isPositive = (trend ?? 0) > 0
  const isNeutral = trend === undefined || trend === 0

  return (
    <div className="rounded-lg bg-bg-surface border border-bg-border p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-txt-secondary text-xs font-medium uppercase tracking-wide">{label}</span>
        {icon && <span className="text-lg">{icon}</span>}
      </div>
      <div className="flex items-end gap-2">
        <span className={cn('font-bold font-mono', color,
          size === 'lg' ? 'text-4xl' : size === 'md' ? 'text-2xl' : 'text-xl'
        )}>
          {value}
        </span>
        {unit && <span className="text-txt-muted text-sm mb-0.5">{unit}</span>}
      </div>
      {trend !== undefined && (
        <div className="flex items-center gap-1 mt-2">
          {isNeutral ? (
            <Minus className="h-3 w-3 text-txt-muted" />
          ) : isPositive ? (
            <TrendingUp className="h-3 w-3 text-status-ok" />
          ) : (
            <TrendingDown className="h-3 w-3 text-status-crit" />
          )}
          <span className={cn('text-xs',
            isNeutral ? 'text-txt-muted' : isPositive ? 'text-status-ok' : 'text-status-crit'
          )}>
            {isPositive ? '+' : ''}{trend}% {trendLabel}
          </span>
        </div>
      )}
    </div>
  )
}
