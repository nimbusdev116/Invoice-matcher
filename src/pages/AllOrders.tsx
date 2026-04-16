import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { formatEur, ageLabel, cn } from '../lib/utils'
import {
  type Order,
  type OrderStatus,
  type OrderChannel,
  STATUS_LABELS,
  FULFILLMENT_LABELS,
  CHANNEL_CONFIG,
} from '../types'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'

/* ─── constants ─── */
const PAGE_SIZE = 20

type SortKey = 'so_number' | 'customer_name' | 'value' | 'created_at'
type SortDir = 'asc' | 'desc'

const STATUS_TO_BADGE: Record<OrderStatus, 'pending' | 'processing' | 'shipment' | 'shipped' | 'delivered' | 'cancelled'> = {
  pending: 'pending',
  processing: 'processing',
  pending_shipment: 'shipment',
  shipped: 'shipped',
  delivered: 'delivered',
  cancelled: 'cancelled',
}

const CHANNEL_DOT_COLOR: Record<OrderChannel, string> = {
  direct: 'bg-blue',
  bwg: 'bg-purple',
  musgrave: 'bg-amber',
  offline: 'bg-red',
}

const STATUS_OPTIONS: { value: '' | OrderStatus; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'pending_shipment', label: 'Pending Shipment' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
]

const CHANNEL_OPTIONS: { value: '' | OrderChannel; label: string }[] = [
  { value: '', label: 'All channels' },
  { value: 'direct', label: 'Direct' },
  { value: 'bwg', label: 'BWG' },
  { value: 'musgrave', label: 'Musgrave' },
  { value: 'offline', label: 'Offline' },
]

/* ─── sort arrow icon ─── */
function SortArrow({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <span className="ml-1 opacity-0 group-hover:opacity-40 text-[10px]">&#x25B2;</span>
  return (
    <span className="ml-1 text-[10px]">
      {dir === 'asc' ? '\u25B2' : '\u25BC'}
    </span>
  )
}

/* ─── main component ─── */
export default function AllOrders() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  /* filters */
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'' | OrderStatus>('')
  const [channelFilter, setChannelFilter] = useState<'' | OrderChannel>('')

  /* sort */
  const [sortKey, setSortKey] = useState<SortKey>('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  /* pagination */
  const [page, setPage] = useState(1)

  /* ── fetch ── */
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

  /* ── derived data ── */
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

  /* reset page when filters change */
  useEffect(() => { setPage(1) }, [search, statusFilter, channelFilter])

  /* ── sort handler ── */
  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'value' ? 'desc' : 'asc')
    }
  }

  /* ── column header helper ── */
  function TH({ label, sortable, colKey, className = '' }: { label: string; sortable?: SortKey; colKey?: never; className?: string } | { label: string; sortable: SortKey; colKey?: never; className?: string }) {
    const base = 'text-muted text-[11px] uppercase tracking-wide font-semibold py-2.5 px-3 text-left whitespace-nowrap'
    if (!sortable) return <th className={cn(base, className)}>{label}</th>
    return (
      <th
        className={cn(base, 'cursor-pointer select-none group', className)}
        onClick={() => handleSort(sortable)}
      >
        <span className="inline-flex items-center">
          {label}
          <SortArrow active={sortKey === sortable} dir={sortDir} />
        </span>
      </th>
    )
  }

  /* ── render ── */
  return (
    <div className="flex flex-col h-full">
      {/* topbar */}
      <div className="h-[54px] bg-s1 border-b border-border flex items-center justify-between px-5 shrink-0">
        <h1 className="text-[15px] font-semibold">All orders</h1>
        <Button variant="default" size="sm" onClick={() => {}}>
          Export
        </Button>
      </div>

      {/* search + filter bar */}
      <div className="bg-bg border-b border-border px-5 py-3 flex flex-wrap items-center gap-3 shrink-0">
        {/* search */}
        <div className="relative">
          <svg
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
          </svg>
          <input
            type="text"
            placeholder="Search by customer or SO..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-s1 border border-border rounded-md text-[13px] text-text placeholder:text-muted py-1.5 pl-8 pr-3 w-64 outline-none focus:border-blue transition"
          />
        </div>

        {/* status filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as '' | OrderStatus)}
          className="bg-s1 border border-border rounded-md text-[13px] text-text py-1.5 px-2.5 outline-none focus:border-blue transition cursor-pointer"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {/* channel filter */}
        <select
          value={channelFilter}
          onChange={(e) => setChannelFilter(e.target.value as '' | OrderChannel)}
          className="bg-s1 border border-border rounded-md text-[13px] text-text py-1.5 px-2.5 outline-none focus:border-blue transition cursor-pointer"
        >
          {CHANNEL_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {/* results count */}
        <span className="text-muted text-[12px] ml-auto whitespace-nowrap">
          Showing {sorted.length} of {orders.length} orders
        </span>
      </div>

      {/* table area */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full text-muted text-sm">
            Loading orders...
          </div>
        ) : paged.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted">
            <div className="text-center">
              <div className="text-3xl mb-2 opacity-40">&#x1F50D;</div>
              <div className="text-sm">No orders match your filters</div>
              <div className="text-xs mt-1 opacity-70">Try adjusting your search or filters</div>
            </div>
          </div>
        ) : (
          <table className="w-full border-collapse min-w-[900px]">
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
                  className={cn(
                    'border-b border-border hover:bg-s2 transition-colors',
                    i % 2 === 1 && 'bg-s1/40',
                  )}
                >
                  {/* SO Number */}
                  <td className="text-[13px] py-2.5 px-3 font-medium whitespace-nowrap">
                    {order.so_number ?? <span className="text-muted italic">--</span>}
                  </td>

                  {/* Customer */}
                  <td className="text-[13px] py-2.5 px-3 max-w-[200px] truncate">
                    {order.customer_name}
                  </td>

                  {/* Channel */}
                  <td className="text-[13px] py-2.5 px-3 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5">
                      <span className={cn('w-2 h-2 rounded-full shrink-0', CHANNEL_DOT_COLOR[order.channel])} />
                      {CHANNEL_CONFIG[order.channel].label}
                    </span>
                  </td>

                  {/* Status */}
                  <td className="py-2.5 px-3">
                    <Badge variant={STATUS_TO_BADGE[order.status]}>
                      {STATUS_LABELS[order.status]}
                    </Badge>
                  </td>

                  {/* Value */}
                  <td className="text-[13px] py-2.5 px-3 text-right tabular-nums whitespace-nowrap">
                    {formatEur(order.value)}
                  </td>

                  {/* Fulfillment */}
                  <td className="text-[13px] py-2.5 px-3 whitespace-nowrap text-muted">
                    {order.fulfillment_method
                      ? FULFILLMENT_LABELS[order.fulfillment_method]
                      : <span className="italic">--</span>}
                  </td>

                  {/* Age */}
                  <td className="text-[13px] py-2.5 px-3 whitespace-nowrap text-muted">
                    {ageLabel(order.created_at)}
                  </td>

                  {/* Rep */}
                  <td className="text-[13px] py-2.5 px-3 whitespace-nowrap text-muted truncate max-w-[100px]">
                    {order.rep_id ?? <span className="italic">--</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* pagination */}
      {!loading && sorted.length > 0 && (
        <div className="bg-s1 border-t border-border px-5 py-2.5 flex items-center justify-between shrink-0">
          <Button
            variant="default"
            size="sm"
            disabled={safePage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className={cn(safePage <= 1 && 'opacity-40 cursor-not-allowed')}
          >
            Previous
          </Button>
          <span className="text-[12px] text-muted">
            Page {safePage} of {totalPages}
          </span>
          <Button
            variant="default"
            size="sm"
            disabled={safePage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className={cn(safePage >= totalPages && 'opacity-40 cursor-not-allowed')}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  )
}
