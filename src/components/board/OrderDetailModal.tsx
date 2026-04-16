import { useState, useEffect } from 'react'
import type { Order, OrderStatus, FulfillmentMethod } from '../../types'
import { STATUS_LABELS, FULFILLMENT_LABELS, FULFILLMENT_ICONS } from '../../types'
import { formatEur, ageLabel } from '../../lib/utils'
import Modal from '../ui/Modal'
import Button from '../ui/Button'

const ALL_STATUSES: { value: OrderStatus; color: string }[] = [
  { value: 'pending', color: 'bg-amber' },
  { value: 'processing', color: 'bg-blue' },
  { value: 'pending_shipment', color: 'bg-orange' },
  { value: 'shipped', color: 'bg-purple' },
  { value: 'delivered', color: 'bg-green' },
  { value: 'cancelled', color: 'bg-muted' },
]

const ALL_FULFILLMENTS: FulfillmentMethod[] = ['own_van', 'collection', 'an_post', 'independent_express']

interface Props {
  order: Order | null
  open: boolean
  onClose: () => void
  onSave: (id: string, updates: { status: OrderStatus; fulfillment_method: FulfillmentMethod | null; notes: string | null }) => void
  onCancel: (id: string) => void
}

export default function OrderDetailModal({ order, open, onClose, onSave, onCancel }: Props) {
  const [status, setStatus] = useState<OrderStatus>('pending')
  const [fulfillment, setFulfillment] = useState<FulfillmentMethod | null>(null)
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (order) {
      setStatus(order.status)
      setFulfillment(order.fulfillment_method)
      setNotes(order.notes || '')
    }
  }, [order])

  if (!order) return null

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Order ${order.so_number || order.id.slice(0, 8)}`}
      footer={
        <>
          <Button variant="danger" onClick={() => onCancel(order.id)}>
            Cancel order
          </Button>
          <div className="flex-1" />
          <Button onClick={onClose}>Close</Button>
          <Button
            variant="green"
            onClick={() => onSave(order.id, { status, fulfillment_method: fulfillment, notes: notes || null })}
          >
            Save & move
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-2.5 mb-4">
        <DetailCard label="Customer" value={order.customer_name} />
        <DetailCard label="Value" value={formatEur(Number(order.value))} />
        <DetailCard label="Channel" value={order.source.replace('_', ' ')} />
        <DetailCard label="Zoho ref" value={order.reference_number || '— not created'} valueColor={order.reference_number ? 'text-blue' : 'text-muted'} />
        <DetailCard label="Age" value={ageLabel(order.created_at)} />
        <DetailCard label="SO Number" value={order.so_number || '—'} />
      </div>

      <div className="mb-3.5">
        <label className="text-[11px] text-muted uppercase tracking-wider mb-1.5 block">Move to status</label>
        <div className="grid grid-cols-3 gap-2">
          {ALL_STATUSES.map((s) => (
            <button
              key={s.value}
              onClick={() => setStatus(s.value)}
              className={`py-2 px-2.5 rounded-lg border flex items-center gap-2 transition-all text-xs cursor-pointer ${
                status === s.value
                  ? 'border-green/50 bg-green-d text-green'
                  : 'border-border text-muted hover:bg-s3 hover:text-text'
              }`}
            >
              <div className={`w-[7px] h-[7px] rounded-full shrink-0 ${s.color}`} />
              {STATUS_LABELS[s.value]}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-3.5">
        <label className="text-[11px] text-muted uppercase tracking-wider mb-1.5 block">Fulfillment method</label>
        <div className="grid grid-cols-2 gap-2">
          {ALL_FULFILLMENTS.map((f) => (
            <button
              key={f}
              onClick={() => setFulfillment(f)}
              className={`py-2.5 px-2.5 rounded-lg border text-center transition-all cursor-pointer ${
                fulfillment === f
                  ? 'border-blue/50 bg-blue-d'
                  : 'border-border hover:bg-s3'
              }`}
            >
              <div className="text-lg mb-0.5">{FULFILLMENT_ICONS[f]}</div>
              <div className="text-[11px] font-semibold text-text">{FULFILLMENT_LABELS[f]}</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-[11px] text-muted uppercase tracking-wider mb-1.5 block">Notes</label>
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add note or instruction..."
          className="w-full bg-s2 border border-border rounded-md py-2 px-3 text-text text-[13px] outline-none focus:border-green/50 transition"
        />
      </div>
    </Modal>
  )
}

function DetailCard({ label, value, valueColor = 'text-text' }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="bg-s2 border border-border rounded-lg p-2.5">
      <div className="text-[10px] uppercase tracking-wider text-muted mb-1">{label}</div>
      <div className={`text-[13px] font-semibold ${valueColor}`}>{value}</div>
    </div>
  )
}
