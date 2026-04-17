import { useState, useMemo, useCallback } from 'react'
import type { Order, OrderChannel, OrderStatus, FulfillmentMethod } from '../types'
import { BOARD_STATUSES } from '../types'
import { useOrders } from '../hooks/useOrders'
import { useToast } from '../contexts/ToastContext'
import Topbar from '../components/layout/Topbar'
import SummaryBar from '../components/board/SummaryBar'
import FilterBar, { type FilterMode, type SortMode } from '../components/board/FilterBar'
import BoardColumn from '../components/board/BoardColumn'
import OrderDetailModal from '../components/board/OrderDetailModal'
import NewOrderModal from '../components/board/NewOrderModal'

const CHANNELS: OrderChannel[] = ['direct', 'bwg', 'musgrave', 'manual']

export default function PendingBoard() {
  const { orders, loading, fetchOrders, advanceOrder, updateOrderStatus, updateOrder, createOrder } = useOrders()
  const { showToast } = useToast()

  const [filter, setFilter] = useState<FilterMode>('all')
  const [sort, setSort] = useState<SortMode>('age-desc')
  const [detailOrder, setDetailOrder] = useState<Order | null>(null)
  const [showDetail, setShowDetail] = useState(false)
  const [showNewOrder, setShowNewOrder] = useState(false)
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

      <div className="flex-1 overflow-hidden p-4 px-5">
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
      </div>

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
