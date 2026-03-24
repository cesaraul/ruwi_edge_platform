import { useQuery, useMutation } from '@tanstack/react-query'
import { getDevices, getDevice, getDeviceVariables, acknowledgeAlert, createDevice, deleteDevice } from '../../lib/api'
import { queryClient } from '../../lib/queryClient'

export const useDevices = (vertical?: string) =>
  useQuery({
    queryKey: ['devices', vertical],
    queryFn: () => getDevices(vertical),
  })

export const useDevice = (id: string) =>
  useQuery({
    queryKey: ['device', id],
    queryFn: () => getDevice(id),
    enabled: !!id,
  })

export const useDeviceVariables = (id: string) =>
  useQuery({
    queryKey: ['device-variables', id],
    queryFn: () => getDeviceVariables(id),
    enabled: !!id,
    refetchInterval: 30_000,
  })

export const useCreateDevice = () =>
  useMutation({
    mutationFn: createDevice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] })
    },
  })

export const useDeleteDevice = () =>
  useMutation({
    mutationFn: deleteDevice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] })
    },
  })

export const useAcknowledgeAlert = () =>
  useMutation({
    mutationFn: acknowledgeAlert,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] })
    },
  })
