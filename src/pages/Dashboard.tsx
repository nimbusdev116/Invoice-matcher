import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { zohoSync } from '../lib/api'
import type { Order, OrderChannel, OrderStatus } from '../types'
import { CHANNEL_CONFIG, STATUS_LABELS } from '../types'
import { formatEur, hoursAgo, ageLabel } from '../lib/utils'
import { useToast } from '../contexts/ToastContext'
import Toggle from '../components/ui/Toggle'

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

const PIPELINE_STAGES: { status: OrderStatus; label: string; color: string; bgColor: string; borderColor: string }[] = [
  { status: 'pending', label: 'Pending', color: 'text-amber', bgColor: 'bg-amber/10', borderColor: 'border-amber/20' },
  { status: 'processing', label: 'Processing', color: 'text-blue', bgColor: 'bg-blue/10', borderColor: 'border-blue/20' },
  { status: 'awaiting_shipment', label: 'Awaiting', color: 'text-orange', bgColor: 'bg-orange/10', borderColor: 'border-orange/20' },
  { status: 'shipped', label: 'Shipped', color: 'text-purple', bgColor: 'bg-purple/10', borderColor: 'border-purple/20' },
  { status: 'delivered', label: 'Delivered', color: 'text-green', bgColor: 'bg-green/10', borderColor: 'border-green/20' },
]

export default function Dashboard() {
  const [orders, setOrders] = useState<Order[]>([])
  const [history, setHistory] = useState<StatusHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState('')
  const [autoSync, setAutoSync] = useState(() => {
    const saved = localStorage.getItem('autoSync')
    return saved === 'true'
  })
  const [liveUpdates, setLiveUpdates] = useState(true)
  const { showToast } = useToast()

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

  useEffect(() => {
    if (!liveUpdates) return
    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setOrders((prev) => [payload.new as Order, ...prev])
        } else if (payload.eventType === 'UPDATE') {
          setOrders((prev) => prev.map((o) => o.id === (payload.new as Order).id ? payload.new as Order : o))
        } else if (payload.eventType === 'DELETE') {
          setOrders((prev) => prev.filter((o) => o.id !== (payload.old as { id: string }).id))
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [liveUpdates])

  useEffect(() => {
    localStorage.setItem('autoSync', String(autoSync))
    if (!autoSync) return
    const interval = setInterval(async () => {
      try {
        await zohoSync()
        await fetchData()
      } catch (err) {
        console.error('Auto-sync failed:', err)
        showToast(err instanceof Error ? err.message : 'Auto-sync failed', 'error')
      }
    }, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [autoSync, fetchData, showToast])

  const handleSync = async (full = false) => {
    setSyncing(true)
    try {
      const result = await zohoSync(full ? { full: true } : undefined)
      await fetchData()
      setSyncing(false)
      const parts = [`Synced ${result.synced} new orders`]
      if (result.advanced) parts.push(`${result.advanced} status updated`)
      if (result.shipped) parts.push(`${result.shipped} moved to Shipped`)
      if (result.cancelled) parts.push(`${result.cancelled} cancelled`)
      if (result.errors?.length) parts.push(`${result.errors.length} errors`)
      alert(parts.join('\n'))
    } catch (err) {
      setSyncing(false)
      alert(`Sync failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    const ACTIVE = ['pending', 'processing', 'awaiting_shipment']
    let pending = 0, processing = 0, awaiting = 0, shipped = 0, delivered = 0
    let urgent = 0, deliveredToday = 0, totalVal = 0, activeVal = 0
    const chCounts: Record<string, { count: number; value: number; active: number }> = {
      direct: { count: 0, value: 0, active: 0 },
      bwg: { count: 0, value: 0, active: 0 },
      musgrave: { count: 0, value: 0, active: 0 },
      manual: { count: 0, value: 0, active: 0 },
    }
    for (const o of orders) {
      const val = Number(o.value)
      totalVal += val
      if (o.status === 'pending') pending++
      else if (o.status === 'processing') processing++
      else if (o.status === 'awaiting_shipment') awaiting++
      else if (o.status === 'shipped') shipped++
      else if (o.status === 'delivered') delivered++
      if (ACTIVE.includes(o.status)) { urgent += hoursAgo(o.created_at) >= 72 ? 1 : 0; activeVal += val }
      if (o.status === 'delivered' && o.delivered_at?.slice(0, 10) === today) deliveredToday++
      const ch = chCounts[o.channel]
      if (ch) { ch.count++; ch.value += val; if (ACTIVE.includes(o.status)) ch.active++ }
    }
    const channelData = (['direct', 'bwg', 'musgrave', 'manual'] as OrderChannel[]).map((ch) => ({
      channel: ch, ...chCounts[ch],
    }))
    const pipelineCounts = { pending, processing, awaiting_shipment: awaiting, shipped, delivered }
    return {
      pendingCount: pending, processingCount: processing, awaitingShipmentCount: awaiting,
      shippedCount: shipped, deliveredCount: delivered, urgentCount: urgent,
      deliveredTodayCount: deliveredToday, totalValue: totalVal, activeValue: activeVal,
      channelData, pipelineCounts,
      maxPipeline: Math.max(pending, processing, awaiting, shipped, delivered, 1),
      maxChannelCount: Math.max(...channelData.map((c) => c.count), 1),
    }
  }, [orders])

  const {
    pendingCount, processingCount, awaitingShipmentCount, shippedCount, deliveredCount,
    urgentCount, deliveredTodayCount, totalValue, activeValue,
    channelData, pipelineCounts, maxPipeline, maxChannelCount,
  } = stats

  const CHANNEL_COLORS: Record<string, string> = {
    blue: 'bg-blue',
    purple: 'bg-purple',
    amber: 'bg-amber',
    red: 'bg-red',
  }

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <header className="h-14 shrink-0 bg-s1 border-b border-border flex items-center px-6">
          <h1 className="text-sm font-semibold text-text">Dashboard</h1>
        </header>
        <div className="flex-1 flex items-center justify-center text-muted">
          <div className="flex items-center gap-2.5">
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
      {/* Header */}
      <header className="h-14 shrink-0 bg-s1 border-b border-border flex items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-4">
          <h1 className="text-sm font-semibold text-text">Dashboard</h1>
          {lastUpdated && (
            <span className="text-[11px] text-muted/70">Last updated {lastUpdated}</span>
          )}
        </div>
        <div className="hidden md:flex items-center gap-3">
          <Toggle
            enabled={liveUpdates}
            onChange={setLiveUpdates}
            label="Live"
            size="sm"
          />
          <Toggle
            enabled={autoSync}
            onChange={setAutoSync}
            label="Auto-sync"
            size="sm"
          />
          <div className="w-px h-5 bg-border mx-1" />
          <button
            onClick={() => handleSync(false)}
            disabled={syncing}
            className="flex items-center gap-1.5 bg-green/10 hover:bg-green/20 text-green text-[11px] font-medium rounded-lg px-3 py-1.5 border border-green/20 transition-all cursor-pointer disabled:opacity-40"
          >
            <svg className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 2.5a5.487 5.487 0 00-4.131 1.869l1.204 1.204A.25.25 0 014.896 6H1.25A.25.25 0 011 5.75V2.104a.25.25 0 01.427-.177l1.38 1.38A7.002 7.002 0 0115 8a.75.75 0 01-1.5 0 5.5 5.5 0 00-5.5-5.5zM2.5 8a.75.75 0 00-1.5 0 7.002 7.002 0 0012.193 4.693l1.38 1.38a.25.25 0 00.427-.177V10.25a.25.25 0 00-.25-.25h-3.646a.25.25 0 00-.177.427l1.204 1.204A5.487 5.487 0 018 13.5 5.5 5.5 0 012.5 8z" />
            </svg>
            {syncing ? 'Syncing...' : 'Sync'}
          </button>
          <button
            onClick={() => {
              if (!confirm('Full resync will re-fetch ALL orders from April 2026. Continue?')) return
              handleSync(true)
            }}
            disabled={syncing}
            className="flex items-center gap-1.5 text-muted hover:text-text text-[11px] font-medium rounded-lg px-3 py-1.5 border border-border hover:border-border2 transition-all cursor-pointer disabled:opacity-40"
          >
            Full Resync
          </button>
          <button
            onClick={fetchData}
            className="flex items-center justify-center w-7 h-7 rounded-lg border border-border hover:border-border2 text-muted hover:text-text transition-all cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 2.5a5.487 5.487 0 00-4.131 1.869l1.204 1.204A.25.25 0 014.896 6H1.25A.25.25 0 011 5.75V2.104a.25.25 0 01.427-.177l1.38 1.38A7.002 7.002 0 0115 8a.75.75 0 01-1.5 0 5.5 5.5 0 00-5.5-5.5zM2.5 8a.75.75 0 00-1.5 0 7.002 7.002 0 0012.193 4.693l1.38 1.38a.25.25 0 00.427-.177V10.25a.25.25 0 00-.25-.25h-3.646a.25.25 0 00-.177.427l1.204 1.204A5.487 5.487 0 018 13.5 5.5 5.5 0 012.5 8z" />
            </svg>
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {/* Top metrics row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6" style={{ animation: 'fadeIn 0.3s ease-out' }}>
          <MetricCard
            icon={<ClockIcon />}
            label="Active Orders"
            value={pendingCount + processingCount + awaitingShipmentCount}
            sub={`${formatEur(activeValue)} total value`}
            accent="amber"
          />
          <MetricCard
            icon={<AlertIcon />}
            label="Urgent"
            value={urgentCount}
            sub="> 3 days in queue"
            accent="red"
          />
          <MetricCard
            icon={<CheckIcon />}
            label="Delivered Today"
            value={deliveredTodayCount}
            sub={`of ${deliveredCount} total delivered`}
            accent="green"
          />
          <MetricCard
            icon={<ValueIcon />}
            label="Total Value"
            value={formatEur(totalValue)}
            sub={`${orders.length} total orders`}
            accent="blue"
          />
        </div>

        {/* Order Pipeline */}
        <div className="bg-s1 border border-border rounded-xl p-5 mb-6" style={{ animation: 'fadeIn 0.4s ease-out' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-text">Order Pipeline</h2>
            <span className="text-[11px] text-muted">{orders.length} total orders</span>
          </div>
          <div className="flex items-end gap-1.5">
            {PIPELINE_STAGES.map((stage, i) => {
              const count = pipelineCounts[stage.status] || 0
              const pct = Math.max((count / maxPipeline) * 100, 4)
              return (
                <div key={stage.status} className="flex-1 group" style={{ animation: `slideUp ${0.3 + i * 0.08}s ease-out` }}>
                  <div className="flex flex-col items-center">
                    <span className={`text-lg font-bold ${stage.color} mb-1`}>{count}</span>
                    <div className="w-full">
                      <div
                        className={`w-full ${stage.bgColor} border ${stage.borderColor} rounded-lg transition-all duration-500 group-hover:opacity-80`}
                        style={{ height: `${Math.max(pct * 1.2, 8)}px` }}
                      />
                    </div>
                    <span className="text-[10px] text-muted mt-2 font-medium">{stage.label}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Two-column section */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4" style={{ animation: 'fadeIn 0.5s ease-out' }}>
          {/* Channel Breakdown - 2 cols */}
          <div className="md:col-span-2 bg-s1 border border-border rounded-xl p-5">
            <h2 className="text-sm font-semibold text-text mb-4">Channels</h2>
            <div className="flex flex-col gap-4">
              {channelData.map((cd) => {
                const config = CHANNEL_CONFIG[cd.channel]
                const pct = maxChannelCount > 0 ? (cd.count / maxChannelCount) * 100 : 0

                return (
                  <div key={cd.channel}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${CHANNEL_COLORS[config.colorClass]}`} />
                        <span className="text-xs font-medium text-text">{config.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted">{cd.active} active</span>
                        <span className="text-xs font-bold text-text">{cd.count}</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-s3 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${CHANNEL_COLORS[config.colorClass]}`}
                        style={{ width: `${pct}%`, opacity: 0.7 }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
              <span className="text-[11px] text-muted">Total channel value</span>
              <span className="text-xs font-bold text-text">{formatEur(totalValue)}</span>
            </div>
          </div>

          {/* Recent Activity - 3 cols */}
          <div className="md:col-span-3 bg-s1 border border-border rounded-xl p-5">
            <h2 className="text-sm font-semibold text-text mb-4">Recent Activity</h2>
            {history.length === 0 ? (
              <div className="flex items-center justify-center py-10 text-muted">
                <div className="text-center">
                  <svg className="w-8 h-8 mx-auto mb-2 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-xs">No recent activity</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-0.5 max-h-[320px] overflow-y-auto">
                {history.map((entry, i) => {
                  const userName = entry.profiles?.full_name || 'System'
                  const customerName = entry.orders?.customer_name || 'Unknown'
                  const fromLabel = entry.from_status ? STATUS_LABELS[entry.from_status] : 'New'
                  const toLabel = STATUS_LABELS[entry.to_status]
                  const dotColor = STATUS_DOT_COLORS[entry.to_status] || 'bg-muted'
                  const timeAgo = ageLabel(entry.created_at)

                  return (
                    <div
                      key={entry.id}
                      className="flex items-center gap-3 py-2 px-2.5 rounded-lg hover:bg-s2/50 transition-colors"
                      style={{ animation: `fadeIn ${0.15 + i * 0.04}s ease-out` }}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted truncate">
                          <span className="text-text font-medium">{userName}</span>
                          {' moved '}
                          <span className="text-text">{customerName}</span>
                          {' '}
                          <span className="text-muted/70">{fromLabel}</span>
                          <span className="text-muted/50 mx-1">&rarr;</span>
                          <span className={STATUS_DOT_COLORS[entry.to_status]?.replace('bg-', 'text-') || 'text-muted'}>{toLabel}</span>
                        </p>
                      </div>
                      <span className="text-[10px] text-muted/60 shrink-0 tabular-nums">{timeAgo}</span>
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
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode
  label: string
  value: string | number
  sub: string
  accent: 'amber' | 'red' | 'green' | 'blue' | 'purple'
}) {
  const accentStyles = {
    amber: 'text-amber bg-amber/10 border-amber/15',
    red: 'text-red bg-red/10 border-red/15',
    green: 'text-green bg-green/10 border-green/15',
    blue: 'text-blue bg-blue/10 border-blue/15',
    purple: 'text-purple bg-purple/10 border-purple/15',
  }

  const iconStyles = {
    amber: 'text-amber bg-amber/10',
    red: 'text-red bg-red/10',
    green: 'text-green bg-green/10',
    blue: 'text-blue bg-blue/10',
    purple: 'text-purple bg-purple/10',
  }

  return (
    <div className={`rounded-xl border p-4 ${accentStyles[accent]}`}>
      <div className="flex items-center gap-2.5 mb-3">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${iconStyles[accent]}`}>
          {icon}
        </div>
        <span className="text-[11px] font-medium uppercase tracking-wider opacity-80">{label}</span>
      </div>
      <div className="text-2xl font-bold text-text mb-0.5">{value}</div>
      <div className="text-[11px] text-muted">{sub}</div>
    </div>
  )
}

function ClockIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function AlertIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function ValueIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
    </svg>
  )
}
