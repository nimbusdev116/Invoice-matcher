import { useState, useMemo, useCallback } from 'react'
import type { Order, OrderChannel, OrderStatus, FulfillmentMethod } from '../types'
import { BOARD_STATUSES, CHANNEL_CONFIG } from '../types'
import { useOrders } from '../hooks/useOrders'
import { useIsMobile } from '../hooks/useMediaQuery'
import { useToast } from '../contexts/ToastContext'
import Topbar from '../components/layout/Topbar'
import SummaryBar from '../components/board/SummaryBar'
import FilterBar, { type FilterMode, type SortMode } from '../components/board/FilterBar'
import BoardColumn from '../components/board/BoardColumn'
import OrderCard from '../components/board/OrderCard'
import OrderDetailModal from '../components/board/OrderDetailModal'
import NewOrderModal from '../components/board/NewOrderModal'

const CHANNELS: OrderChannel[] = ['direct', 'bwg', 'musgrave', 'manual']

const CHANNEL_TAB_ACTIVE: Record<OrderChannel, string> = {
  direct: 'bg-blue/12 text-blue border-blue/30',
  bwg: 'bg-purple/12 text-purple border-purple/30',
  musgrave: 'bg-amber/12 text-amber border-amber/30',
  manual: 'bg-red/12 text-red border-red/30',
}

export default function PendingBoard() {
  const { orders, loading, fetchOrders, advanceOrder, updateOrderStatus, updateOrder, createOrder } = useOrders()
  const { showToast } = useToast()
  const isMobile = useIsMobile()

  const [filter, setFilter] = useState<FilterMode>('all')
  const [sort, setSort] = useState<SortMode>('age-desc')
  const [detailOrder, setDetailOrder] = useState<Order | null>(null)
  const [showDetail, setShowDetail] = useState(false)
  const [showNewOrder, setShowNewOrder] = useState(false)
  const [mobileChannel, setMobileChannel] = useState<OrderChannel>('direct')
  const [lastUpdated, setLastUpdated] = useState(
    new Date().toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' })
  )

  const filteredOrders = useMemo(() => {
    let list = orders.filter((o) => BOARD_STATUSES.includes(o.status))
    if (filter !== 'all') {
      list = list.filter((o) => o.status === filter)
    }
    return list
  }, [orders, filter])

  const sortedByChannel = useCallback(
    (channel: OrderChannel) => {
      const channelOrders = filteredOrders.filter((o) => o.channel === channel)
      if (sort === 'age-desc') return channelOrders.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      if (sort === 'age-asc') return channelOrders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      return channelOrders.sort((a, b) => Number(b.value) - Number(a.value))
    },
    [filteredOrders, sort]
  )

  const handleRefresh = () => {
    fetchOrders()
    setLastUpdated(new Date().toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' }))
    showToast('Board refreshed', 'success')
  }

  const handleAdvance = async (id: string) => {
    try {
      await advanceOrder(id)
      const order = orders.find((o) => o.id === id)
      showToast(`${order?.so_number || id.slice(0, 8)} advanced`, 'success')
    } catch {
      showToast('Failed to advance order', 'error')
    }
  }

  const handleProcess = async (id: string) => {
    try {
      await updateOrderStatus(id, 'processing')
      const order = orders.find((o) => o.id === id)
      showToast(`${order?.so_number || id.slice(0, 8)} → Processing`, 'success')
    } catch {
      showToast('Failed to update order', 'error')
    }
  }

  const handleCardClick = (id: string) => {
    const order = orders.find((o) => o.id === id)
    if (order) {
      setDetailOrder(order)
      setShowDetail(true)
    }
  }

  const handleSaveOrder = async (
    id: string,
    updates: { status: OrderStatus; fulfillment_method: FulfillmentMethod | null; notes: string | null }
  ) => {
    try {
      await updateOrder(id, updates)
      setShowDetail(false)
      showToast(`Order updated → ${updates.status}`, 'success')
    } catch {
      showToast('Failed to save order', 'error')
    }
  }

  const handleCancelOrder = async (id: string) => {
    try {
      await updateOrderStatus(id, 'cancelled')
      setShowDetail(false)
      showToast('Order cancelled', 'success')
    } catch {
      showToast('Failed to cancel order', 'error')
    }
  }

  const handleCreateOrder = async (order: Parameters<typeof createOrder>[0]) => {
    try {
      const created = await createOrder(order)
      showToast(`${created.so_number} created`, 'success')
    } catch {
      showToast('Failed to create order', 'error')
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <Topbar title="Pending orders board" />
        <div className="flex-1 flex items-center justify-center text-muted">Loading orders...</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <Topbar
        title="Pending orders board"
        lastUpdated={`Updated ${lastUpdated}`}
        onRefresh={handleRefresh}
        onNewOrder={() => setShowNewOrder(true)}
      />
      <SummaryBar orders={orders} />
      <FilterBar
        filter={filter}
        sort={sort}
        onFilterChange={setFilter}
        onSortChange={setSort}
      />

      <div className="flex-1 overflow-hidden p-3 md:p-4 md:px-5">
        {isMobile ? (
          <div className="flex flex-col h-full">
            <div className="flex gap-1.5 mb-3 overflow-x-auto scrollbar-hide shrink-0">
              {CHANNELS.map((ch) => (
                <button
                  key={ch}
                  onClick={() => setMobileChannel(ch)}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap border transition-all cursor-pointer shrink-0 ${
                    mobileChannel === ch
                      ? CHANNEL_TAB_ACTIVE[ch]
                      : 'border-transparent text-muted'
                  }`}
                >
                  {CHANNEL_CONFIG[ch].label}
                  <span className="ml-1.5 text-[10px] opacity-70">
                    {sortedByChannel(ch).length}
                  </span>
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto">
              {sortedByChannel(mobileChannel).length === 0 ? (
                <div className="py-12 text-center text-muted/40">
                  <svg className="w-8 h-8 mx-auto mb-2 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-xs">All clear</div>
                </div>
              ) : (
                sortedByChannel(mobileChannel).map((order, i) => (
                  <div key={order.id} style={{ animation: `fadeIn ${0.1 + i * 0.03}s ease-out` }}>
                    <OrderCard
                      order={order}
                      onAdvance={handleAdvance}
                      onProcess={handleProcess}
                      onClick={handleCardClick}
                    />
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-3.5 h-full">
            {CHANNELS.map((ch) => (
              <BoardColumn
                key={ch}
                channel={ch}
                orders={sortedByChannel(ch)}
                allOrdersForChannel={orders.filter((o) => o.channel === ch)}
                onAdvance={handleAdvance}
                onProcess={handleProcess}
                onCardClick={handleCardClick}
              />
            ))}
          </div>
        )}
      </div>

      {/* Mobile FAB */}
      <button
        onClick={() => setShowNewOrder(true)}
        className="md:hidden fixed right-4 bottom-20 w-14 h-14 rounded-full bg-green text-bg shadow-lg shadow-green/30 flex items-center justify-center z-30 cursor-pointer active:scale-95 transition-transform"
      >
        <svg className="w-6 h-6" viewBox="0 0 16 16" fill="currentColor">
          <path d="M7.75 2a.75.75 0 01.75.75V7h4.25a.75.75 0 010 1.5H8.5v4.25a.75.75 0 01-1.5 0V8.5H2.75a.75.75 0 010-1.5H7V2.75A.75.75 0 017.75 2z" />
        </svg>
      </button>

      <OrderDetailModal
        order={detailOrder}
        open={showDetail}
        onClose={() => setShowDetail(false)}
        onSave={handleSaveOrder}
        onCancel={handleCancelOrder}
      />

      <NewOrderModal
        open={showNewOrder}
        onClose={() => setShowNewOrder(false)}
        onCreate={handleCreateOrder}
      />
    </div>
  )
}
