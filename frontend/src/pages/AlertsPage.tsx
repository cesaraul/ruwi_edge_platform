import { useState } from 'react'
import { Bell, CheckCheck } from 'lucide-react'
import { AlertCard } from '../components/alerts/AlertCard'
import { useAlerts } from '../hooks/queries/useAlerts'
import { useAcknowledgeAlert } from '../hooks/queries/useDevices'
import { acknowledgeAlert as apiAcknowledge } from '../lib/api'
import { queryClient } from '../lib/queryClient'
import type { AlertSeverity } from '../types/alert'
import type { Vertical } from '../types/device'

type Tab = 'pending' | 'acknowledged'
type SeverityFilter = 'all' | AlertSeverity
type VerticalFilter = 'all' | Vertical

export function AlertsPage() {
  const [tab, setTab] = useState<Tab>('pending')
  const [severity, setSeverity] = useState<SeverityFilter>('all')
  const [vertical, setVertical] = useState<VerticalFilter>('all')

  const { data: alerts = [], isLoading, refetch } = useAlerts()
  const { mutate: acknowledge, isPending } = useAcknowledgeAlert()

  async function acknowledgeAll() {
    const pending = alerts.filter((a) => !a.acknowledged)
    for (const a of pending) await apiAcknowledge(a.id)
    queryClient.invalidateQueries({ queryKey: ['alerts'] })
  }

  const filtered = alerts
    .filter((a) => (tab === 'pending' ? !a.acknowledged : a.acknowledged))
    .filter((a) => severity === 'all' || a.severity === severity)
    .filter((a) => vertical === 'all' || a.vertical === vertical)

  const pendingCount = alerts.filter((a) => !a.acknowledged).length

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-txt-secondary" />
          <h1 className="text-txt-primary text-xl font-semibold">Alertas</h1>
          {pendingCount > 0 && (
            <span className="bg-status-crit text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {pendingCount}
            </span>
          )}
        </div>
        {pendingCount > 0 && (
          <button
            onClick={acknowledgeAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-bg-elevated border border-bg-border
                       text-txt-secondary text-sm hover:text-txt-primary transition-colors"
          >
            <CheckCheck className="h-4 w-4" />
            Reconocer todas
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-bg-border mb-4">
        {([['pending', `Sin reconocer (${pendingCount})`], ['acknowledged', 'Reconocidas']] as [Tab, string][]).map(
          ([t, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                tab === t
                  ? 'text-txt-primary border-energy-primary'
                  : 'text-txt-muted border-transparent hover:text-txt-secondary'
              }`}
            >
              {label}
            </button>
          ),
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-5">
        <div className="flex gap-1">
          {(['all', 'critical', 'warning', 'info'] as SeverityFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setSeverity(s)}
              className={`px-2.5 py-1 rounded-md text-xs transition-colors border ${
                severity === s
                  ? 'bg-bg-elevated text-txt-primary border-energy-primary'
                  : 'text-txt-muted border-bg-border hover:border-bg-elevated'
              }`}
            >
              {s === 'all' ? 'Todos' : s === 'critical' ? '🔴 Crítico' : s === 'warning' ? '🟡 Aviso' : '🔵 Info'}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {(['all', 'agro', 'energia'] as VerticalFilter[]).map((v) => (
            <button
              key={v}
              onClick={() => setVertical(v)}
              className={`px-2.5 py-1 rounded-md text-xs transition-colors border ${
                vertical === v
                  ? 'bg-bg-elevated text-txt-primary border-energy-primary'
                  : 'text-txt-muted border-bg-border hover:border-bg-elevated'
              }`}
            >
              {v === 'all' ? 'Vertical' : v === 'agro' ? '🌱 Agro' : '⚡ Energía'}
            </button>
          ))}
        </div>
        <button
          onClick={() => refetch()}
          className="ml-auto px-2.5 py-1 rounded-md text-xs text-txt-muted border border-bg-border hover:text-txt-secondary transition-colors"
        >
          ↻ Actualizar
        </button>
      </div>

      {/* Alert list */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-28 bg-bg-surface rounded-lg animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">✅</p>
          <p className="text-txt-muted text-sm">
            {tab === 'pending' ? 'Sin alertas pendientes' : 'Sin alertas reconocidas'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((a) => (
            <AlertCard
              key={a.id}
              alert={a}
              onAcknowledge={acknowledge}
              isAcknowledging={isPending}
            />
          ))}
        </div>
      )}
    </div>
  )
}
