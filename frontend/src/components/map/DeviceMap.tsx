import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet'
import { useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import type { Device } from '../../types/device'
import { VERTICAL_CONFIG } from '../../constants/verticals'
import { timeAgo } from '../../lib/utils'

interface Props {
  devices: Device[]
}

const STATUS_COLOR: Record<string, string> = {
  online:   '#3fb950',
  warning:  '#d29922',
  critical: '#f85149',
  offline:  '#6e7681',
}

function FitBounds({ devices }: { devices: Device[] }) {
  const map = useMap()
  useEffect(() => {
    if (devices.length === 0) return
    const lats = devices.map((d) => d.location.lat)
    const lngs = devices.map((d) => d.location.lng)
    map.fitBounds(
      [[Math.min(...lats) - 0.05, Math.min(...lngs) - 0.05],
       [Math.max(...lats) + 0.05, Math.max(...lngs) + 0.05]],
      { maxZoom: 14 },
    )
  }, [devices, map])
  return null
}

export function DeviceMap({ devices }: Props) {
  const navigate = useNavigate()

  return (
    <MapContainer
      center={[-14.0, -72.0]}
      zoom={6}
      style={{ height: '100%', width: '100%', background: '#0d1117' }}
      zoomControl={true}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://carto.com/">CARTO</a>'
      />
      <FitBounds devices={devices} />
      {devices.map((device) => {
        const color = STATUS_COLOR[device.status]
        const vcfg = VERTICAL_CONFIG[device.vertical]
        return (
          <CircleMarker
            key={device.id}
            center={[device.location.lat, device.location.lng]}
            radius={device.status === 'critical' ? 10 : 8}
            pathOptions={{
              fillColor: color,
              fillOpacity: 0.9,
              color: color,
              weight: device.status === 'critical' ? 3 : 2,
              opacity: 1,
            }}
          >
            <Popup className="ruwi-popup">
              <div className="p-1 min-w-[180px]">
                <div className="flex items-center gap-1 mb-1">
                  <span className="text-sm">{vcfg.icon}</span>
                  <span className="font-semibold text-sm">{device.name}</span>
                </div>
                <p className="text-xs text-gray-400 mb-2">{device.locationName}</p>
                {device.cropType && (
                  <p className="text-xs text-gray-400 mb-2">{device.cropType}</p>
                )}
                <p className="text-xs text-gray-400 mb-3">{timeAgo(device.lastSeen)}</p>
                <button
                  onClick={() => navigate(`/devices/${device.id}`)}
                  className="w-full text-xs bg-blue-600 hover:bg-blue-700 text-white py-1.5 px-3 rounded transition-colors"
                >
                  Ver detalle →
                </button>
              </div>
            </Popup>
          </CircleMarker>
        )
      })}
    </MapContainer>
  )
}
