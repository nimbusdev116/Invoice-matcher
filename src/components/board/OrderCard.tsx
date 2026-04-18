import { useState } from 'react'
import type { Order } from '../../types'
import { SOURCE_LABELS, SOURCE_COLORS, STATUS_LABELS } from '../../types'
import { formatEur, hoursAgo, ageLabel } from '../../lib/utils'
import Badge from '../ui/Badge'
import Button from '../ui/Button'

const STATUS_BADGE_MAP: Record<string, 'pending' | 'processing' | 'awaiting'> = {
  pending: 'pending',
  processing: 'processing',
  awaiting_shipment: 'awaiting',
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

      <div className="flex items-start justify-between mb-2 gap-1.5">
        <div className="font-semibold text-[13px] text-text leading-tight flex-1 truncate">
          {order.customer_name}
        </div>
        <Badge variant={badgeVariant}>{STATUS_LABELS[order.status]}</Badge>
      </div>

      <div className="flex items-center gap-2 mb-1 text-xs">
        <span className="text-muted/50">SO</span>
        <span className="text-text font-semibold">{order.so_number || '--'}</span>
        {order.zoho_invoice_number && (
          <>
            <span className="text-border">|</span>
            <span className="text-muted/50">INV</span>
            <span className="text-blue font-semibold">{order.zoho_invoice_number}</span>
          </>
        )}
      </div>

      {order.reference_number && (
        <div className="flex items-center gap-1.5 text-[11px] text-muted mb-2">
          <span className="text-muted/50">Ref</span>
          <span className="text-blue font-medium">{order.reference_number}</span>
        </div>
      )}

      <div className="flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: srcColor }} />
          <span className="text-muted">{srcLabel}</span>
        </div>
        <span className="font-bold text-xs text-text">{formatEur(Number(order.value))}</span>
      </div>

      <div className="mt-1.5 text-[10px]">
        <span className={isUrgent ? 'text-red font-medium' : 'text-muted/60'}>
          {ageLabel(ageDate)}
          {order.status === 'awaiting_shipment' && ' (invoice)'}
        </span>
      </div>

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
