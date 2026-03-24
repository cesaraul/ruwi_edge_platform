import { useAppStore } from '../stores/appStore'
import { useKPIs } from '../hooks/queries/useKPIs'
import { KpiCard } from '../components/charts/KpiCard'
import type { Vertical } from '../types/device'

export function AnalyticsPage() {
  const { activeVertical, setVertical } = useAppStore()
  const vertical: Vertical = activeVertical === 'all' ? 'agro' : activeVertical

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-txt-primary text-xl font-semibold">Analytics</h1>
        <div className="flex gap-2">
          {(['agro', 'energia'] as Vertical[]).map((v) => (
            <button
              key={v}
              onClick={() => setVertical(v)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                vertical === v
                  ? v === 'agro'
                    ? 'bg-agro-muted text-agro-accent border border-agro-primary'
                    : 'bg-energy-muted text-energy-accent border border-energy-primary'
                  : 'bg-bg-elevated text-txt-secondary border border-bg-border hover:text-txt-primary'
              }`}
            >
              {v === 'agro' ? '🌱 Agro' : '⚡ Energía'}
            </button>
          ))}
        </div>
      </div>

      {vertical === 'agro' ? (
        <AgroAnalytics />
      ) : (
        <EnergiaAnalytics />
      )}
    </div>
  )
}

function AgroAnalytics() {
  const { data, isLoading } = useKPIs('agro')

  if (isLoading) return <AnalyticsSkeleton />

  const d = data as {
    activeDevices: number; offlineDevices: number; avgSoilMoisture: number;
    alertsThisWeek: number; frostRiskLevel: string; devicesWithStress: number
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-txt-secondary text-sm font-medium mb-3 uppercase tracking-wide">KPIs Agro</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Dispositivos activos"
            value={d.activeDevices}
            icon="🌱"
            color="text-agro-accent"
          />
          <KpiCard
            label="Humedad prom. suelo"
            value={d.avgSoilMoisture.toFixed(1)}
            unit="%"
            icon="💧"
            color="text-energy-accent"
            trend={-2.1}
            trendLabel="vs semana"
          />
          <KpiCard
            label="Riesgo de Helada"
            value={d.frostRiskLevel.toUpperCase()}
            icon="🧊"
            color={d.frostRiskLevel === 'high' ? 'text-status-crit' : 'text-status-ok'}
          />
          <KpiCard
            label="Alertas esta semana"
            value={d.alertsThisWeek}
            icon="⚠️"
            color="text-status-warn"
            trend={-3}
            trendLabel="vs semana ant."
          />
          <KpiCard
            label="Con estrés hídrico"
            value={d.devicesWithStress}
            icon="🔴"
            color="text-status-crit"
          />
          <KpiCard
            label="Sin señal"
            value={d.offlineDevices}
            icon="⚫"
            color="text-status-off"
          />
        </div>
      </div>

      <div>
        <h2 className="text-txt-secondary text-sm font-medium mb-3 uppercase tracking-wide">Estado por cultivo</h2>
        <div className="bg-bg-surface border border-bg-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-bg-border">
                <th className="px-4 py-3 text-left text-txt-muted font-medium">Cultivo</th>
                <th className="px-4 py-3 text-left text-txt-muted font-medium">Dispositivos</th>
                <th className="px-4 py-3 text-left text-txt-muted font-medium">Hum. Prom.</th>
                <th className="px-4 py-3 text-left text-txt-muted font-medium">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bg-border">
              {[
                { crop: 'Papa andina', devices: 3, moisture: 32.3, status: 'warning' },
                { crop: 'Quinua',      devices: 1, moisture: 58.2, status: 'online' },
                { crop: 'Maíz costa', devices: 1, moisture: 61.0, status: 'offline' },
              ].map((row) => (
                <tr key={row.crop} className="hover:bg-bg-elevated transition-colors">
                  <td className="px-4 py-3 text-txt-primary font-medium">{row.crop}</td>
                  <td className="px-4 py-3 text-txt-secondary">{row.devices}</td>
                  <td className="px-4 py-3 font-mono text-txt-primary">{row.moisture}%</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium ${
                      row.status === 'online' ? 'text-status-ok' :
                      row.status === 'warning' ? 'text-status-warn' : 'text-status-off'
                    }`}>
                      {row.status === 'online' ? '● OK' : row.status === 'warning' ? '● Aviso' : '● Sin señal'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <InfoBanner
        text="Los datos predictivos (riesgo de helada, estrés hídrico) se activarán con el módulo AI en Fase 2."
      />
    </div>
  )
}

function EnergiaAnalytics() {
  const { data, isLoading } = useKPIs('energia')

  if (isLoading) return <AnalyticsSkeleton />

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = (data ?? {}) as any

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-txt-secondary text-sm font-medium mb-3 uppercase tracking-wide">KPIs Energía</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Consumo total (mes)"
            value={d.totalKwh.toLocaleString()}
            unit="kWh"
            icon="⚡"
            color="text-energy-accent"
            trend={d.kwh_trend}
            trendLabel="vs mes ant."
          />
          <KpiCard
            label="Factor de potencia prom."
            value={d.avgPowerFactor.toFixed(2)}
            icon="📊"
            color={d.avgPowerFactor >= 0.85 ? 'text-status-ok' : 'text-status-warn'}
          />
          <KpiCard
            label="Horas pico"
            value={d.peakHours}
            icon="📈"
            color="text-status-warn"
          />
          <KpiCard
            label="Anomalías detectadas"
            value={d.anomaliesDetected}
            icon="⚠️"
            color={d.anomaliesDetected > 5 ? 'text-status-crit' : 'text-status-warn'}
            trend={-2}
            trendLabel="vs semana ant."
          />
          <KpiCard
            label="Eficiencia general"
            value={d.efficiencyPct.toFixed(1)}
            unit="%"
            icon="✅"
            color="text-status-ok"
          />
        </div>
      </div>

      <div>
        <h2 className="text-txt-secondary text-sm font-medium mb-3 uppercase tracking-wide">Resumen por dispositivo</h2>
        <div className="bg-bg-surface border border-bg-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-bg-border">
                <th className="px-4 py-3 text-left text-txt-muted font-medium">Dispositivo</th>
                <th className="px-4 py-3 text-left text-txt-muted font-medium">Consumo (kWh)</th>
                <th className="px-4 py-3 text-left text-txt-muted font-medium">Factor P.</th>
                <th className="px-4 py-3 text-left text-txt-muted font-medium">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bg-border">
              {[
                { name: 'Medidor Planta A',    kwh: 48.7,  fp: 0.93, status: 'online' },
                { name: 'Transformador B-2',   kwh: 124.5, fp: 0.82, status: 'warning' },
                { name: 'Panel Solar Norte',   kwh: 4.35,  fp: 1.0,  status: 'online' },
              ].map((row) => (
                <tr key={row.name} className="hover:bg-bg-elevated transition-colors">
                  <td className="px-4 py-3 text-txt-primary font-medium">{row.name}</td>
                  <td className="px-4 py-3 font-mono text-txt-primary">{row.kwh}</td>
                  <td className={`px-4 py-3 font-mono font-semibold ${row.fp >= 0.85 ? 'text-status-ok' : 'text-status-warn'}`}>
                    {row.fp.toFixed(2)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium ${
                      row.status === 'online' ? 'text-status-ok' : 'text-status-warn'
                    }`}>
                      {row.status === 'online' ? '● OK' : '● Aviso'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <InfoBanner
        text="Heatmap de consumo horario y predicción de demanda estarán disponibles en Fase 2 con datos históricos reales."
      />
    </div>
  )
}

function AnalyticsSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {[...Array(8)].map((_, i) => (
        <div key={i} className="h-24 bg-bg-surface rounded-lg animate-pulse" />
      ))}
    </div>
  )
}

function InfoBanner({ text }: { text: string }) {
  return (
    <div className="bg-energy-muted border border-energy-primary rounded-lg px-4 py-3 text-energy-accent text-sm">
      ℹ️ {text}
    </div>
  )
}
