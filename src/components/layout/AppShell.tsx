import { useEffect, useState, createContext, useContext, useCallback } from 'react'
import { Outlet } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import Sidebar from './Sidebar'

interface ShellContext { sidebarOpen: boolean; toggleSidebar: () => void }
const ShellCtx = createContext<ShellContext>({ sidebarOpen: true, toggleSidebar: () => {} })
export function useShell() { return useContext(ShellCtx) }

export default function AppShell() {
  const [pendingCount, setPendingCount] = useState(0)
  const [alertCount, setAlertCount] = useState(0)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const toggleSidebar = useCallback(() => setSidebarOpen((v) => !v), [])

  useEffect(() => {
    async function fetchCounts() {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
      const [pending, alerts] = await Promise.all([
        supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .in('status', ['pending', 'processing', 'awaiting_shipment']),
        supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .in('status', ['pending', 'processing', 'awaiting_shipment'])
          .lt('created_at', threeDaysAgo),
      ])
      setPendingCount(pending.count ?? 0)
      setAlertCount(alerts.count ?? 0)
    }

    fetchCounts()

    const channel = supabase
      .channel('appshell-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchCounts()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  return (
    <ShellCtx.Provider value={{ sidebarOpen, toggleSidebar }}>
      <div className="flex h-screen overflow-hidden bg-bg">
        <div className={`shrink-0 transition-all duration-200 ${sidebarOpen ? 'w-[220px]' : 'w-0'} overflow-hidden`}>
          <Sidebar pendingCount={pendingCount} alertCount={alertCount} />
        </div>
        <main className="flex-1 flex flex-col overflow-hidden">
          <Outlet />
        </main>
      </div>
    </ShellCtx.Provider>
  )
}
