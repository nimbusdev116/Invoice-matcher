import { useEffect, useState, createContext, useContext, useCallback, Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import Sidebar from './Sidebar'
import BottomNav from './BottomNav'

interface ShellContext { sidebarOpen: boolean; toggleSidebar: () => void }
const ShellCtx = createContext<ShellContext>({ sidebarOpen: true, toggleSidebar: () => {} })
export function useShell() { return useContext(ShellCtx) }

function PageSpinner() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="flex items-center gap-2.5 text-muted">
        <svg className="w-4 h-4 animate-spin" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
          <path d="M14 8a6 6 0 00-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <span className="text-sm">Loading...</span>
      </div>
    </div>
  )
}

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
      <div className="flex flex-col md:flex-row h-screen overflow-hidden bg-bg">
        <div className={`hidden md:block shrink-0 transition-all duration-200 ${sidebarOpen ? 'w-[220px]' : 'w-0'} overflow-hidden`}>
          <Sidebar pendingCount={pendingCount} alertCount={alertCount} />
        </div>
        <main className="flex-1 flex flex-col overflow-hidden pb-[56px] md:pb-0">
          <Suspense fallback={<PageSpinner />}>
            <Outlet />
          </Suspense>
        </main>
        <BottomNav pendingCount={pendingCount} alertCount={alertCount} />
      </div>
    </ShellCtx.Provider>
  )
}
