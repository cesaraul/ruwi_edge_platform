import { useQuery } from '@tanstack/react-query'
import { getKPIs } from '../../lib/api'

export const useKPIs = (vertical: 'agro' | 'energia') =>
  useQuery({
    queryKey: ['kpis', vertical],
    queryFn: () => getKPIs(vertical),
    staleTime: 60_000,
  })
