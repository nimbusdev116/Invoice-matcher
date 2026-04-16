import { useState } from 'react'
import type { OrderSource, OrderChannel, FulfillmentMethod } from '../../types'
import { FULFILLMENT_LABELS, FULFILLMENT_ICONS } from '../../types'
import { classifySource } from '../../lib/utils'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import Input from '../ui/Input'

const SOURCE_OPTIONS: { value: OrderSource; label: string }[] = [
  { value: 'b2b_portal', label: 'B2B Portal' },
  { value: 'bwg_portal', label: 'BWG Portal' },
  { value: 'musgrave_portal', label: 'Musgrave Portal' },
  { value: 'mirakl', label: 'Mirakl' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'email', label: 'Email' },
  { value: 'manual', label: 'Manual' },
]

const ALL_FULFILLMENTS: FulfillmentMethod[] = ['own_van', 'collection', 'an_post', 'independent_express']

interface Props {
  open: boolean
  onClose: () => void
  onCreate: (order: {
    customer_name: string
    source: OrderSource
    channel: OrderChannel
    value: number
    fulfillment_method: FulfillmentMethod | null
    reference_number: string | null
    notes: string | null
  }) => void
}

const SOURCE_TO_CHANNEL: Record<OrderSource, OrderChannel> = {
  b2b_portal: 'direct',
  bwg_portal: 'bwg',
  musgrave_portal: 'musgrave',
  mirakl: 'musgrave',
  whatsapp: 'offline',
  email: 'offline',
  manual: 'offline',
}

export default function NewOrderModal({ open, onClose, onCreate }: Props) {
  const [customer, setCustomer] = useState('')
  const [value, setValue] = useState('')
  const [source, setSource] = useState<OrderSource>('manual')
  const [zohoRef, setZohoRef] = useState('')
  const [notes, setNotes] = useState('')
  const [fulfillment, setFulfillment] = useState<FulfillmentMethod>('own_van')

  const handleCreate = () => {
    if (!customer.trim()) return

    const classification = zohoRef.trim()
      ? classifySource(zohoRef.trim())
      : { source, channel: SOURCE_TO_CHANNEL[source] }

    onCreate({
      customer_name: customer.trim(),
      source: classification.source,
      channel: classification.channel,
      value: parseFloat(value) || 0,
      fulfillment_method: fulfillment,
      reference_number: zohoRef.trim() || null,
      notes: notes.trim() || null,
    })

    setCustomer('')
    setValue('')
    setSource('manual')
    setZohoRef('')
    setNotes('')
    setFulfillment('own_van')
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New order"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="green" onClick={handleCreate}>Create order</Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Input
            label="Customer name"
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
            placeholder="Search or type..."
          />
        </div>
        <div>
          <Input
            label="Value (€)"
            type="number"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="0.00"
          />
        </div>
      </div>

      <div className="mt-3.5">
        <label className="text-[11px] text-muted uppercase tracking-wider mb-1.5 block">Order channel</label>
        <select
          value={source}
          onChange={(e) => setSource(e.target.value as OrderSource)}
          className="w-full bg-s2 border border-border rounded-md py-2 px-3 text-text text-[13px] outline-none focus:border-green/50 transition"
        >
          {SOURCE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div className="mt-3.5">
        <Input
          label="Zoho sales order ref"
          value={zohoRef}
          onChange={(e) => setZohoRef(e.target.value)}
          placeholder="SO-00XXX"
        />
      </div>

      <div className="mt-3.5">
        <Input
          label="Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Order items, instructions..."
        />
      </div>

      <div className="mt-3.5">
        <label className="text-[11px] text-muted uppercase tracking-wider mb-1.5 block">Fulfillment</label>
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
    </Modal>
  )
}
