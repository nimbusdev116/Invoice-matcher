import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { formatEur, cn } from '../lib/utils'
import {
  type Order,
  type OrderStatus,
  type FulfillmentMethod,
  STATUS_LABELS,
  FULFILLMENT_LABELS,
} from '../types'
import FulfillmentIcon from '../components/ui/FulfillmentIcon'
import Badge from '../components/ui/Badge'
import OrderDetailModal from '../components/board/OrderDetailModal'

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

export default function Deliveries() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<DeliveryFilter>('all')
  const [fulfillmentFilter, setFulfillmentFilter] = useState<'' | FulfillmentMethod>('')
  const [detailOrder, setDetailOrder] = useState<Order | null>(null)
  const [showDetail, setShowDetail] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
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

  const today = new Date().toISOString().slice(0, 10)
  const awaitingShipmentCount = orders.filter((o) => o.status === 'awaiting_shipment').length
  const shippedCount = orders.filter((o) => o.status === 'shipped').length
  const deliveredTodayCount = orders.filter(
    (o) => o.status === 'delivered' && o.delivered_at && o.delivered_at.slice(0, 10) === today
  ).length
  const awaitingPodCount = orders.filter(
    (o) => !o.pod_received && o.status === 'shipped'
  ).length

  const filtered = useMemo(() => {
    let list = orders
    if (statusFilter !== 'all') list = list.filter((o) => o.status === statusFilter)
    if (fulfillmentFilter) list = list.filter((o) => o.fulfillment_method === fulfillmentFilter)
    return list
  }, [orders, statusFilter, fulfillmentFilter])

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

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="h-14 shrink-0 bg-s1 border-b border-border flex items-center px-6">
        <h1 className="text-sm font-semibold text-text">Deliveries</h1>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full text-muted">
            <div className="flex items-center gap-2.5">
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
                <path d="M14 8a6 6 0 00-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <span className="text-sm">Loading deliveries...</span>
            </div>
          </div>
        ) : (
          <div className="p-6">
            {/* Stats */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              <StatCard label="Awaiting Shipment" value={awaitingShipmentCount} accent="orange" />
              <StatCard label="In Transit" value={shippedCount} accent="purple" />
              <StatCard label="Delivered Today" value={deliveredTodayCount} accent="green" />
              <StatCard label="Awaiting POD" value={awaitingPodCount} accent="amber" />
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3 mb-5">
              <div className="flex items-center gap-1.5">
                {FILTER_PILLS.map((pill) => (
                  <button
                    key={pill.value}
                    onClick={() => setStatusFilter(pill.value)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-all duration-150 cursor-pointer',
                      statusFilter === pill.value
                        ? 'bg-blue/12 text-blue border-blue/25'
                        : 'bg-transparent text-muted border-transparent hover:text-text hover:bg-white/[0.03]'
                    )}
                  >
                    {pill.label}
                  </button>
                ))}
              </div>

              <div className="h-5 w-px bg-border" />

              <select
                value={fulfillmentFilter}
                onChange={(e) => setFulfillmentFilter(e.target.value as '' | FulfillmentMethod)}
                className={cn(
                  'bg-s2 border rounded-lg text-[13px] py-1.5 px-3 outline-none transition-all cursor-pointer',
                  fulfillmentFilter ? 'border-blue/40 text-blue' : 'border-border text-text'
                )}
              >
                {FULFILLMENT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>

              <span className="text-muted/60 text-[11px] ml-auto tabular-nums">
                {filtered.length} {filtered.length === 1 ? 'order' : 'orders'}
              </span>
            </div>

            {/* Cards */}
            {filtered.length === 0 ? (
              <div className="flex items-center justify-center py-20 text-muted">
                <div className="text-center">
                  <svg className="w-10 h-10 mx-auto mb-3 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
                  </svg>
                  <div className="text-sm font-medium">No deliveries found</div>
                  <div className="text-xs mt-1 text-muted/60">Try adjusting your filters</div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {filtered.map((order, i) => (
                  <DeliveryCard
                    key={order.id}
                    order={order}
                    onClick={() => { setDetailOrder(order); setShowDetail(true) }}
                    index={i}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

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

function StatCard({
  label,
  value,
  accent,
}: {
  label: string
  value: number
  accent: 'orange' | 'purple' | 'green' | 'amber'
}) {
  const styles = {
    orange: 'bg-orange/8 border-orange/15 text-orange',
    purple: 'bg-purple/8 border-purple/15 text-purple',
    green: 'bg-green/8 border-green/15 text-green',
    amber: 'bg-amber/8 border-amber/15 text-amber',
  }

  return (
    <div className={`rounded-xl border p-4 ${styles[accent]}`}>
      <div className="text-[10px] font-semibold uppercase tracking-wider opacity-70 mb-2">{label}</div>
      <div className="text-2xl font-bold text-text">{value}</div>
    </div>
  )
}

function DeliveryCard({ order, onClick, index }: { order: Order; onClick?: () => void; index: number }) {
  return (
    <div
      onClick={onClick}
      className="bg-s1 border border-border rounded-xl p-4 cursor-pointer hover:border-border2 hover:bg-s1/80 transition-all duration-150"
      style={{ animation: `fadeIn ${0.1 + index * 0.03}s ease-out` }}
    >
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-sm font-semibold text-text truncate mr-3">
          {order.customer_name}
        </span>
        <Badge variant={STATUS_TO_BADGE[order.status]}>
          {STATUS_LABELS[order.status]}
        </Badge>
      </div>

      <div className="flex items-center gap-3 mb-2.5 text-[11px] text-muted/60">
        <span className="text-text/80">{order.so_number ?? 'No SO#'}</span>
        {order.reference_number && (
          <>
            <span className="text-border">|</span>
            <span>Ref: {order.reference_number}</span>
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-4 text-[11px]">
        {order.fulfillment_method ? (
          <span className="flex items-center gap-1 text-muted">
            <span className="inline-flex"><FulfillmentIcon method={order.fulfillment_method} /></span>
            {FULFILLMENT_LABELS[order.fulfillment_method]}
          </span>
        ) : (
          <span className="text-muted/40 italic">No method</span>
        )}

        <span className="text-text font-semibold tabular-nums">{formatEur(order.value)}</span>

        {order.shipped_at ? (
          <span className="text-muted/60">Shipped {formatDate(order.shipped_at)}</span>
        ) : (
          <span className="text-muted/40">Not yet shipped</span>
        )}

        {order.pod_required && !order.pod_received && (
          <span className="bg-amber/12 text-amber text-[10px] font-semibold py-0.5 px-2 rounded-md">
            Awaiting POD
          </span>
        )}

        {order.status === 'delivered' && (
          <span className="bg-green/12 text-green text-[10px] font-semibold py-0.5 px-2 rounded-md">
            Delivered {formatDate(order.delivered_at)}
          </span>
        )}
      </div>
    </div>
  )
}
