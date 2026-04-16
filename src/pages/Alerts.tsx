import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Order, OrderStatus } from '../types'
import { STATUS_LABELS, CHANNEL_CONFIG } from '../types'
import { ageLabel, formatEur, formatDateTime } from '../lib/utils'
import Badge from '../components/ui/Badge'

const STATUS_TO_BADGE: Record<OrderStatus, 'pending' | 'processing' | 'awaiting' | 'shipped' | 'delivered' | 'cancelled'> = {
  pending: 'pending',
  processing: 'processing',
  awaiting_shipment: 'awaiting',
  shipped: 'shipped',
  delivered: 'delivered',
  cancelled: 'cancelled',
}

export default function Alerts() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .in('status', ['pending', 'processing', 'awaiting_shipment'])
        .order('created_at', { ascending: true })

      if (error) console.error('Failed to fetch alerts', error)
      setOrders((data as Order[]) ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const now = Date.now()
  const threeDaysMs = 3 * 24 * 60 * 60 * 1000
  const staleOrders = orders.filter(
    (o) => now - new Date(o.created_at).getTime() > threeDaysMs
  )

  return (
    <div className="flex flex-col h-full">
      <header className="h-[54px] shrink-0 bg-s1 border-b border-border flex items-center justify-between px-5">
        <h1 className="text-base font-semibold text-text">Alerts</h1>
        <span className="text-xs text-muted">
          {staleOrders.length} order{staleOrders.length !== 1 ? 's' : ''} stuck for 3+ days
        </span>
      </header>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full text-muted text-sm">Loading alerts...</div>
        ) : staleOrders.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted">
            <div className="text-center">
              <svg className="w-8 h-8 mx-auto mb-2 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              <div className="text-sm">No stale orders</div>
              <div className="text-xs mt-1 opacity-70">All orders are moving within 3 days</div>
            </div>
          </div>
        ) : (
          <table className="w-full border-collapse min-w-[800px]">
            <thead className="sticky top-0 z-10">
              <tr className="bg-s1 border-b border-border">
                <th className="text-muted text-[11px] uppercase tracking-wide font-semibold py-2.5 px-3 text-left">SO Number</th>
                <th className="text-muted text-[11px] uppercase tracking-wide font-semibold py-2.5 px-3 text-left">Customer</th>
                <th className="text-muted text-[11px] uppercase tracking-wide font-semibold py-2.5 px-3 text-left">Channel</th>
                <th className="text-muted text-[11px] uppercase tracking-wide font-semibold py-2.5 px-3 text-left">Status</th>
                <th className="text-muted text-[11px] uppercase tracking-wide font-semibold py-2.5 px-3 text-left">Order Date</th>
                <th className="text-muted text-[11px] uppercase tracking-wide font-semibold py-2.5 px-3 text-right">Value</th>
                <th className="text-muted text-[11px] uppercase tracking-wide font-semibold py-2.5 px-3 text-left">Age</th>
              </tr>
            </thead>
            <tbody>
              {staleOrders.map((order, i) => {
                const days = Math.floor((now - new Date(order.created_at).getTime()) / (24 * 60 * 60 * 1000))
                return (
                  <tr
                    key={order.id}
                    className={`border-b border-border hover:bg-s2 transition-colors ${i % 2 === 1 ? 'bg-s1/40' : ''}`}
                  >
                    <td className="text-[13px] py-2.5 px-3 font-medium whitespace-nowrap">
                      {order.so_number ?? <span className="text-muted italic">--</span>}
                    </td>
                    <td className="text-[13px] py-2.5 px-3 max-w-[200px] truncate">
                      {order.customer_name}
                    </td>
                    <td className="text-[13px] py-2.5 px-3 whitespace-nowrap">
                      {CHANNEL_CONFIG[order.channel]?.label || order.channel}
                    </td>
                    <td className="py-2.5 px-3">
                      <Badge variant={STATUS_TO_BADGE[order.status]}>
                        {STATUS_LABELS[order.status]}
                      </Badge>
                    </td>
                    <td className="text-[13px] py-2.5 px-3 whitespace-nowrap text-muted">
                      {formatDateTime(order.created_at)}
                    </td>
                    <td className="text-[13px] py-2.5 px-3 text-right tabular-nums whitespace-nowrap">
                      {formatEur(order.value)}
                    </td>
                    <td className="text-[13px] py-2.5 px-3 whitespace-nowrap">
                      <span className={days >= 7 ? 'text-red font-semibold' : days >= 3 ? 'text-amber' : 'text-muted'}>
                        {ageLabel(order.created_at)}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
