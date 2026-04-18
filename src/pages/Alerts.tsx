import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
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

type SortField = 'so_number' | 'customer_name' | 'channel' | 'status' | 'created_at' | 'value' | 'age'
type SortDir = 'asc' | 'desc'

const COLUMNS: { key: SortField; label: string; align?: 'right' }[] = [
  { key: 'so_number', label: 'SO Number' },
  { key: 'customer_name', label: 'Customer' },
  { key: 'channel', label: 'Channel' },
  { key: 'status', label: 'Status' },
  { key: 'created_at', label: 'Order Date' },
  { key: 'value', label: 'Value', align: 'right' },
  { key: 'age', label: 'Age' },
]

export default function Alerts() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const navigate = useNavigate()

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

  const staleOrders = useMemo(() => {
    const stale = orders.filter(
      (o) => now - new Date(o.created_at).getTime() > threeDaysMs
    )

    return stale.sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case 'so_number':
          cmp = (a.so_number || '').localeCompare(b.so_number || '')
          break
        case 'customer_name':
          cmp = a.customer_name.localeCompare(b.customer_name)
          break
        case 'channel':
          cmp = a.channel.localeCompare(b.channel)
          break
        case 'status':
          cmp = a.status.localeCompare(b.status)
          break
        case 'created_at':
        case 'age':
          cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          break
        case 'value':
          cmp = Number(a.value) - Number(b.value)
          break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [orders, sortField, sortDir, now, threeDaysMs])

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  function handleRowClick(order: Order) {
    navigate('/orders', { state: { highlightOrderId: order.id } })
  }

  return (
    <div className="flex flex-col h-full">
      <header className="h-14 shrink-0 bg-s1 border-b border-border flex items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold text-text">Alerts</h1>
          {staleOrders.length > 0 && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-red/15 text-red">
              {staleOrders.length}
            </span>
          )}
        </div>
        <span className="hidden md:inline text-[11px] text-muted/60">
          Orders stuck for 3+ days — click a row to view
        </span>
      </header>

      <div className="flex-1 overflow-auto">
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
          <>
            <table className="hidden md:table w-full border-collapse min-w-[800px]">
              <thead className="sticky top-0 z-10">
                <tr className="bg-s1 border-b border-border">
                  {COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      onClick={() => handleSort(col.key)}
                      className={`text-muted text-[11px] uppercase tracking-wider font-semibold py-3 px-4 cursor-pointer hover:text-text transition-colors select-none ${
                        col.align === 'right' ? 'text-right' : 'text-left'
                      }`}
                    >
                      <span className="inline-flex items-center gap-1">
                        {col.label}
                        {sortField === col.key && (
                          <svg className="w-3 h-3" viewBox="0 0 12 12" fill="currentColor">
                            {sortDir === 'asc' ? (
                              <path d="M6 2l4 5H2z" />
                            ) : (
                              <path d="M6 10l4-5H2z" />
                            )}
                          </svg>
                        )}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {staleOrders.map((order, i) => {
                  const days = Math.floor((now - new Date(order.created_at).getTime()) / (24 * 60 * 60 * 1000))
                  return (
                    <tr
                      key={order.id}
                      onClick={() => handleRowClick(order)}
                      className={`border-b border-border/50 hover:bg-red/[0.03] transition-colors cursor-pointer ${i % 2 === 1 ? 'bg-s1/30' : ''}`}
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

            <div className="md:hidden p-4 flex flex-col gap-2">
              {staleOrders.map((order, i) => {
                const days = Math.floor((now - new Date(order.created_at).getTime()) / (24 * 60 * 60 * 1000))
                return (
                  <div
                    key={order.id}
                    onClick={() => handleRowClick(order)}
                    className="bg-s1 border border-border rounded-xl p-3.5 cursor-pointer hover:border-border2 transition-all"
                    style={{ animation: `fadeIn ${0.1 + i * 0.03}s ease-out` }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-text truncate mr-2">{order.customer_name}</span>
                      <Badge variant={STATUS_TO_BADGE[order.status]}>
                        {STATUS_LABELS[order.status]}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mb-2 text-[11px] text-muted/60">
                      <span className="text-text/80">{order.so_number ?? '--'}</span>
                      <span className="text-border">|</span>
                      <span className="inline-flex items-center gap-1">
                        <span className={`w-1.5 h-1.5 rounded-full ${CHANNEL_DOT[order.channel] || 'bg-muted'}`} />
                        {CHANNEL_CONFIG[order.channel]?.label || order.channel}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className={`font-medium ${days >= 7 ? 'text-red' : 'text-amber'}`}>
                        {ageLabel(order.created_at)}
                      </span>
                      <span className="text-text font-semibold tabular-nums">{formatEur(order.value)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
