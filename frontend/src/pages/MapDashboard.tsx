import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Cpu } from 'lucide-react'
import { DeviceMap } from '../components/map/DeviceMap'
import { DeviceStatusBadge } from '../components/devices/DeviceStatusBadge'
import { AlertCard } from '../components/alerts/AlertCard'
import { useDevices } from '../hooks/queries/useDevices'
import { useAlerts } from '../hooks/queries/useAlerts'
import { useAcknowledgeAlert } from '../hooks/queries/useDevices'
import { useAppStore } from '../stores/appStore'
import { DEVICE_VARIABLES } from '../lib/mockData'
import { timeAgo } from '../lib/utils'
import { VERTICAL_CONFIG } from '../constants/verticals'
import type { Device } from '../types/device'

type PanelTab = 'devices' | 'alerts'

export function MapDashboard() {
  const { activeVertical } = useAppStore()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<PanelTab>('devices')

  const { data: allDevices = [] } = useDevices()
  const { data: activeAlerts = [] } = useAlerts(false)
  const { mutate: acknowledge, isPending } = useAcknowledgeAlert()

  const devices = activeVertical === 'all'
    ? allDevices
    : allDevices.filter((d) => d.vertical === activeVertical)

  const statusCounts = {
    online:   devices.filter((d) => d.status === 'online').length,
    warning:  devices.filter((d) => d.status === 'warning').length,
    critical: devices.filter((d) => d.status === 'critical').length,
    offline:  devices.filter((d) => d.status === 'offline').length,
  }

  const unread = activeAlerts.filter((a) => !a.acknowledged)

  return (
    <div className="h-full flex flex-col">
      {/* KPI strip */}
      <div className="bg-bg-surface border-b border-bg-border px-4 py-2 flex items-center gap-6 text-sm shrink-0">
        <div className="flex items-center gap-1.5">
          <Cpu className="h-4 w-4 text-txt-muted" />
          <span className="text-txt-secondary">{devices.length} dispositivos</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-status-ok">● {statusCounts.online} OK</span>
          {statusCounts.warning > 0 && <span className="text-status-warn">● {statusCounts.warning} Aviso</span>}
          {statusCounts.critical > 0 && <span className="text-status-crit animate-pulse">● {statusCounts.critical} Crítico</span>}
          {statusCounts.offline > 0 && <span className="text-txt-muted">● {statusCounts.offline} Sin señal</span>}
        </div>
        {unread.length > 0 && (
          <button
            onClick={() => navigate('/alerts')}
            className="ml-auto flex items-center gap-1.5 text-status-crit text-xs hover:underline"
          >
            <Bell className="h-3.5 w-3.5" />
            {unread.length} alerta{unread.length !== 1 ? 's' : ''} sin reconocer
          </button>
        )}
      </div>

      {/* Main: map + panel */}
      <div className="flex-1 flex overflow-hidden">
        {/* Map */}
        <div className="flex-1">
          <DeviceMap devices={devices} />
        </div>

        {/* Right panel */}
        <div className="w-72 bg-bg-surface border-l border-bg-border flex flex-col shrink-0">
          {/* Tabs */}
          <div className="flex border-b border-bg-border">
            {([['devices', 'Dispositivos'], ['alerts', 'Alertas']] as [PanelTab, string][]).map(([tab, label]) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? 'text-txt-primary border-b-2 border-energy-primary'
                    : 'text-txt-muted hover:text-txt-secondary'
                }`}
              >
                {label}
                {tab === 'alerts' && unread.length > 0 && (
                  <span className="ml-1.5 bg-status-crit text-white text-[10px] rounded-full px-1.5 py-0.5">
                    {unread.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Panel content */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === 'devices' ? (
              <DeviceListPanel devices={devices} />
            ) : (
              <AlertsPanel
                alerts={unread}
                onAcknowledge={acknowledge}
                isAcknowledging={isPending}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function DeviceListPanel({ devices }: { devices: Device[] }) {
  const navigate = useNavigate()

  if (!devices.length) {
    return (
      <div className="p-4 text-txt-muted text-sm text-center">
        No hay dispositivos para mostrar
      </div>
    )
  }

  return (
    <div className="divide-y divide-bg-border">
      {devices.map((d) => {
        const vars = DEVICE_VARIABLES[d.id] ?? []
        const vcfg = VERTICAL_CONFIG[d.vertical]
        return (
          <button
            key={d.id}
            onClick={() => navigate(`/devices/${d.id}`)}
            className="w-full text-left px-4 py-3 hover:bg-bg-elevated transition-colors"
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-sm">{vcfg.icon}</span>
                <span className="text-txt-primary text-sm font-medium truncate">{d.name}</span>
              </div>
              <DeviceStatusBadge status={d.status} size="sm" />
            </div>
            {vars[0] && d.status !== 'offline' && (
              <p className="text-txt-secondary text-xs">
                {vars[0].label}: <span className="font-mono">{vars[0].value.toFixed(1)}{vars[0].unit}</span>
              </p>
            )}
            <p className="text-txt-muted text-xs mt-0.5">{timeAgo(d.lastSeen)}</p>
          </button>
        )
      })}
    </div>
  )
}

function AlertsPanel({
  alerts,
  onAcknowledge,
  isAcknowledging,
}: {
  alerts: ReturnType<typeof useAlerts>['data']
  onAcknowledge: (id: string) => void
  isAcknowledging: boolean
}) {
  if (!alerts?.length) {
    return (
      <div className="p-4 text-center">
        <p className="text-status-ok text-sm">✓ Sin alertas activas</p>
      </div>
    )
  }

  return (
    <div className="p-3 space-y-3">
      {alerts.map((a) => (
        <AlertCard
          key={a.id}
          alert={a}
          onAcknowledge={onAcknowledge}
          isAcknowledging={isAcknowledging}
        />
      ))}
    </div>
  )
}
