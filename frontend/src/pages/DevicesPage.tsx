import { useState } from 'react'
import { Search } from 'lucide-react'
import { DeviceCard } from '../components/devices/DeviceCard'
import { useDevices } from '../hooks/queries/useDevices'
import { useAppStore } from '../stores/appStore'
import { DEVICE_VARIABLES } from '../lib/mockData'
import type { DeviceStatus } from '../types/device'

const STATUS_FILTERS: { value: 'all' | DeviceStatus; label: string }[] = [
  { value: 'all',      label: 'Todos' },
  { value: 'online',   label: '🟢 En línea' },
  { value: 'warning',  label: '🟡 Aviso' },
  { value: 'critical', label: '🔴 Crítico' },
  { value: 'offline',  label: '⚫ Sin señal' },
]

export function DevicesPage() {
  const { activeVertical } = useAppStore()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | DeviceStatus>('all')

  const { data: allDevices = [], isLoading } = useDevices()

  const filtered = allDevices.filter((d) => {
    if (activeVertical !== 'all' && d.vertical !== activeVertical) return false
    if (statusFilter !== 'all' && d.status !== statusFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return d.name.toLowerCase().includes(q) || d.locationName.toLowerCase().includes(q)
    }
    return true
  })

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-txt-primary text-xl font-semibold">Dispositivos</h1>
          <p className="text-txt-muted text-sm mt-0.5">{filtered.length} dispositivos</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-txt-muted" />
          <input
            type="text"
            placeholder="Buscar dispositivo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-bg-elevated border border-bg-border rounded-md pl-9 pr-3 py-2
                       text-txt-primary text-sm placeholder-txt-muted focus:outline-none
                       focus:border-energy-primary transition-colors"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {STATUS_FILTERS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setStatusFilter(value)}
              className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                statusFilter === value
                  ? 'bg-bg-elevated text-txt-primary border border-energy-primary'
                  : 'bg-bg-elevated text-txt-secondary border border-bg-border hover:border-bg-border'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-44 rounded-lg bg-bg-surface border border-bg-border animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-txt-muted">
          <p className="text-4xl mb-3">📭</p>
          <p>No se encontraron dispositivos</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((d) => (
            <DeviceCard key={d.id} device={d} variables={DEVICE_VARIABLES[d.id]} />
          ))}
        </div>
      )}
    </div>
  )
}
