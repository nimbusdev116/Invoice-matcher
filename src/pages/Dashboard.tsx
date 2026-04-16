import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { zohoSync } from '../lib/api'
import type { Order, OrderChannel, OrderStatus } from '../types'
import { CHANNEL_CONFIG, STATUS_LABELS } from '../types'
import { formatEur, hoursAgo, ageLabel } from '../lib/utils'

interface StatusHistoryEntry {
  id: string
  order_id: string
  from_status: OrderStatus | null
  to_status: OrderStatus
  changed_by: string | null
  created_at: string
  orders: { customer_name: string } | null
  profiles: { full_name: string } | null
}

const STATUS_DOT_COLORS: Record<OrderStatus, string> = {
  pending: 'bg-amber',
  processing: 'bg-blue',
  awaiting_shipment: 'bg-orange',
  shipped: 'bg-purple',
  delivered: 'bg-green',
  cancelled: 'bg-red',
}

const CHANNEL_DOT_COLORS: Record<string, string> = {
  blue: 'bg-blue',
  purple: 'bg-purple',
  amber: 'bg-amber',
  red: 'bg-red',
}

const CHANNEL_BAR_COLORS: Record<string, string> = {
  blue: 'bg-blue',
  purple: 'bg-purple',
  amber: 'bg-amber',
  red: 'bg-red',
}

export default function Dashboard() {
  const [orders, setOrders] = useState<Order[]>([])
  const [history, setHistory] = useState<StatusHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)

    const [ordersRes, historyRes] = await Promise.all([
      supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false }),
      supabase
        .from('order_status_history')
        .select('id, order_id, from_status, to_status, changed_by, created_at, orders(customer_name), profiles:changed_by(full_name)')
        .order('created_at', { ascending: false })
        .limit(15),
    ])

    if (ordersRes.data) setOrders(ordersRes.data as Order[])
    if (historyRes.data) setHistory(historyRes.data as unknown as StatusHistoryEntry[])

    setLastUpdated(new Date().toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' }))
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Metric calculations
  const pendingCount = orders.filter((o) => o.status === 'pending').length
  const processingCount = orders.filter((o) => o.status === 'processing').length
  const awaitingShipmentCount = orders.filter((o) => o.status === 'awaiting_shipment').length
  const urgentCount = orders.filter(
    (o) => ['pending', 'processing', 'awaiting_shipment'].includes(o.status) && hoursAgo(o.created_at) >= 24
  ).length
  const today = new Date().toISOString().slice(0, 10)
  const deliveredTodayCount = orders.filter(
    (o) => o.status === 'delivered' && o.delivered_at && o.delivered_at.slice(0, 10) === today
  ).length
  const totalValue = orders.reduce((sum, o) => sum + Number(o.value), 0)

  // Channel breakdown
  const channels: OrderChannel[] = ['direct', 'bwg', 'musgrave', 'manual']
  const channelCounts = channels.map((ch) => ({
    channel: ch,
    count: orders.filter((o) => o.channel === ch).length,
  }))
  const maxChannelCount = Math.max(...channelCounts.map((c) => c.count), 1)

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <header className="h-[54px] shrink-0 bg-s1 border-b border-border flex items-center justify-between px-5">
          <h1 className="text-base font-semibold text-text">Dashboard</h1>
        </header>
        <div className="flex-1 flex items-center justify-center text-muted">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
              <path d="M14 8a6 6 0 00-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span className="text-sm">Loading dashboard...</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Topbar */}
      <header className="h-[54px] shrink-0 bg-s1 border-b border-border flex items-center justify-between px-5">
        <h1 className="text-base font-semibold text-text">Dashboard</h1>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-muted">Updated {lastUpdated}</span>
          )}
          <button
            onClick={async () => {
              setSyncing(true)
              try {
                const result = await zohoSync()
                await fetchData()
                setSyncing(false)
                alert(`Synced ${result.synced} orders from Zoho Books${result.errors.length ? `\n${result.errors.length} errors` : ''}`)
              } catch (err) {
                setSyncing(false)
                alert(`Sync failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
              }
            }}
            disabled={syncing}
            className="flex items-center gap-1.5 bg-green-d hover:bg-green/25 text-green text-xs font-medium rounded-md px-3 py-1.5 border border-green/25 transition-colors cursor-pointer disabled:opacity-50"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 2.5a5.487 5.487 0 00-4.131 1.869l1.204 1.204A.25.25 0 014.896 6H1.25A.25.25 0 011 5.75V2.104a.25.25 0 01.427-.177l1.38 1.38A7.002 7.002 0 0115 8a.75.75 0 01-1.5 0 5.5 5.5 0 00-5.5-5.5zM2.5 8a.75.75 0 00-1.5 0 7.002 7.002 0 0012.193 4.693l1.38 1.38a.25.25 0 00.427-.177V10.25a.25.25 0 00-.25-.25h-3.646a.25.25 0 00-.177.427l1.204 1.204A5.487 5.487 0 018 13.5 5.5 5.5 0 012.5 8z" />
            </svg>
            {syncing ? 'Syncing...' : 'Sync Zoho'}
          </button>
          <button
            onClick={fetchData}
            className="flex items-center gap-1.5 bg-amber-d hover:bg-amber/25 text-amber text-xs font-medium rounded-md px-3 py-1.5 border border-amber/25 transition-colors cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 2.5a5.487 5.487 0 00-4.131 1.869l1.204 1.204A.25.25 0 014.896 6H1.25A.25.25 0 011 5.75V2.104a.25.25 0 01.427-.177l1.38 1.38A7.002 7.002 0 0115 8a.75.75 0 01-1.5 0 5.5 5.5 0 00-5.5-5.5zM2.5 8a.75.75 0 00-1.5 0 7.002 7.002 0 0012.193 4.693l1.38 1.38a.25.25 0 00.427-.177V10.25a.25.25 0 00-.25-.25h-3.646a.25.25 0 00-.177.427l1.204 1.204A5.487 5.487 0 018 13.5 5.5 5.5 0 012.5 8z" />
            </svg>
            Refresh
          </button>
        </div>
      </header>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-5">
        {/* Metrics Grid - 2 rows of 3 */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <MetricCard
            label="Total Pending Orders"
            value={pendingCount}
            dotColor="bg-amber"
          />
          <MetricCard
            label="Processing"
            value={processingCount}
            dotColor="bg-blue"
          />
          <MetricCard
            label="Awaiting Shipment"
            value={awaitingShipmentCount}
            dotColor="bg-orange"
          />
          <MetricCard
            label="Urgent (>24h)"
            value={urgentCount}
            dotColor="bg-red"
          />
          <MetricCard
            label="Delivered Today"
            value={deliveredTodayCount}
            dotColor="bg-green"
          />
          <MetricCard
            label="Total Order Value"
            value={formatEur(totalValue)}
            dotColor="bg-green"
          />
        </div>

        {/* Two-column section */}
        <div className="grid grid-cols-2 gap-4">
          {/* Channel Breakdown */}
          <div className="bg-s1 border border-border rounded-lg p-4">
            <h2 className="text-sm font-semibold text-text mb-4">Orders by Channel</h2>
            <div className="flex flex-col gap-3">
              {channels.map((ch) => {
                const config = CHANNEL_CONFIG[ch]
                const count = channelCounts.find((c) => c.channel === ch)?.count ?? 0
                const pct = maxChannelCount > 0 ? (count / maxChannelCount) * 100 : 0

                return (
                  <div key={ch} className="flex items-center gap-3">
                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${CHANNEL_DOT_COLORS[config.colorClass]}`} />
                    <span className="text-sm text-text w-28 shrink-0">{config.label}</span>
                    <div className="flex-1 h-2 bg-s2 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${CHANNEL_BAR_COLORS[config.colorClass]}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-sm font-bold text-text w-8 text-right">{count}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-s1 border border-border rounded-lg p-4">
            <h2 className="text-sm font-semibold text-text mb-4">Recent Activity</h2>
            {history.length === 0 ? (
              <p className="text-sm text-muted">No recent activity</p>
            ) : (
              <div className="flex flex-col gap-2.5 max-h-[320px] overflow-y-auto">
                {history.map((entry) => {
                  const userName = entry.profiles?.full_name || 'System'
                  const customerName = entry.orders?.customer_name || 'Unknown'
                  const fromLabel = entry.from_status ? STATUS_LABELS[entry.from_status] : 'New'
                  const toLabel = STATUS_LABELS[entry.to_status]
                  const dotColor = STATUS_DOT_COLORS[entry.to_status] || 'bg-muted'
                  const timeAgo = ageLabel(entry.created_at)

                  return (
                    <div key={entry.id} className="flex items-start gap-2.5 text-xs">
                      <div className={`w-2 h-2 rounded-full shrink-0 mt-1 ${dotColor}`} />
                      <p className="text-muted leading-relaxed">
                        <span className="text-text font-medium">{userName}</span>
                        {' moved '}
                        <span className="text-text font-medium">{customerName}</span>
                        {' order from '}
                        <span className="text-text">{fromLabel}</span>
                        {' to '}
                        <span className="text-text">{toLabel}</span>
                        {' \u2014 '}
                        <span className="text-muted">{timeAgo}</span>
                      </p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function MetricCard({
  label,
  value,
  dotColor,
}: {
  label: string
  value: string | number
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
