import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { formatDistanceToNow, format } from 'date-fns'
import { es } from 'date-fns/locale'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function timeAgo(dateStr: string): string {
  return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: es })
}

export function formatTime(dateStr: string): string {
  return format(new Date(dateStr), 'HH:mm:ss')
}

export function formatDate(dateStr: string): string {
  return format(new Date(dateStr), 'dd/MM/yyyy HH:mm')
}

export function formatValue(value: number, unit: string): string {
  return `${value.toFixed(1)} ${unit}`
}
