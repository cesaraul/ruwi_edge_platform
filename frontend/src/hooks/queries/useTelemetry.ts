import { useQuery } from '@tanstack/react-query'
import { getTelemetry } from '../../lib/api'
import type { TimeRange } from '../../types/telemetry'

export const useTelemetry = (deviceId: string, variable: string, range: TimeRange) =>
  useQuery({
    queryKey: ['telemetry', deviceId, variable, range],
    queryFn: () => getTelemetry(deviceId, variable, range),
    enabled: !!deviceId && !!variable,
    staleTime: 60_000,
  })
