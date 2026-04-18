import type { Order } from '../../types'
import { hoursAgo, formatEur } from '../../lib/utils'

interface Props {
  orders: Order[]
}

export default function SummaryBar({ orders }: Props) {
  const pending = orders.filter((o) => o.status === 'pending').length
  const processing = orders.filter((o) => o.status === 'processing').length
  const shipment = orders.filter((o) => o.status === 'awaiting_shipment').length
  const urgent = orders.filter((o) => hoursAgo(o.created_at) >= 72).length
  const totalValue = orders.reduce((sum, o) => sum + Number(o.value), 0)

  return (
    <div className="flex items-center gap-5 px-4 md:px-6 py-2.5 bg-s1 border-b border-border shrink-0 overflow-x-auto scrollbar-hide">
      <SumItem color="bg-amber" value={pending} label="pending" />
      <SumItem color="bg-blue" value={processing} label="processing" />
      <SumItem color="bg-orange" value={shipment} label="awaiting" />
      <div className="hidden md:block flex-1" />
      <div className="flex items-center gap-1.5 text-xs">
        <div className={`w-1.5 h-1.5 rounded-full ${urgent > 0 ? 'bg-red' : 'bg-muted/30'}`} />
        <span className={`font-bold ${urgent > 0 ? 'text-red' : 'text-muted/50'}`}>{urgent}</span>
        <span className="text-muted/60 text-[11px]">urgent (&gt;3 days)</span>
      </div>
      <div className="h-4 w-px bg-border" />
      <div className="flex items-center gap-1.5 text-xs">
        <span className="text-muted/60 text-[11px]">Value:</span>
        <span className="font-bold text-green">{formatEur(totalValue)}</span>
      </div>
    </div>
  )
}

function SumItem({ color, value, label }: { color: string; value: number; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs shrink-0">
      <div className={`w-1.5 h-1.5 rounded-full ${color}`} />
      <span className="font-bold text-text">{value}</span>
      <span className="text-muted/60">{label}</span>
    </div>
  )
}
