import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { formatEur, ageLabel, cn } from '../lib/utils'
import {
  type Order,
  type OrderStatus,
  type OrderChannel,
  type FulfillmentMethod,
  STATUS_LABELS,
  FULFILLMENT_LABELS,
  CHANNEL_CONFIG,
} from '../types'
import Badge from '../components/ui/Badge'
import OrderDetailModal from '../components/board/OrderDetailModal'

const PAGE_SIZE = 20

type SortKey = 'so_number' | 'customer_name' | 'value' | 'created_at'
type SortDir = 'asc' | 'desc'

const STATUS_TO_BADGE: Record<OrderStatus, 'pending' | 'processing' | 'awaiting' | 'shipped' | 'delivered' | 'cancelled'> = {
  pending: 'pending',
  processing: 'processing',
  awaiting_shipment: 'awaiting',
  shipped: 'shipped',
  delivered: 'delivered',
  cancelled: 'cancelled',
}

const CHANNEL_DOT_COLOR: Record<OrderChannel, string> = {
  direct: 'bg-blue',
  bwg: 'bg-purple',
  musgrave: 'bg-amber',
  manual: 'bg-red',
}

const STATUS_OPTIONS: { value: '' | OrderStatus; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'awaiting_shipment', label: 'Awaiting Shipment' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
]

const CHANNEL_OPTIONS: { value: '' | OrderChannel; label: string }[] = [
  { value: '', label: 'All channels' },
  { value: 'direct', label: 'Direct' },
  { value: 'bwg', label: 'BWG' },
  { value: 'musgrave', label: 'Musgrave' },
  { value: 'manual', label: 'Manual' },
]

function SortArrow({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <span className="ml-1 opacity-0 group-hover:opacity-30 text-[10px]">&#x25B2;</span>
  return (
    <span className="ml-1 text-[10px] text-blue">
      {dir === 'asc' ? '\u25B2' : '\u25BC'}
    </span>
  )
}

export default function AllOrders() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'' | OrderStatus>('')
  const [channelFilter, setChannelFilter] = useState<'' | OrderChannel>('')
  const [detailOrder, setDetailOrder] = useState<Order | null>(null)
  const [showDetail, setShowDetail] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [page, setPage] = useState(1)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })

      if (!cancelled) {
        if (error) console.error('Failed to fetch orders', error)
        setOrders((data as Order[]) ?? [])
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const filtered = useMemo(() => {
    let list = orders
    if (statusFilter) list = list.filter((o) => o.status === statusFilter)
    if (channelFilter) list = list.filter((o) => o.channel === channelFilter)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(
        (o) =>
          o.customer_name.toLowerCase().includes(q) ||
          (o.so_number && o.so_number.toLowerCase().includes(q)),
      )
    }
    return list
  }, [orders, search, statusFilter, channelFilter])

  const sorted = useMemo(() => {
    const arr = [...filtered]
    arr.sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'so_number':
          cmp = (a.so_number ?? '').localeCompare(b.so_number ?? '')
          break
        case 'customer_name':
          cmp = a.customer_name.localeCompare(b.customer_name)
          break
        case 'value':
          cmp = a.value - b.value
          break
        case 'created_at':
          cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return arr
  }, [filtered, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)

  const paged = useMemo(
    () => sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [sorted, safePage],
  )

  useEffect(() => { setPage(1) }, [search, statusFilter, channelFilter])

  function handleRowClick(order: Order) {
    setDetailOrder(order)
    setShowDetail(true)
  }

  async function handleSaveOrder(
    id: string,
    updates: { status: OrderStatus; fulfillment_method: FulfillmentMethod | null; notes: string | null },
  ) {
    await supabase.from('orders').update(updates).eq('id', id)
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, ...updates } : o)))
    setShowDetail(false)
  }

  async function handleCancelOrder(id: string) {
    await supabase.from('orders').update({ status: 'cancelled' as OrderStatus }).eq('id', id)
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status: 'cancelled' as OrderStatus } : o)))
    setShowDetail(false)
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'value' ? 'desc' : 'asc')
    }
  }

  function TH({ label, sortable, className = '' }: { label: string; sortable?: SortKey; className?: string }) {
    const base = 'text-muted text-[11px] uppercase tracking-wider font-semibold py-3 px-4 text-left whitespace-nowrap'
    if (!sortable) return <th className={cn(base, className)}>{label}</th>
    return (
      <th
        className={cn(base, 'cursor-pointer select-none group hover:text-text transition-colors', className)}
        onClick={() => handleSort(sortable)}
      >
        <span className="inline-flex items-center">
          {label}
          <SortArrow active={sortKey === sortable} dir={sortDir} />
        </span>
      </th>
    )
  }

  const activeFilters = [statusFilter, channelFilter, search].filter(Boolean).length

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="h-14 bg-s1 border-b border-border flex items-center justify-between px-4 md:px-6 shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold text-text">All orders</h1>
          <span className="text-[11px] text-muted bg-s2 px-2 py-0.5 rounded-md">
            {orders.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {activeFilters > 0 && (
            <button
              onClick={() => { setSearch(''); setStatusFilter(''); setChannelFilter('') }}
              className="text-[11px] text-red hover:text-red/80 font-medium cursor-pointer transition-colors"
            >
              Clear filters ({activeFilters})
            </button>
          )}
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-s1/50 border-b border-border px-4 md:px-6 py-3 flex flex-wrap items-center gap-3 shrink-0">
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
          </svg>
          <input
            type="text"
            placeholder="Search orders..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-s2 border border-border rounded-lg text-[13px] text-text placeholder:text-muted/50 py-2 pl-9 pr-3 w-full md:w-64 outline-none focus:border-blue/50 focus:ring-1 focus:ring-blue/20 transition-all"
          />
        </div>

        <div className="h-5 w-px bg-border" />

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as '' | OrderStatus)}
          className={cn(
            'bg-s2 border rounded-lg text-[13px] py-2 px-3 outline-none transition-all cursor-pointer',
            statusFilter ? 'border-blue/40 text-blue' : 'border-border text-text'
          )}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <select
          value={channelFilter}
          onChange={(e) => setChannelFilter(e.target.value as '' | OrderChannel)}
          className={cn(
            'bg-s2 border rounded-lg text-[13px] py-2 px-3 outline-none transition-all cursor-pointer',
            channelFilter ? 'border-blue/40 text-blue' : 'border-border text-text'
          )}
        >
          {CHANNEL_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <span className="text-muted text-[11px] ml-auto tabular-nums">
          {sorted.length} of {orders.length} orders
        </span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full text-muted text-sm">
            <div className="flex items-center gap-2.5">
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
                <path d="M14 8a6 6 0 00-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              Loading orders...
            </div>
          </div>
        ) : paged.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted">
            <div className="text-center">
              <svg className="w-10 h-10 mx-auto mb-3 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <div className="text-sm font-medium">No orders found</div>
              <div className="text-xs mt-1 text-muted/60">Try adjusting your search or filters</div>
            </div>
          </div>
        ) : (
          <>
            <table className="hidden md:table w-full border-collapse min-w-[900px]">
              <thead className="sticky top-0 z-10">
                <tr className="bg-s1 border-b border-border">
                  <TH label="SO Number" sortable="so_number" />
                  <TH label="Customer" sortable="customer_name" />
                  <TH label="Channel" />
                  <TH label="Status" />
                  <TH label="Value" sortable="value" className="text-right" />
                  <TH label="Fulfillment" />
                  <TH label="Age" sortable="created_at" />
                  <TH label="Rep" />
                </tr>
              </thead>
              <tbody>
                {paged.map((order, i) => (
                  <tr
                    key={order.id}
                    onClick={() => handleRowClick(order)}
                    className={cn(
                      'border-b border-border/50 hover:bg-blue/[0.04] transition-colors cursor-pointer',
                      i % 2 === 1 && 'bg-s1/30',
                    )}
                    style={{ animation: `fadeIn ${0.1 + i * 0.02}s ease-out` }}
                  >
                    <td className="text-[13px] py-3 px-4 font-medium whitespace-nowrap">
                      {order.so_number ?? <span className="text-muted/50 italic">--</span>}
                    </td>
                    <td className="text-[13px] py-3 px-4 max-w-[200px] truncate">
                      {order.customer_name}
                    </td>
                    <td className="text-[13px] py-3 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5">
                        <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', CHANNEL_DOT_COLOR[order.channel])} />
                        <span className="text-muted">{CHANNEL_CONFIG[order.channel].label}</span>
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={STATUS_TO_BADGE[order.status]}>
                        {STATUS_LABELS[order.status]}
                      </Badge>
                    </td>
                    <td className="text-[13px] py-3 px-4 text-right tabular-nums whitespace-nowrap font-medium">
                      {formatEur(order.value)}
                    </td>
                    <td className="text-[13px] py-3 px-4 whitespace-nowrap text-muted">
                      {order.fulfillment_method
                        ? FULFILLMENT_LABELS[order.fulfillment_method]
                        : <span className="text-muted/40">--</span>}
                    </td>
                    <td className="text-[13px] py-3 px-4 whitespace-nowrap text-muted">
                      {ageLabel(order.created_at)}
                    </td>
                    <td className="text-[13px] py-3 px-4 whitespace-nowrap text-muted truncate max-w-[100px]">
                      {order.rep_id ?? <span className="text-muted/40">--</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="md:hidden p-4 flex flex-col gap-2">
              {paged.map((order, i) => (
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
                      <span className={cn('w-1.5 h-1.5 rounded-full', CHANNEL_DOT_COLOR[order.channel])} />
                      {CHANNEL_CONFIG[order.channel].label}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted">{ageLabel(order.created_at)}</span>
                    <span className="text-text font-semibold tabular-nums">{formatEur(order.value)}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Pagination */}
      {!loading && sorted.length > 0 && (
        <div className="bg-s1 border-t border-border px-4 md:px-6 py-2.5 flex items-center justify-between shrink-0">
          <button
            disabled={safePage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className={cn(
              'text-[11px] font-medium px-3 py-1.5 rounded-lg border border-border transition-all cursor-pointer',
              safePage <= 1 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-s2 text-text'
            )}
          >
            Previous
          </button>
          <span className="md:hidden text-[11px] text-muted tabular-nums">
            {safePage} / {totalPages}
          </span>
          <div className="hidden md:flex items-center gap-1">
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              const pageNum = i + 1
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={cn(
                    'w-7 h-7 rounded-lg text-[11px] font-medium transition-all cursor-pointer',
                    safePage === pageNum
                      ? 'bg-blue/15 text-blue border border-blue/25'
                      : 'text-muted hover:text-text hover:bg-s2'
                  )}
                >
                  {pageNum}
                </button>
              )
            })}
            {totalPages > 7 && (
              <span className="text-muted text-[11px] px-1">...</span>
            )}
          </div>
          <button
            disabled={safePage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className={cn(
              'text-[11px] font-medium px-3 py-1.5 rounded-lg border border-border transition-all cursor-pointer',
              safePage >= totalPages ? 'opacity-30 cursor-not-allowed' : 'hover:bg-s2 text-text'
            )}
          >
            Next
          </button>
        </div>
      )}

      <OrderDetailModal
        order={detailOrder}
        open={showDetail}
        onClose={() => setShowDetail(false)}
        onSave={handleSaveOrder}
        onCancel={handleCancelOrder}
      />
    </div>
  )
}
