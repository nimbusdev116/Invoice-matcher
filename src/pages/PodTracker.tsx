import { useEffect, useState, useMemo, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { formatEur, cn } from '../lib/utils'
import {
  type Order,
  type FulfillmentMethod,
  FULFILLMENT_LABELS,
  FULFILLMENT_ICONS,
} from '../types'
import Button from '../components/ui/Button'
import { useToast } from '../contexts/ToastContext'

/* ─── helpers ─── */

function formatDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' })
}

const COURIER_METHODS: FulfillmentMethod[] = ['an_post', 'independent_express']

/* ─── main component ─── */

export default function PodTracker() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set())
  const { showToast } = useToast()

  /* ── fetch ── */
  const fetchOrders = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .in('fulfillment_method', COURIER_METHODS)
      .order('updated_at', { ascending: false })

    if (error) {
      console.error('Failed to fetch courier orders', error)
    }
    setOrders((data as Order[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  /* ── mark POD received ── */
  async function handleMarkPodReceived(orderId: string) {
    setUpdatingIds((prev) => new Set(prev).add(orderId))

    const { error } = await supabase
      .from('orders')
      .update({ pod_received: true })
      .eq('id', orderId)

    if (error) {
      showToast('Failed to mark POD received', 'error')
    } else {
      showToast('POD marked as received', 'success')
      // Update local state
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, pod_received: true } : o))
      )
    }

    setUpdatingIds((prev) => {
      const next = new Set(prev)
      next.delete(orderId)
      return next
    })
  }

  /* ── derived data ── */
  const awaitingPod = useMemo(
    () => orders.filter((o) => o.pod_required && !o.pod_received),
    [orders]
  )

  const podReceived = useMemo(
    () => orders.filter((o) => o.pod_required && o.pod_received).slice(0, 20),
    [orders]
  )

  const awaitingPodCount = awaitingPod.length
  const podReceivedCount = orders.filter((o) => o.pod_required && o.pod_received).length
  const totalCourierCount = orders.length

  /* ── render ── */
  return (
    <div className="flex flex-col h-full">
      {/* Topbar */}
      <header className="h-[54px] shrink-0 bg-s1 border-b border-border flex items-center px-5">
        <h1 className="text-[15px] font-semibold text-text">POD Tracker</h1>
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
              <span className="text-sm">Loading POD tracker...</span>
            </div>
          </div>
        ) : (
          <div className="p-5">
            {/* Summary row */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <StatCard label="Awaiting POD" value={awaitingPodCount} dotColor="bg-amber" />
              <StatCard label="POD Received" value={podReceivedCount} dotColor="bg-green" />
              <StatCard label="Total Courier Orders" value={totalCourierCount} dotColor="bg-blue" />
            </div>

            {/* Section A: Awaiting POD */}
            <section className="mb-8">
              <h2 className="text-sm font-semibold text-text mb-3">Awaiting POD</h2>

              {awaitingPod.length === 0 ? (
                <div className="bg-s1 border border-border rounded-lg px-5 py-10 text-center text-muted">
                  <div className="mb-2 opacity-40 flex justify-center"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg></div>
                  <div className="text-sm">All PODs have been confirmed</div>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {awaitingPod.map((order) => (
                    <div
                      key={order.id}
                      className="bg-s1 border border-border rounded-lg p-4 flex items-center gap-4"
                    >
                      {/* Info columns */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                          {/* Customer */}
                          <span className="text-sm font-semibold text-text truncate">
                            {order.customer_name}
                          </span>

                          {/* SO Number */}
                          <span className="text-xs text-muted">
                            {order.so_number ?? 'No SO#'}
                          </span>

                          {/* Method */}
                          {order.fulfillment_method && (
                            <span className="text-xs text-muted">
                              <span className="mr-1">{FULFILLMENT_ICONS[order.fulfillment_method]}</span>
                              {FULFILLMENT_LABELS[order.fulfillment_method]}
                            </span>
                          )}

                          {/* Tracking */}
                          <span className="text-xs text-muted">
                            {order.reference_number
                              ? `#${order.reference_number}`
                              : 'No tracking'}
                          </span>

                          {/* Shipped date */}
                          <span className="text-xs text-muted">
                            {order.shipped_at
                              ? `Shipped ${formatDate(order.shipped_at)}`
                              : 'Not shipped'}
                          </span>

                          {/* Value */}
                          <span className="text-xs text-text font-medium tabular-nums">
                            {formatEur(order.value)}
                          </span>
                        </div>
                      </div>

                      {/* Action */}
                      <Button
                        variant="green"
                        size="sm"
                        disabled={updatingIds.has(order.id)}
                        onClick={() => handleMarkPodReceived(order.id)}
                        className={cn(updatingIds.has(order.id) && 'opacity-60 cursor-not-allowed')}
                      >
                        {updatingIds.has(order.id) ? 'Saving...' : 'Mark POD Received'}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Section B: Recently Confirmed */}
            <section>
              <h2 className="text-sm font-semibold text-text mb-3">Recently Confirmed</h2>

              {podReceived.length === 0 ? (
                <div className="bg-s1 border border-border rounded-lg px-5 py-10 text-center text-muted">
                  <div className="mb-2 opacity-40 flex justify-center"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 002 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></svg></div>
                  <div className="text-sm">No confirmed PODs yet</div>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {podReceived.map((order) => (
                    <div
                      key={order.id}
                      className="bg-s1 border border-border rounded-lg px-4 py-2.5 flex items-center gap-4"
                    >
                      <div className="flex-1 flex flex-wrap items-center gap-x-4 gap-y-1 min-w-0">
                        {/* Customer */}
                        <span className="text-[13px] font-medium text-text truncate">
                          {order.customer_name}
                        </span>

                        {/* SO Number */}
                        <span className="text-xs text-muted">
                          {order.so_number ?? 'No SO#'}
                        </span>

                        {/* Method */}
                        {order.fulfillment_method && (
                          <span className="text-xs text-muted">
                            {FULFILLMENT_LABELS[order.fulfillment_method]}
                          </span>
                        )}

                        {/* Value */}
                        <span className="text-xs text-text tabular-nums">
                          {formatEur(order.value)}
                        </span>
                      </div>

                      {/* POD Confirmed badge */}
                      <span className="bg-green-d text-green text-[10px] font-semibold py-0.5 px-2 rounded-full whitespace-nowrap shrink-0">
                        POD Confirmed
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
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
