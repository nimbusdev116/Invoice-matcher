import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Order, OrderStatus, FulfillmentMethod, OrderSource, OrderChannel } from '../types'
import { BOARD_STATUSES, STATUS_FLOW } from '../types'

export function useOrders() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .in('status', BOARD_STATUSES)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching orders:', error)
    } else {
      setOrders((data as Order[]) || [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchOrders()

    const channel = supabase
      .channel('orders-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newOrder = payload.new as Order
            if (BOARD_STATUSES.includes(newOrder.status)) {
              setOrders((prev) => [...prev, newOrder])
            }
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as Order
            setOrders((prev) => {
              if (!BOARD_STATUSES.includes(updated.status)) {
                return prev.filter((o) => o.id !== updated.id)
              }
              const exists = prev.find((o) => o.id === updated.id)
              if (exists) {
                return prev.map((o) => (o.id === updated.id ? updated : o))
              }
              return [...prev, updated]
            })
          } else if (payload.eventType === 'DELETE') {
            const old = payload.old as { id: string }
            setOrders((prev) => prev.filter((o) => o.id !== old.id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchOrders])

  const updateOrderStatus = useCallback(
    async (orderId: string, status: OrderStatus) => {
      const { error } = await supabase
        .from('orders')
        .update({ status })
        .eq('id', orderId)

      if (error) throw error
    },
    []
  )

  const advanceOrder = useCallback(
    async (orderId: string) => {
      const order = orders.find((o) => o.id === orderId)
      if (!order) return
      const next = STATUS_FLOW[order.status]
      if (!next) return
      await updateOrderStatus(orderId, next)
    },
    [orders, updateOrderStatus]
  )

  const deleteOrder = useCallback(
    async (orderId: string): Promise<OrderStatus> => {
      const order = orders.find((o) => o.id === orderId)
      const previousStatus = order?.status ?? 'pending'
      await updateOrderStatus(orderId, 'cancelled')
      return previousStatus
    },
    [orders, updateOrderStatus]
  )

  const revertOrder = useCallback(
    async (orderId: string, previousStatus: OrderStatus) => {
      await updateOrderStatus(orderId, previousStatus)
    },
    [updateOrderStatus]
  )

  const updateOrder = useCallback(
    async (
      orderId: string,
      updates: {
        status?: OrderStatus
        fulfillment_method?: FulfillmentMethod | null
        notes?: string | null
      }
    ) => {
      const { error } = await supabase
        .from('orders')
        .update(updates)
        .eq('id', orderId)

      if (error) throw error
    },
    []
  )

  const createOrder = useCallback(
    async (order: {
      customer_name: string
      source: OrderSource
      channel: OrderChannel
      value: number
      fulfillment_method?: FulfillmentMethod | null
      reference_number?: string | null
      notes?: string | null
    }) => {
      const { count, error: countErr } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })

      if (countErr) throw countErr
      const so_number = `SO-${String((count ?? 0) + 1001).padStart(5, '0')}`

      const { data, error } = await supabase
        .from('orders')
        .insert({
          ...order,
          so_number,
          status: 'pending' as OrderStatus,
          currency: 'EUR',
        })
        .select()
        .single()

      if (error) throw error
      return data as Order
    },
    []
  )

  return {
    orders,
    loading,
    fetchOrders,
    updateOrderStatus,
    advanceOrder,
    deleteOrder,
    revertOrder,
    updateOrder,
    createOrder,
  }
}
