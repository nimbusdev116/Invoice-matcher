import type { OrderChannel, OrderSource } from '../types'

export function formatEur(value: number): string {
  return '\u20AC' + Number(value).toLocaleString('en-IE', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

export function hoursAgo(iso: string): number {
  return Math.round((Date.now() - new Date(iso).getTime()) / 3600000)
}

export function ageLabel(iso: string): string {
  const h = hoursAgo(iso)
  if (h < 1) return 'Just now'
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  const rem = h % 24
  return `${d}d ${rem}h ago`
}

export function classifySource(referenceNumber: string | null | undefined): {
  source: OrderSource
  channel: OrderChannel
} {
  if (!referenceNumber || referenceNumber.trim() === '') {
    return { source: 'manual', channel: 'offline' }
  }
  const ref = referenceNumber.toUpperCase()
  if (ref.startsWith('BWG')) return { source: 'bwg_portal', channel: 'bwg' }
  if (ref.startsWith('X')) return { source: 'musgrave_portal', channel: 'musgrave' }
  if (ref.startsWith('INV')) return { source: 'mirakl', channel: 'musgrave' }
  return { source: 'b2b_portal', channel: 'direct' }
}

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ')
}

export function generateSONumber(existingCount: number): string {
  return `SO-${String(existingCount + 1).padStart(5, '0')}`
}
