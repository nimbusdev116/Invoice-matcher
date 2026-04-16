import type { Order } from '../../types'
import { hoursAgo, formatEur } from '../../lib/utils'

interface Props {
  orders: Order[]
}

export default function SummaryBar({ orders }: Props) {
  const pending = orders.filter((o) => o.status === 'pending').length
  const processing = orders.filter((o) => o.status === 'processing').length
  const shipment = orders.filter((o) => o.status === 'awaiting_shipment').length
  const urgent = orders.filter((o) => hoursAgo(o.created_at) >= 24).length
  const totalValue = orders.reduce((sum, o) => sum + Number(o.value), 0)

  return (
    <div className="flex items-center gap-4 px-5 py-2.5 bg-s1 border-b border-border shrink-0">
      <SumItem color="bg-amber" value={pending} label="pending" />
      <SumItem color="bg-blue" value={processing} label="processing" />
      <SumItem color="bg-orange" value={shipment} label="awaiting shipment" />
      <div className="flex-1" />
      <div className="flex items-center gap-1.5 text-xs">
        <div className="w-2 h-2 rounded-full bg-red" />
        <span className={`font-bold ${urgent > 0 ? 'text-red' : 'text-muted'}`}>{urgent}</span>
        <span className="text-muted">urgent (&gt;24h)</span>
      </div>
      <div className="flex items-center gap-1.5 text-xs ml-2">
        <span className="text-muted">Total value:</span>
        <span className="font-bold text-green">{formatEur(totalValue)}</span>
      </div>
    </div>
  )
}

function SumItem({ color, value, label }: { color: string; value: number; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <div className={`w-2 h-2 rounded-full ${color}`} />
      <span className="font-bold">{value}</span>
      <span className="text-muted">{label}</span>
    </div>
  )
}
