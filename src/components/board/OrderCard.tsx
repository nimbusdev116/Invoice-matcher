import { useState } from 'react'
import type { Order } from '../../types'
import { SOURCE_LABELS, SOURCE_COLORS, STATUS_LABELS, ZOHO_SO_STATUS_LABELS, ZOHO_INVOICE_STATUS_LABELS } from '../../types'
import { formatEur, hoursAgo, ageLabel } from '../../lib/utils'
import Badge from '../ui/Badge'
import Button from '../ui/Button'

const STATUS_BADGE_MAP: Record<string, 'pending' | 'processing' | 'awaiting'> = {
  pending: 'pending',
  processing: 'processing',
  awaiting_shipment: 'awaiting',
}

const ZOHO_POSITIVE = new Set(['confirmed', 'paid', 'fulfilled', 'closed', 'sent', 'viewed'])
const ZOHO_WARNING = new Set(['draft', 'overdue', 'awaiting_approval', 'partially_paid'])

function zohoStatusStyle(status: string): string {
  if (ZOHO_POSITIVE.has(status)) return 'bg-green/8 text-green/80'
  if (ZOHO_WARNING.has(status)) return 'bg-amber/8 text-amber/80'
  return 'bg-s3 text-muted/70'
}

interface Props {
  order: Order
  onDelete: (id: string) => void
  onClick: (id: string) => void
}

export default function OrderCard({ order, onDelete, onClick }: Props) {
  const [confirming, setConfirming] = useState(false)

  const ageDate = order.status === 'awaiting_shipment' ? order.updated_at : order.created_at
  const hrs = hoursAgo(ageDate)
  const isUrgent = hrs >= 72
  const srcColor = SOURCE_COLORS[order.source] || '#7d8590'
  const srcLabel = SOURCE_LABELS[order.source] || order.source
  const badgeVariant = STATUS_BADGE_MAP[order.status] || ('pending' as const)

  return (
    <div
      onClick={() => onClick(order.id)}
      className="relative bg-s2 border border-border rounded-xl p-3.5 mb-2 cursor-pointer transition-all duration-150 hover:border-border2 hover:bg-s3"
    >
      {isUrgent && (
        <div className="absolute left-0 top-2 bottom-2 w-[2.5px] rounded-full bg-red" />
      )}

      {/* Row 1: Customer + Value */}
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <div className="font-semibold text-[13px] text-text leading-tight flex-1 truncate">
          {order.customer_name}
        </div>
        <span className="font-bold text-xs text-green shrink-0 tabular-nums">
          {formatEur(Number(order.value))}
        </span>
      </div>

      {/* Row 2: SO + Invoice numbers */}
      <div className="flex items-center gap-3 mb-2.5">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted/40 uppercase">SO</span>
          <span className="text-xs font-semibold text-text">{order.so_number || '--'}</span>
        </div>
        {order.zoho_invoice_number && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted/40 uppercase">INV</span>
            <span className="text-xs font-semibold text-blue">{order.zoho_invoice_number}</span>
          </div>
        )}
      </div>

      {/* Row 3: Our status + Zoho status pills */}
      <div className="flex items-center gap-1.5 flex-wrap mb-2.5">
        <Badge variant={badgeVariant}>{STATUS_LABELS[order.status]}</Badge>
        {order.zoho_so_status && (
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${zohoStatusStyle(order.zoho_so_status)}`}>
            SO: {ZOHO_SO_STATUS_LABELS[order.zoho_so_status] || order.zoho_so_status}
          </span>
        )}
        {order.zoho_invoice_status && (
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${zohoStatusStyle(order.zoho_invoice_status)}`}>
            INV: {ZOHO_INVOICE_STATUS_LABELS[order.zoho_invoice_status] || order.zoho_invoice_status}
          </span>
        )}
      </div>

      {/* Row 4: Source + Age */}
      <div className="flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: srcColor }} />
          <span className="text-muted">{srcLabel}</span>
        </div>
        <span className={isUrgent ? 'text-red font-medium text-[10px]' : 'text-muted/50 text-[10px]'}>
          {ageLabel(ageDate)}
        </span>
      </div>

      {/* Delete button */}
      <div
        className="flex gap-1.5 mt-3 pt-2.5 border-t border-border/50"
        onClick={(e) => e.stopPropagation()}
      >
        {confirming ? (
          <>
            <Button size="sm" variant="danger" className="flex-1 justify-center" onClick={() => { onDelete(order.id); setConfirming(false) }}>
              Confirm delete
            </Button>
            <Button size="sm" className="flex-1 justify-center" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </>
        ) : (
          <Button size="sm" variant="danger" className="flex-1 justify-center" onClick={() => setConfirming(true)}>
            Delete
          </Button>
        )}
      </div>
    </div>
  )
}
