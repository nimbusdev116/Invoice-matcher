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

const CHANNEL_DOT: Record<string, string> = {
  direct: 'bg-blue',
  bwg: 'bg-purple',
  musgrave: 'bg-amber',
  manual: 'bg-red',
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
      <header className="h-14 shrink-0 bg-s1 border-b border-border flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold text-text">Alerts</h1>
          {staleOrders.length > 0 && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-red/15 text-red">
              {staleOrders.length}
            </span>
          )}
        </div>
        <span className="text-[11px] text-muted/60">
          Orders stuck for 3+ days
        </span>
      </header>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full text-muted">
            <div className="flex items-center gap-2.5">
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
                <path d="M14 8a6 6 0 00-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <span className="text-sm">Loading alerts...</span>
            </div>
          </div>
        ) : staleOrders.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted">
            <div className="text-center">
              <svg className="w-10 h-10 mx-auto mb-3 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-sm font-medium">No stale orders</div>
              <div className="text-xs mt-1 text-muted/60">All orders are moving within 3 days</div>
            </div>
          </div>
        ) : (
          <table className="w-full border-collapse min-w-[800px]">
            <thead className="sticky top-0 z-10">
              <tr className="bg-s1 border-b border-border">
                <th className="text-muted text-[11px] uppercase tracking-wider font-semibold py-3 px-4 text-left">SO Number</th>
                <th className="text-muted text-[11px] uppercase tracking-wider font-semibold py-3 px-4 text-left">Customer</th>
                <th className="text-muted text-[11px] uppercase tracking-wider font-semibold py-3 px-4 text-left">Channel</th>
                <th className="text-muted text-[11px] uppercase tracking-wider font-semibold py-3 px-4 text-left">Status</th>
                <th className="text-muted text-[11px] uppercase tracking-wider font-semibold py-3 px-4 text-left">Order Date</th>
                <th className="text-muted text-[11px] uppercase tracking-wider font-semibold py-3 px-4 text-right">Value</th>
                <th className="text-muted text-[11px] uppercase tracking-wider font-semibold py-3 px-4 text-left">Age</th>
              </tr>
            </thead>
            <tbody>
              {staleOrders.map((order, i) => {
                const days = Math.floor((now - new Date(order.created_at).getTime()) / (24 * 60 * 60 * 1000))
                return (
                  <tr
                    key={order.id}
                    className={`border-b border-border/50 hover:bg-red/[0.03] transition-colors ${i % 2 === 1 ? 'bg-s1/30' : ''}`}
                    style={{ animation: `fadeIn ${0.1 + i * 0.02}s ease-out` }}
                  >
                    <td className="text-[13px] py-3 px-4 font-medium whitespace-nowrap">
                      {order.so_number ?? <span className="text-muted/40">--</span>}
                    </td>
                    <td className="text-[13px] py-3 px-4 max-w-[200px] truncate">
                      {order.customer_name}
                    </td>
                    <td className="text-[13px] py-3 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${CHANNEL_DOT[order.channel] || 'bg-muted'}`} />
                        <span className="text-muted">{CHANNEL_CONFIG[order.channel]?.label || order.channel}</span>
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={STATUS_TO_BADGE[order.status]}>
                        {STATUS_LABELS[order.status]}
                      </Badge>
                    </td>
                    <td className="text-[13px] py-3 px-4 whitespace-nowrap text-muted">
                      {formatDateTime(order.created_at)}
                    </td>
                    <td className="text-[13px] py-3 px-4 text-right tabular-nums whitespace-nowrap font-medium">
                      {formatEur(order.value)}
                    </td>
                    <td className="text-[13px] py-3 px-4 whitespace-nowrap">
                      <span className={`font-medium ${days >= 7 ? 'text-red' : 'text-amber'}`}>
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
