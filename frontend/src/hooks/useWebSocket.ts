import { useEffect, useRef } from 'react'
import { useWsStore } from '../stores/wsStore'
import { queryClient } from '../lib/queryClient'

export function useWebSocket(orgId: string) {
  const { setConnected, updateReading, addAlert } = useWsStore()
  const retries = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (!orgId) return  // No conectar hasta tener orgId real

    const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000'
    const token = localStorage.getItem('token')
    let ws: WebSocket

    function connect() {
      try {
        const url = token
          ? `${WS_URL}/ws/${orgId}?token=${token}`
          : `${WS_URL}/ws/${orgId}`

        ws = new WebSocket(url)

        ws.onopen = () => {
          setConnected(true)
          retries.current = 0
        }

        ws.onclose = () => {
          setConnected(false)
          const delay = Math.min(1000 * Math.pow(2, retries.current++), 30000)
          timerRef.current = setTimeout(connect, delay)
        }

        ws.onerror = () => {
          setConnected(false)
        }

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data)

            if (msg.type === 'reading') {
              // Backend envía: {type, device_id, variables, timestamp}
              // Expandir en un SensorReading por variable
              const { device_id, variables, timestamp } = msg
              if (device_id && variables) {
                Object.entries(variables as Record<string, number>).forEach(([variable, value]) => {
                  updateReading({
                    deviceId: String(device_id),
                    variable,
                    value,
                    unit: '',
                    timestamp: timestamp ?? new Date().toISOString(),
                    quality: 1,
                  })
                })
              }
            } else if (msg.type === 'alert') {
              addAlert(msg.data)
              queryClient.invalidateQueries({ queryKey: ['alerts'] })
            } else if (msg.type === 'device_status') {
              queryClient.invalidateQueries({ queryKey: ['devices'] })
            }
          } catch {
            // ignore malformed messages
          }
        }
      } catch {
        // WebSocket no disponible — ignorar silenciosamente
      }
    }

    connect()

    return () => {
      clearTimeout(timerRef.current)
      ws?.close()
    }
  }, [orgId, setConnected, updateReading, addAlert])
}
