import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, differenceInDays, addDays, parseISO, isAfter, isBefore, isToday } from 'date-fns'
import { es } from 'date-fns/locale'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date | null, formatStr = 'dd/MM/yyyy') {
  if (!date) return '—'
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, formatStr, { locale: es })
}

export function formatDateTime(date: string | Date | null) {
  return formatDate(date, 'dd/MM/yyyy HH:mm')
}

export function diasRestantes(fechaVencimiento: string | null): number {
  if (!fechaVencimiento) return 0
  const hoy = new Date()
  const vence = parseISO(fechaVencimiento)
  return differenceInDays(vence, hoy)
}

export function diasConsumidos(fechaInicio: string | null): number {
  if (!fechaInicio) return 0
  const hoy = new Date()
  const inicio = parseISO(fechaInicio)
  return Math.max(0, differenceInDays(hoy, inicio))
}

export function calcularNuevaFechaVencimiento(
  diasRestantes: number,
  diasPausados: number = 0
): Date {
  return addDays(new Date(), diasRestantes + diasPausados)
}

export function getEstadoBadgeColor(estado: string): string {
  const colors: Record<string, string> = {
    // Clientes
    activo: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    vencido: 'bg-red-500/20 text-red-400 border-red-500/30',
    suspendido: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    pendiente: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    // Cuentas
    disponible: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    parcial: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    llena: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    reportada: 'bg-red-500/20 text-red-400 border-red-500/30',
    // Ventas
    activa: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    en_garantia: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    repuesta: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    renovada: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    cancelada: 'bg-dark-600 text-dark-400 border-dark-500',
    // Reportes
    pendiente: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    solucionado: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    // Perfiles
    libre: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    ocupado: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    bloqueado: 'bg-red-500/20 text-red-400 border-red-500/30',
  }
  return colors[estado] || 'bg-dark-600 text-dark-400 border-dark-500'
}

export function getAlertaVencimiento(dias: number): string {
  if (dias < 0) return 'vencido'
  if (dias === 0) return 'hoy'
  if (dias <= 1) return 'mañana'
  if (dias <= 3) return 'urgente'
  if (dias <= 7) return 'pronto'
  return 'ok'
}

export function getAlertaColor(tipo: string): string {
  const colors: Record<string, string> = {
    vencido: 'text-red-400',
    hoy: 'text-red-400',
    mañana: 'text-orange-400',
    urgente: 'text-yellow-400',
    pronto: 'text-blue-400',
    ok: 'text-emerald-400',
  }
  return colors[tipo] || 'text-dark-400'
}

export function formatCurrency(amount: number | null, currency = 'MXN'): string {
  if (amount === null || amount === undefined) return '$0.00'
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

export function getPlatformIcon(nombre: string): string {
  const icons: Record<string, string> = {
    Netflix: '🎬',
    'Disney+': '✨',
    'HBO Max': '🎭',
    'Amazon Prime Video': '📦',
    Spotify: '🎵',
    'YouTube Premium': '▶️',
    'Paramount+': '⭐',
    Crunchyroll: '⚔️',
    'Apple TV+': '🍎',
    IPTV: '📡',
  }
  return icons[nombre] || '📺'
}

export function truncate(str: string, length = 30): string {
  return str.length > length ? str.substring(0, length) + '...' : str
}
