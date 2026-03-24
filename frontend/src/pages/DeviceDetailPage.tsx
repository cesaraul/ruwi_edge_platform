import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, MapPin, RefreshCw, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { useDevice, useDeviceVariables } from '../hooks/queries/useDevices'
import { useTelemetry } from '../hooks/queries/useTelemetry'
import { useAlerts } from '../hooks/queries/useAlerts'
import { useAcknowledgeAlert } from '../hooks/queries/useDevices'
import { DeviceStatusBadge } from '../components/devices/DeviceStatusBadge'
import { TimeseriesChart } from '../components/charts/TimeseriesChart'
import { AlertCard } from '../components/alerts/AlertCard'
import { VERTICAL_CONFIG, TIME_RANGES } from '../constants/verticals'
import { timeAgo } from '../lib/utils'
import type { TimeRange } from '../types/telemetry'
import type { DeviceVariable } from '../types/device'

const CHART_COLOR: Record<string, string> = {
  soil_moisture: '#3fb950',
  temperature:   '#388bfd',
  humidity:      '#56d364',
  battery:       '#d29922',
  power_factor:  '#79c0ff',
  kwh:           '#388bfd',
  voltage:       '#d29922',
  current:       '#f85149',
  efficiency_pct:'#3fb950',
  default:       '#8b949e',
}

function VariableCard({ v }: { v: DeviceVariable }) {
  return (
    <div className="bg-bg-surface border border-bg-border rounded-lg p-4">
      <p className="text-txt-muted text-xs mb-2">{v.label}</p>
      <div className="flex items-end gap-1.5">
        <span className="font-mono text-2xl font-bold text-txt-primary">{v.value.toFixed(1)}</span>
        <span className="text-txt-secondary text-sm mb-0.5">{v.unit}</span>
      </div>
      <div className="flex items-center gap-1 mt-2">
        {v.trend === 'up' && <TrendingUp className="h-3.5 w-3.5 text-status-ok" />}
        {v.trend === 'down' && <TrendingDown className="h-3.5 w-3.5 text-status-crit" />}
        {v.trend === 'stable' && <Minus className="h-3.5 w-3.5 text-txt-muted" />}
        <span className={`text-xs ${v.trend === 'up' ? 'text-status-ok' : v.trend === 'down' ? 'text-status-crit' : 'text-txt-muted'}`}>
          {v.trend === 'stable' ? 'Estable' : `${v.trend === 'up' ? '+' : '-'}${v.trendValue.toFixed(1)}${v.unit} vs hora ant.`}
        </span>
      </div>
    </div>
  )
}

function ChartSection({ deviceId, variables }: { deviceId: string; variables: DeviceVariable[] }) {
  const [selectedVar, setSelectedVar] = useState(variables[0]?.key ?? '')
  const [range, setRange] = useState<TimeRange>('24h')
  const { data = [], isFetching, refetch } = useTelemetry(deviceId, selectedVar, range)
  const v = variables.find((x) => x.key === selectedVar)

  return (
    <div className="bg-bg-surface border border-bg-border rounded-lg p-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        {/* Variable selector */}
        <select
          value={selectedVar}
          onChange={(e) => setSelectedVar(e.target.value)}
          className="bg-bg-elevated border border-bg-border rounded-md px-3 py-1.5 text-txt-primary text-sm
                     focus:outline-none focus:border-energy-primary"
        >
          {variables.map((v) => (
            <option key={v.key} value={v.key}>{v.label}</option>
          ))}
        </select>

        {/* Range tabs */}
        <div className="flex gap-1">
          {TIME_RANGES.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setRange(value)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                range === value
                  ? 'bg-energy-primary text-white'
                  : 'bg-bg-elevated text-txt-secondary hover:text-txt-primary border border-bg-border'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <button
          onClick={() => refetch()}
          className="ml-auto p-1.5 rounded-md hover:bg-bg-elevated text-txt-muted transition-colors"
          title="Actualizar"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <TimeseriesChart
        data={data}
        variable={selectedVar}
        unit={v?.unit ?? ''}
        color={CHART_COLOR[selectedVar] ?? CHART_COLOR.default}
        height={260}
      />
    </div>
  )
}

export function DeviceDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { data: device, isLoading } = useDevice(id)
  const { data: variables = [] } = useDeviceVariables(id)
  const { data: allAlerts = [] } = useAlerts()
  const { mutate: acknowledge, isPending } = useAcknowledgeAlert()
  const deviceAlerts = allAlerts.filter((a) => a.deviceId === id && !a.acknowledged)

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 w-64 bg-bg-surface rounded animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-bg-surface rounded-lg animate-pulse" />)}
        </div>
      </div>
    )
  }

  if (!device) {
    return (
      <div className="p-6 text-center text-txt-muted">
        <p>Dispositivo no encontrado</p>
      </div>
    )
  }

  const vcfg = VERTICAL_CONFIG[device.vertical]

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-txt-muted text-sm hover:text-txt-primary mb-3 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Volver
        </button>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">{vcfg.icon}</span>
              <h1 className="text-txt-primary text-xl font-semibold">{device.name}</h1>
              <DeviceStatusBadge status={device.status} />
            </div>
            <div className="flex items-center gap-3 text-txt-muted text-sm flex-wrap">
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" /> {device.locationName}
              </span>
              {device.altitudeMsnm && <span>{device.altitudeMsnm} msnm</span>}
              {device.cropType && <span>· {device.cropType}</span>}
              <span>· Actualizado {timeAgo(device.lastSeen)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Variable cards */}
      {variables.length > 0 && (
        <div>
          <h2 className="text-txt-secondary text-sm font-medium mb-3">Valores actuales</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {variables.map((v) => <VariableCard key={v.key} v={v} />)}
          </div>
        </div>
      )}

      {/* Timeseries chart */}
      {variables.length > 0 && device.status !== 'offline' && (
        <div>
          <h2 className="text-txt-secondary text-sm font-medium mb-3">Histórico</h2>
          <ChartSection deviceId={id} variables={variables} />
        </div>
      )}

      {/* Predictions (agro only) */}
      {device.vertical === 'agro' && (
        <div>
          <h2 className="text-txt-secondary text-sm font-medium mb-3">Predicciones</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <PredictionCard
              title="Riesgo de Helada"
              icon="🧊"
              level={device.status === 'critical' ? 'ALTO' : 'BAJO'}
              levelColor={device.status === 'critical' ? 'text-status-crit' : 'text-status-ok'}
              detail={device.status === 'critical'
                ? 'Temperatura proyectada: -3°C en 3h. Tomar medidas preventivas.'
                : 'Temperatura proyectada sobre umbral del cultivo en las próximas 6h.'}
            />
            <PredictionCard
              title="Estrés Hídrico"
              icon="💧"
              level={device.status === 'warning' || device.status === 'critical' ? 'MODERADO' : 'BAJO'}
              levelColor={device.status === 'warning' || device.status === 'critical' ? 'text-status-warn' : 'text-status-ok'}
              detail="Basado en tendencia de humedad de las últimas 12h."
            />
          </div>
        </div>
      )}

      {/* Active alerts */}
      {deviceAlerts.length > 0 && (
        <div>
          <h2 className="text-txt-secondary text-sm font-medium mb-3">
            Alertas activas ({deviceAlerts.length})
          </h2>
          <div className="space-y-3">
            {deviceAlerts.map((a) => (
              <AlertCard key={a.id} alert={a} onAcknowledge={acknowledge} isAcknowledging={isPending} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function PredictionCard({
  title, icon, level, levelColor, detail,
}: {
  title: string; icon: string; level: string; levelColor: string; detail: string
}) {
  return (
    <div className="bg-bg-surface border border-bg-border rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">{icon}</span>
        <span className="text-txt-secondary text-sm font-medium">{title}</span>
      </div>
      <p className={`font-bold text-lg mb-1 ${levelColor}`}>{level}</p>
      <p className="text-txt-muted text-xs">{detail}</p>
    </div>
  )
}
