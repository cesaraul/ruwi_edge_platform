import { useState } from 'react'
import { Settings, Cpu, Bell, Users, Building, Copy, Check, X, Eye, EyeOff, Loader2 } from 'lucide-react'
import { DeviceStatusBadge } from '../components/devices/DeviceStatusBadge'
import { useDevices, useCreateDevice, useDeleteDevice } from '../hooks/queries/useDevices'
import type { DeviceCreatePayload, DeviceCreated } from '../lib/api'

// ---------------------------------------------------------------------------
// Modal: formulario para crear dispositivo
// ---------------------------------------------------------------------------

const DEVICE_TYPES_AGRO    = ['soil_sensor', 'weather_station']
const DEVICE_TYPES_ENERGIA = ['energy_meter', 'transformer_monitor', 'solar_monitor']

const DEVICE_TYPE_LABELS: Record<string, string> = {
  soil_sensor:          'Sensor de suelo',
  weather_station:      'Estación meteorológica',
  energy_meter:         'Medidor de energía',
  transformer_monitor:  'Monitor de transformador',
  solar_monitor:        'Monitor solar',
}

function AddDeviceModal({ onClose, onCreated }: {
  onClose: () => void
  onCreated: (device: DeviceCreated) => void
}) {
  const { mutate, isPending } = useCreateDevice()

  const [form, setForm] = useState<{
    name: string
    vertical: 'agro' | 'energia'
    type: string
    location_name: string
    lat: string
    lng: string
    altitude_msnm: string
    crop_type: string
  }>({
    name: '',
    vertical: 'agro',
    type: 'soil_sensor',
    location_name: '',
    lat: '',
    lng: '',
    altitude_msnm: '',
    crop_type: '',
  })

  const [error, setError] = useState('')

  const typeOptions = form.vertical === 'agro' ? DEVICE_TYPES_AGRO : DEVICE_TYPES_ENERGIA

  function handleVerticalChange(v: 'agro' | 'energia') {
    const defaultType = v === 'agro' ? 'soil_sensor' : 'energy_meter'
    setForm((f) => ({ ...f, vertical: v, type: defaultType }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!form.name.trim()) { setError('El nombre es obligatorio'); return }

    const payload: DeviceCreatePayload = {
      name: form.name.trim(),
      vertical: form.vertical,
      type: form.type,
      location_name: form.location_name || undefined,
      lat: form.lat ? parseFloat(form.lat) : undefined,
      lng: form.lng ? parseFloat(form.lng) : undefined,
      altitude_msnm: form.altitude_msnm ? parseInt(form.altitude_msnm) : undefined,
      crop_type: form.vertical === 'agro' && form.crop_type ? form.crop_type : undefined,
    }

    mutate(payload, {
      onSuccess: (created) => onCreated(created),
      onError: (err: unknown) => {
        const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        setError(msg ?? 'Error al crear el dispositivo')
      },
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-bg-surface border border-bg-border rounded-xl w-full max-w-lg shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-bg-border">
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-energy-accent" />
            <h2 className="text-txt-primary font-semibold">Nuevo dispositivo</h2>
          </div>
          <button onClick={onClose} className="text-txt-muted hover:text-txt-primary transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Nombre */}
          <div>
            <label className="block text-txt-muted text-xs mb-1.5">Nombre *</label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Ej: Sensor Parcela Norte B"
              className="w-full bg-bg-elevated border border-bg-border rounded-md px-3 py-2 text-txt-primary text-sm focus:outline-none focus:border-energy-primary placeholder:text-txt-muted"
            />
          </div>

          {/* Vertical */}
          <div>
            <label className="block text-txt-muted text-xs mb-1.5">Vertical *</label>
            <div className="flex gap-2">
              {(['agro', 'energia'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => handleVerticalChange(v)}
                  className={`flex-1 py-2 rounded-md text-sm font-medium border transition-colors ${
                    form.vertical === v
                      ? v === 'agro'
                        ? 'bg-agro-muted border-agro-accent text-agro-accent'
                        : 'bg-energy-muted border-energy-primary text-energy-accent'
                      : 'bg-bg-elevated border-bg-border text-txt-muted hover:text-txt-primary'
                  }`}
                >
                  {v === 'agro' ? '🌱 Agro' : '⚡ Energía'}
                </button>
              ))}
            </div>
          </div>

          {/* Tipo de dispositivo */}
          <div>
            <label className="block text-txt-muted text-xs mb-1.5">Tipo *</label>
            <select
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              className="w-full bg-bg-elevated border border-bg-border rounded-md px-3 py-2 text-txt-primary text-sm focus:outline-none focus:border-energy-primary"
            >
              {typeOptions.map((t) => (
                <option key={t} value={t}>{DEVICE_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>

          {/* Ubicación */}
          <div>
            <label className="block text-txt-muted text-xs mb-1.5">Ubicación</label>
            <input
              value={form.location_name}
              onChange={(e) => setForm((f) => ({ ...f, location_name: e.target.value }))}
              placeholder="Ej: Puno, Perú"
              className="w-full bg-bg-elevated border border-bg-border rounded-md px-3 py-2 text-txt-primary text-sm focus:outline-none focus:border-energy-primary placeholder:text-txt-muted"
            />
          </div>

          {/* Coordenadas */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-txt-muted text-xs mb-1.5">Latitud</label>
              <input
                value={form.lat}
                onChange={(e) => setForm((f) => ({ ...f, lat: e.target.value }))}
                placeholder="-15.840"
                type="number"
                step="any"
                className="w-full bg-bg-elevated border border-bg-border rounded-md px-3 py-2 text-txt-primary text-sm focus:outline-none focus:border-energy-primary placeholder:text-txt-muted"
              />
            </div>
            <div>
              <label className="block text-txt-muted text-xs mb-1.5">Longitud</label>
              <input
                value={form.lng}
                onChange={(e) => setForm((f) => ({ ...f, lng: e.target.value }))}
                placeholder="-70.021"
                type="number"
                step="any"
                className="w-full bg-bg-elevated border border-bg-border rounded-md px-3 py-2 text-txt-primary text-sm focus:outline-none focus:border-energy-primary placeholder:text-txt-muted"
              />
            </div>
            <div>
              <label className="block text-txt-muted text-xs mb-1.5">Altitud (msnm)</label>
              <input
                value={form.altitude_msnm}
                onChange={(e) => setForm((f) => ({ ...f, altitude_msnm: e.target.value }))}
                placeholder="3850"
                type="number"
                className="w-full bg-bg-elevated border border-bg-border rounded-md px-3 py-2 text-txt-primary text-sm focus:outline-none focus:border-energy-primary placeholder:text-txt-muted"
              />
            </div>
          </div>

          {/* Cultivo (solo agro) */}
          {form.vertical === 'agro' && (
            <div>
              <label className="block text-txt-muted text-xs mb-1.5">Cultivo</label>
              <input
                value={form.crop_type}
                onChange={(e) => setForm((f) => ({ ...f, crop_type: e.target.value }))}
                placeholder="Ej: Papa andina, Quinua, Maíz costa"
                className="w-full bg-bg-elevated border border-bg-border rounded-md px-3 py-2 text-txt-primary text-sm focus:outline-none focus:border-energy-primary placeholder:text-txt-muted"
              />
            </div>
          )}

          {error && (
            <p className="text-status-crit text-xs bg-red-950/30 border border-red-900/40 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 border border-bg-border rounded-md text-txt-muted text-sm hover:text-txt-primary hover:border-txt-secondary transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 py-2 bg-energy-primary hover:bg-blue-500 disabled:opacity-50 rounded-md text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isPending ? 'Creando…' : 'Crear dispositivo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Modal: credenciales generadas
// ---------------------------------------------------------------------------

function CopyField({ label, value, secret }: { label: string; value: string; secret?: boolean }) {
  const [copied, setCopied] = useState(false)
  const [visible, setVisible] = useState(!secret)

  function copy() {
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div>
      <label className="block text-txt-muted text-xs mb-1.5">{label}</label>
      <div className="flex items-center gap-2 bg-bg-base border border-bg-border rounded-md px-3 py-2">
        <code className="flex-1 text-xs text-txt-primary font-mono break-all leading-relaxed">
          {secret && !visible ? '•'.repeat(Math.min(value.length, 32)) : value}
        </code>
        {secret && (
          <button onClick={() => setVisible((v) => !v)} className="text-txt-muted hover:text-txt-primary flex-shrink-0">
            {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        )}
        <button onClick={copy} className="text-txt-muted hover:text-energy-accent flex-shrink-0 transition-colors">
          {copied ? <Check className="h-3.5 w-3.5 text-status-ok" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  )
}

function CredentialsModal({ device, onClose }: { device: DeviceCreated; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-bg-surface border border-bg-border rounded-xl w-full max-w-lg shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-bg-border">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-status-ok" />
            <h2 className="text-txt-primary font-semibold">Dispositivo creado</h2>
          </div>
          <button onClick={onClose} className="text-txt-muted hover:text-txt-primary transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Aviso */}
          <div className="bg-yellow-950/30 border border-yellow-800/40 rounded-md px-4 py-3">
            <p className="text-yellow-400 text-xs font-medium mb-1">⚠ Guarda estas credenciales ahora</p>
            <p className="text-txt-muted text-xs">
              La API Key solo se muestra una vez. Cópiala antes de cerrar esta ventana y guárdala en el firmware de tu dispositivo.
            </p>
          </div>

          {/* Credenciales */}
          <CopyField label="Device ID (DEVICE_ID en el firmware)" value={device.id} />
          <CopyField label="Org ID (ORG_ID en el firmware)" value={device.orgId} />
          <CopyField label="API Key — usuario y contraseña MQTT" value={device.apiKey} secret />

          {/* Topic de ejemplo */}
          <div>
            <label className="block text-txt-muted text-xs mb-1.5">Topic MQTT para telemetría</label>
            <div className="bg-bg-base border border-bg-border rounded-md px-3 py-2">
              <code className="text-xs text-agro-accent font-mono break-all">
                /{device.vertical}/{device.orgId}/{device.id}/telemetry
              </code>
            </div>
          </div>

          {/* Payload de ejemplo */}
          <div>
            <label className="block text-txt-muted text-xs mb-1.5">Payload JSON de ejemplo</label>
            <div className="bg-bg-base border border-bg-border rounded-md px-3 py-2">
              <pre className="text-xs text-txt-secondary font-mono">
{device.vertical === 'agro'
  ? `{"variables":{"soil_moisture":45.2,"temperature":18.1,"humidity":67,"battery":85}}`
  : `{"variables":{"voltage":220.0,"current":13.5,"power_kw":2.97,"power_factor":0.92}}`}
              </pre>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-full py-2.5 bg-energy-primary hover:bg-blue-500 rounded-md text-white text-sm font-medium transition-colors"
          >
            Entendido, ya guardé las credenciales
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Modal: confirmación de borrado
// ---------------------------------------------------------------------------

function DeleteConfirmModal({ name, onConfirm, onClose, isPending }: {
  name: string
  onConfirm: () => void
  onClose: () => void
  isPending: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-bg-surface border border-bg-border rounded-xl w-full max-w-sm shadow-2xl p-6 space-y-4">
        <h2 className="text-txt-primary font-semibold">¿Eliminar dispositivo?</h2>
        <p className="text-txt-muted text-sm">
          Se eliminará <span className="text-txt-primary font-medium">{name}</span> y todos sus datos históricos. Esta acción no se puede deshacer.
        </p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 border border-bg-border rounded-md text-txt-muted text-sm hover:text-txt-primary transition-colors">
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="flex-1 py-2 bg-status-crit hover:bg-red-600 disabled:opacity-50 rounded-md text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {isPending ? 'Eliminando…' : 'Eliminar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sección de dispositivos
// ---------------------------------------------------------------------------

function DevicesSection() {
  const { data: devices = [], isLoading } = useDevices()
  const { mutate: deleteDev, isPending: isDeleting } = useDeleteDevice()

  const [showAdd, setShowAdd]           = useState(false)
  const [credentials, setCredentials]   = useState<DeviceCreated | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)

  function handleCreated(device: DeviceCreated) {
    setShowAdd(false)
    setCredentials(device)
  }

  function handleDelete() {
    if (!deleteTarget) return
    deleteDev(deleteTarget.id, {
      onSuccess: () => setDeleteTarget(null),
    })
  }

  return (
    <>
      <section className="bg-bg-surface border border-bg-border rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-bg-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-txt-secondary" />
            <h2 className="text-txt-primary font-medium">Dispositivos</h2>
            <span className="text-xs text-txt-muted bg-bg-elevated px-2 py-0.5 rounded-full">
              {isLoading ? '…' : devices.length}
            </span>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="px-3 py-1.5 bg-energy-primary hover:bg-blue-500 text-white text-xs rounded-md transition-colors"
          >
            + Agregar
          </button>
        </div>

        <div className="divide-y divide-bg-border">
          {isLoading && (
            <div className="px-5 py-4 flex items-center gap-2 text-txt-muted text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
            </div>
          )}
          {!isLoading && devices.length === 0 && (
            <div className="px-5 py-6 text-center text-txt-muted text-sm">
              No hay dispositivos aún. Agrega el primero.
            </div>
          )}
          {devices.map((d) => (
            <div key={d.id} className="px-5 py-3 flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-txt-primary text-sm font-medium truncate">{d.name}</p>
                <p className="text-txt-muted text-xs">{DEVICE_TYPE_LABELS[d.type] ?? d.type} · {d.locationName || '—'}</p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                <DeviceStatusBadge status={d.status} size="sm" />
                <button
                  onClick={() => setDeleteTarget({ id: d.id, name: d.name })}
                  title="Eliminar dispositivo"
                  className="text-txt-muted hover:text-status-crit text-sm transition-colors"
                >
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {showAdd && (
        <AddDeviceModal onClose={() => setShowAdd(false)} onCreated={handleCreated} />
      )}
      {credentials && (
        <CredentialsModal device={credentials} onClose={() => setCredentials(null)} />
      )}
      {deleteTarget && (
        <DeleteConfirmModal
          name={deleteTarget.name}
          onConfirm={handleDelete}
          onClose={() => setDeleteTarget(null)}
          isPending={isDeleting}
        />
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Página principal
// ---------------------------------------------------------------------------

export function SettingsPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Settings className="h-5 w-5 text-txt-secondary" />
        <h1 className="text-txt-primary text-xl font-semibold">Configuración</h1>
      </div>

      <div className="space-y-6">
        {/* Dispositivos — totalmente funcional */}
        <DevicesSection />

        {/* Reglas de Alerta */}
        <section className="bg-bg-surface border border-bg-border rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-bg-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-txt-secondary" />
              <h2 className="text-txt-primary font-medium">Reglas de Alerta</h2>
            </div>
            <button className="px-3 py-1.5 bg-energy-primary hover:bg-blue-500 text-white text-xs rounded-md transition-colors">
              + Nueva regla
            </button>
          </div>
          <div className="px-5 py-4 divide-y divide-bg-border">
            {[
              { name: 'Riesgo helada papa',  device: 'Parcelas Puno', cond: 'temp < 2°C',    sev: 'critical', active: true },
              { name: 'Humedad crítica',     device: 'Sensores agro', cond: 'humedad < 25%', sev: 'critical', active: true },
              { name: 'Factor potencia',     device: 'Medidores',     cond: 'FP < 0.85',     sev: 'warning',  active: true },
              { name: 'Batería baja',        device: 'Todos',         cond: 'batería < 20%', sev: 'warning',  active: false },
            ].map((r) => (
              <div key={r.name} className="py-3 flex items-center justify-between">
                <div>
                  <p className="text-txt-primary text-sm font-medium">{r.name}</p>
                  <p className="text-txt-muted text-xs">{r.device} · {r.cond}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-medium ${r.sev === 'critical' ? 'text-status-crit' : 'text-status-warn'}`}>
                    {r.sev === 'critical' ? '🔴' : '🟡'} {r.sev}
                  </span>
                  <button className={`relative w-10 h-5 rounded-full transition-colors ${r.active ? 'bg-energy-primary' : 'bg-bg-elevated border border-bg-border'}`}>
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${r.active ? 'left-5' : 'left-0.5'}`} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Notificaciones */}
        <section className="bg-bg-surface border border-bg-border rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-bg-border flex items-center gap-2">
            <Bell className="h-4 w-4 text-txt-secondary" />
            <h2 className="text-txt-primary font-medium">Notificaciones</h2>
          </div>
          <div className="px-5 py-4 space-y-4">
            {[
              { ch: '💬 WhatsApp', desc: 'Alertas via Twilio WhatsApp API', active: true },
              { ch: '📧 Email',    desc: 'Alertas via Resend',              active: false },
              { ch: '🔗 Webhook',  desc: 'POST a URL personalizada',         active: false },
            ].map((n) => (
              <div key={n.ch} className="flex items-center justify-between">
                <div>
                  <p className="text-txt-primary text-sm">{n.ch}</p>
                  <p className="text-txt-muted text-xs">{n.desc}</p>
                </div>
                <button className={`relative w-10 h-5 rounded-full transition-colors ${n.active ? 'bg-energy-primary' : 'bg-bg-elevated border border-bg-border'}`}>
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${n.active ? 'left-5' : 'left-0.5'}`} />
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Usuarios */}
        <section className="bg-bg-surface border border-bg-border rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-bg-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-txt-secondary" />
              <h2 className="text-txt-primary font-medium">Usuarios</h2>
            </div>
            <button className="px-3 py-1.5 bg-energy-primary hover:bg-blue-500 text-white text-xs rounded-md transition-colors">
              + Invitar
            </button>
          </div>
          <div className="divide-y divide-bg-border">
            {[
              { email: 'admin@ruwi.io',    role: 'admin' },
              { email: 'tecnico@agro.pe',  role: 'viewer' },
            ].map((u) => (
              <div key={u.email} className="px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-energy-muted flex items-center justify-center text-xs text-energy-accent font-bold">
                    {u.email[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-txt-primary text-sm">{u.email}</p>
                    <p className="text-txt-muted text-xs capitalize">{u.role}</p>
                  </div>
                </div>
                <span className="text-xs text-status-ok">● Activo</span>
              </div>
            ))}
          </div>
        </section>

        {/* Organización */}
        <section className="bg-bg-surface border border-bg-border rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-bg-border flex items-center gap-2">
            <Building className="h-4 w-4 text-txt-secondary" />
            <h2 className="text-txt-primary font-medium">Organización</h2>
          </div>
          <div className="px-5 py-5 space-y-4">
            <div>
              <label className="block text-txt-muted text-xs mb-1.5">Nombre</label>
              <input
                defaultValue="Ruwi Demo"
                className="w-full max-w-sm bg-bg-elevated border border-bg-border rounded-md px-3 py-2 text-txt-primary text-sm focus:outline-none focus:border-energy-primary"
              />
            </div>
            <div>
              <label className="block text-txt-muted text-xs mb-1.5">Plan</label>
              <span className="text-sm text-agro-accent bg-agro-muted px-3 py-1 rounded-md">Starter MVP</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
