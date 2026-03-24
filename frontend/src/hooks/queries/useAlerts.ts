import { useQuery } from '@tanstack/react-query'
import { getAlerts } from '../../lib/api'

export const useAlerts = (acknowledged?: boolean) =>
  useQuery({
    queryKey: ['alerts', acknowledged],
    queryFn: () => getAlerts(acknowledged),
    refetchInterval: 30_000,
  })
