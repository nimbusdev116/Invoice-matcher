import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import Sidebar from './Sidebar'

export default function AppShell() {
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    async function fetch() {
      const { count } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .in('status', ['pending', 'processing', 'pending_shipment'])

      setPendingCount(count ?? 0)
    }

    fetch()

    const channel = supabase
      .channel('appshell-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetch()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      <Sidebar pendingCount={pendingCount} />
      <main className="flex-1 flex flex-col overflow-hidden">
        <Outlet />
      </main>
    </div>
  )
}
