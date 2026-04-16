import type { Order } from '../../types'
import { SOURCE_LABELS, SOURCE_COLORS, STATUS_LABELS } from '../../types'
import { formatEur, hoursAgo, ageLabel, formatDateTime } from '../../lib/utils'
import Badge from '../ui/Badge'
import Button from '../ui/Button'

const STATUS_BADGE_MAP: Record<string, 'pending' | 'processing' | 'awaiting'> = {
  pending: 'pending',
  processing: 'processing',
  awaiting_shipment: 'awaiting',
}

interface Props {
  order: Order
  onAdvance: (id: string) => void
  onProcess: (id: string) => void
  onClick: (id: string) => void
}

export default function OrderCard({ order, onAdvance, onProcess, onClick }: Props) {
  const hrs = hoursAgo(order.created_at)
  const isUrgent = hrs >= 24
  const srcColor = SOURCE_COLORS[order.source] || '#7d8590'
  const srcLabel = SOURCE_LABELS[order.source] || order.source
  const badgeVariant = STATUS_BADGE_MAP[order.status] || ('pending' as const)

  return (
    <div
      onClick={() => onClick(order.id)}
      className="relative bg-s2 border border-border rounded-lg p-3 mb-2 cursor-pointer transition-all hover:border-border2 hover:bg-s3 hover:-translate-y-px"
    >
      {isUrgent && (
        <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-lg bg-red" />
      )}

      <div className="flex items-start justify-between mb-2 gap-1.5">
        <div className="font-semibold text-[13px] text-text leading-tight flex-1">
          {order.customer_name}
        </div>
        <Badge variant={badgeVariant}>{STATUS_LABELS[order.status]}</Badge>
      </div>

      <div className="flex items-center gap-1.5 mb-1 text-[11px] text-muted">
        <span className="min-w-[40px]">SO:</span>
        <span className="text-text font-medium">{order.so_number || '—'}</span>
      </div>

      {order.reference_number && (
        <div className="flex items-center gap-1.5 mb-1 text-[11px] text-muted">
          <span className="min-w-[40px]">Ref:</span>
          <span className="text-blue font-medium">{order.reference_number}</span>
        </div>
      )}

      <div className="flex items-center gap-1.5 mb-1 text-[11px] text-muted">
        <svg className="w-3 h-3 shrink-0" viewBox="0 0 16 16" fill="currentColor">
          <path d="M4.75 0a.75.75 0 01.75.75V2h5V.75a.75.75 0 011.5 0V2h1.25c.966 0 1.75.784 1.75 1.75v10.5A1.75 1.75 0 0113.25 16H2.75A1.75 1.75 0 011 14.25V3.75C1 2.784 1.784 2 2.75 2H4V.75A.75.75 0 014.75 0zM2.5 7.5v6.75c0 .138.112.25.25.25h10.5a.25.25 0 00.25-.25V7.5z" />
        </svg>
        <span>{formatDateTime(order.created_at)}</span>
      </div>

      <div className="flex items-center gap-1.5 mt-1 text-[11px]">
        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: srcColor }} />
        <span style={{ color: srcColor }}>{srcLabel}</span>
        <span className="ml-auto font-bold text-xs">{formatEur(Number(order.value))}</span>
      </div>

      <div className="flex items-center justify-between mt-2">
        <span className={`text-[10px] ${isUrgent ? 'text-red' : 'text-muted'}`}>
          {isUrgent ? '! ' : ''}{ageLabel(order.created_at)}
        </span>
      </div>

      <div
        className="flex gap-1.5 mt-2.5"
        onClick={(e) => e.stopPropagation()}
      >
        <Button size="sm" className="flex-1 justify-center" onClick={() => onAdvance(order.id)}>
          Advance
        </Button>
        {order.status === 'pending' && (
          <Button size="sm" onClick={() => onProcess(order.id)}>
            Process
          </Button>
        )}
      </div>
    </div>
  )
}
