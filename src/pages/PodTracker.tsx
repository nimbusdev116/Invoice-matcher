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

function formatDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' })
}

const COURIER_METHODS: FulfillmentMethod[] = ['an_post', 'independent_express']

export default function PodTracker() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set())
  const { showToast } = useToast()

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .in('fulfillment_method', COURIER_METHODS)
      .order('updated_at', { ascending: false })

    if (error) console.error('Failed to fetch courier orders', error)
    setOrders((data as Order[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

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

  return (
    <div className="flex flex-col h-full">
      <header className="h-14 shrink-0 bg-s1 border-b border-border flex items-center px-6">
        <h1 className="text-sm font-semibold text-text">POD Tracker</h1>
      </header>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full text-muted">
            <div className="flex items-center gap-2.5">
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
                <path d="M14 8a6 6 0 00-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <span className="text-sm">Loading POD tracker...</span>
            </div>
          </div>
        ) : (
          <div className="p-6">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <StatCard label="Awaiting POD" value={awaitingPodCount} accent="amber" />
              <StatCard label="POD Received" value={podReceivedCount} accent="green" />
              <StatCard label="Total Courier" value={totalCourierCount} accent="blue" />
            </div>

            {/* Awaiting POD */}
            <section className="mb-8">
              <h2 className="text-sm font-semibold text-text mb-3">Awaiting POD</h2>

              {awaitingPod.length === 0 ? (
                <div className="bg-s1 border border-border rounded-xl px-5 py-10 text-center text-muted">
                  <svg className="w-8 h-8 mx-auto mb-2 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-sm">All PODs confirmed</div>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {awaitingPod.map((order, i) => (
                    <div
                      key={order.id}
                      className="bg-s1 border border-border rounded-xl p-4 flex items-center gap-4 hover:border-border2 transition-all"
                      style={{ animation: `fadeIn ${0.1 + i * 0.03}s ease-out` }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                          <span className="text-sm font-semibold text-text truncate">
                            {order.customer_name}
                          </span>
                          <span className="text-[11px] text-muted/60">
                            {order.so_number ?? 'No SO#'}
                          </span>
                          {order.fulfillment_method && (
                            <span className="text-[11px] text-muted">
                              <span className="mr-1">{FULFILLMENT_ICONS[order.fulfillment_method]}</span>
                              {FULFILLMENT_LABELS[order.fulfillment_method]}
                            </span>
                          )}
                          <span className="text-[11px] text-muted/60">
                            {order.shipped_at
                              ? `Shipped ${formatDate(order.shipped_at)}`
                              : 'Not shipped'}
                          </span>
                          <span className="text-[11px] text-text font-medium tabular-nums">
                            {formatEur(order.value)}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="green"
                        size="sm"
                        disabled={updatingIds.has(order.id)}
                        onClick={() => handleMarkPodReceived(order.id)}
                        className={cn(updatingIds.has(order.id) && 'opacity-50')}
                      >
                        {updatingIds.has(order.id) ? 'Saving...' : 'Mark POD Received'}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Recently Confirmed */}
            <section>
              <h2 className="text-sm font-semibold text-text mb-3">Recently Confirmed</h2>

              {podReceived.length === 0 ? (
                <div className="bg-s1 border border-border rounded-xl px-5 py-10 text-center text-muted">
                  <svg className="w-8 h-8 mx-auto mb-2 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
                  </svg>
                  <div className="text-sm">No confirmed PODs yet</div>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {podReceived.map((order, i) => (
                    <div
                      key={order.id}
                      className="bg-s1 border border-border rounded-xl px-4 py-2.5 flex items-center gap-4"
                      style={{ animation: `fadeIn ${0.1 + i * 0.03}s ease-out` }}
                    >
                      <div className="flex-1 flex flex-wrap items-center gap-x-4 gap-y-1 min-w-0">
                        <span className="text-[13px] font-medium text-text truncate">
                          {order.customer_name}
                        </span>
                        <span className="text-[11px] text-muted/60">
                          {order.so_number ?? 'No SO#'}
                        </span>
                        {order.fulfillment_method && (
                          <span className="text-[11px] text-muted">
                            {FULFILLMENT_LABELS[order.fulfillment_method]}
                          </span>
                        )}
                        <span className="text-[11px] text-text tabular-nums">
                          {formatEur(order.value)}
                        </span>
                      </div>
                      <span className="bg-green/12 text-green text-[10px] font-semibold py-0.5 px-2 rounded-md whitespace-nowrap shrink-0">
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

function StatCard({
  label,
  value,
  accent,
}: {
  label: string
  value: number
  accent: 'amber' | 'green' | 'blue'
}) {
  const styles = {
    amber: 'bg-amber/8 border-amber/15 text-amber',
    green: 'bg-green/8 border-green/15 text-green',
    blue: 'bg-blue/8 border-blue/15 text-blue',
  }

  return (
    <div className={`rounded-xl border p-4 ${styles[accent]}`}>
      <div className="text-[10px] font-semibold uppercase tracking-wider opacity-70 mb-2">{label}</div>
      <div className="text-2xl font-bold text-text">{value}</div>
    </div>
  )
}
