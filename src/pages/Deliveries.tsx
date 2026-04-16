import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { formatEur, cn } from '../lib/utils'
import {
  type Order,
  type OrderStatus,
  type FulfillmentMethod,
  STATUS_LABELS,
  FULFILLMENT_LABELS,
  FULFILLMENT_ICONS,
} from '../types'
import Badge from '../components/ui/Badge'

/* ─── constants ─── */

type DeliveryFilter = 'all' | 'awaiting_shipment' | 'shipped' | 'delivered'

const FILTER_PILLS: { value: DeliveryFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'awaiting_shipment', label: 'Awaiting Shipment' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
]

const FULFILLMENT_OPTIONS: { value: '' | FulfillmentMethod; label: string }[] = [
  { value: '', label: 'All Methods' },
  { value: 'collection', label: 'Collection' },
  { value: 'own_van', label: 'Own Van' },
  { value: 'an_post', label: 'An Post' },
  { value: 'independent_express', label: 'Ind. Express' },
]

const STATUS_TO_BADGE: Record<OrderStatus, 'pending' | 'processing' | 'awaiting' | 'shipped' | 'delivered' | 'cancelled'> = {
  pending: 'pending',
  processing: 'processing',
  awaiting_shipment: 'awaiting',
  shipped: 'shipped',
  delivered: 'delivered',
  cancelled: 'cancelled',
}

function formatDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' })
}

/* ─── main component ─── */

export default function Deliveries() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<DeliveryFilter>('all')
  const [fulfillmentFilter, setFulfillmentFilter] = useState<'' | FulfillmentMethod>('')

  /* ── fetch ── */
  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)

      // Delivered: only last 7 days
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      const sevenDaysAgoISO = sevenDaysAgo.toISOString()

      const [shipmentRes, shippedRes, deliveredRes] = await Promise.all([
        supabase
          .from('orders')
          .select('*')
          .eq('status', 'awaiting_shipment')
          .order('updated_at', { ascending: false }),
        supabase
          .from('orders')
          .select('*')
          .eq('status', 'shipped')
          .order('updated_at', { ascending: false }),
        supabase
          .from('orders')
          .select('*')
          .eq('status', 'delivered')
          .gte('updated_at', sevenDaysAgoISO)
          .order('updated_at', { ascending: false }),
      ])

      if (!cancelled) {
        const all = [
          ...((shipmentRes.data as Order[]) ?? []),
          ...((shippedRes.data as Order[]) ?? []),
          ...((deliveredRes.data as Order[]) ?? []),
        ]
        setOrders(all)
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  /* ── derived ── */
  const today = new Date().toISOString().slice(0, 10)

  const awaitingShipmentCount = orders.filter((o) => o.status === 'awaiting_shipment').length
  const shippedCount = orders.filter((o) => o.status === 'shipped').length
  const deliveredTodayCount = orders.filter(
    (o) => o.status === 'delivered' && o.delivered_at && o.delivered_at.slice(0, 10) === today
  ).length
  const awaitingPodCount = orders.filter(
    (o) => o.pod_required && !o.pod_received && o.status === 'shipped'
  ).length

  const filtered = useMemo(() => {
    let list = orders

    if (statusFilter !== 'all') {
      list = list.filter((o) => o.status === statusFilter)
    }

    if (fulfillmentFilter) {
      list = list.filter((o) => o.fulfillment_method === fulfillmentFilter)
    }

    return list
  }, [orders, statusFilter, fulfillmentFilter])

  /* ── render ── */
  return (
    <div className="flex flex-col h-full">
      {/* Topbar */}
      <header className="h-[54px] shrink-0 bg-s1 border-b border-border flex items-center px-5">
        <h1 className="text-[15px] font-semibold text-text">Deliveries</h1>
      </header>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full text-muted">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
                <path d="M14 8a6 6 0 00-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <span className="text-sm">Loading deliveries...</span>
            </div>
          </div>
        ) : (
          <div className="p-5">
            {/* Summary stats row */}
            <div className="grid grid-cols-4 gap-4 mb-5">
              <StatCard label="Awaiting Shipment" value={awaitingShipmentCount} dotColor="bg-orange" />
              <StatCard label="Shipped / In Transit" value={shippedCount} dotColor="bg-purple" />
              <StatCard label="Delivered Today" value={deliveredTodayCount} dotColor="bg-green" />
              <StatCard label="Awaiting POD" value={awaitingPodCount} dotColor="bg-amber" />
            </div>

            {/* Filter bar */}
            <div className="flex flex-wrap items-center gap-3 mb-5">
              {/* Status pills */}
              <div className="flex items-center gap-1.5">
                {FILTER_PILLS.map((pill) => (
                  <button
                    key={pill.value}
                    onClick={() => setStatusFilter(pill.value)}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-xs font-medium border transition cursor-pointer',
                      statusFilter === pill.value
                        ? 'bg-blue-d text-blue border-blue/30'
                        : 'bg-s1 text-muted border-border hover:text-text'
                    )}
                  >
                    {pill.label}
                  </button>
                ))}
              </div>

              {/* Fulfillment method dropdown */}
              <select
                value={fulfillmentFilter}
                onChange={(e) => setFulfillmentFilter(e.target.value as '' | FulfillmentMethod)}
                className="bg-s1 border border-border rounded-md text-[13px] text-text py-1.5 px-2.5 outline-none focus:border-blue transition cursor-pointer"
              >
                {FULFILLMENT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>

              {/* Results count */}
              <span className="text-muted text-[12px] ml-auto whitespace-nowrap">
                {filtered.length} {filtered.length === 1 ? 'order' : 'orders'}
              </span>
            </div>

            {/* Delivery cards list */}
            {filtered.length === 0 ? (
              <div className="flex items-center justify-center py-20 text-muted">
                <div className="text-center">
                  <div className="mb-2 opacity-40 flex justify-center"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 002 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></svg></div>
                  <div className="text-sm">No deliveries match your filters</div>
                  <div className="text-xs mt-1 opacity-70">Try adjusting your filters</div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col">
                {filtered.map((order) => (
                  <DeliveryCard key={order.id} order={order} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── stat card ─── */

function StatCard({
  label,
  value,
  dotColor,
}: {
  label: string
  value: number
  dotColor: string
}) {
  return (
    <div className="bg-s1 border border-border rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-2 h-2 rounded-full ${dotColor}`} />
        <span className="text-muted text-xs uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-2xl font-bold text-text">{value}</div>
    </div>
  )
}

/* ─── delivery card ─── */

function DeliveryCard({ order }: { order: Order }) {
  return (
    <div className="bg-s1 border border-border rounded-lg p-4 mb-3">
      {/* Row 1: Customer name + status badge */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-text truncate mr-3">
          {order.customer_name}
        </span>
        <Badge variant={STATUS_TO_BADGE[order.status]}>
          {STATUS_LABELS[order.status]}
        </Badge>
      </div>

      {/* Row 2: SO + Zoho ref */}
      <div className="flex items-center gap-3 mb-2 text-xs text-muted">
        <span>{order.so_number ?? 'No SO#'}</span>
        {order.reference_number && (
          <>
            <span className="text-border2">|</span>
            <span>Ref: {order.reference_number}</span>
          </>
        )}
      </div>

      {/* Row 3: Fulfillment, value, shipped date */}
      <div className="flex flex-wrap items-center gap-4 text-xs">
        {/* Fulfillment method */}
        {order.fulfillment_method ? (
          <span className="text-muted">
            <span className="mr-1">{FULFILLMENT_ICONS[order.fulfillment_method]}</span>
            {FULFILLMENT_LABELS[order.fulfillment_method]}
          </span>
        ) : (
          <span className="text-muted italic">No method</span>
        )}

        {/* Value */}
        <span className="text-text font-medium tabular-nums">{formatEur(order.value)}</span>

        {/* Shipped date */}
        {order.shipped_at ? (
          <span className="text-muted">
            Shipped {formatDate(order.shipped_at)}
          </span>
        ) : (
          <span className="text-muted italic">Not yet shipped</span>
        )}

        {/* POD badge */}
        {order.pod_required && !order.pod_received && (
          <span className="bg-amber-d text-amber text-[10px] font-semibold py-0.5 px-2 rounded-full">
            Awaiting POD
          </span>
        )}

        {/* Delivered badge */}
        {order.status === 'delivered' && (
          <span className="bg-green-d text-green text-[10px] font-semibold py-0.5 px-2 rounded-full">
            Delivered {formatDate(order.delivered_at)}
          </span>
        )}
      </div>
    </div>
  )
}
