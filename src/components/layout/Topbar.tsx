import { useShell } from './AppShell'

interface TopbarProps {
  title: string
  onRefresh?: () => void
  onNewOrder?: () => void
  lastUpdated?: string
}

export default function Topbar({ title, onRefresh, onNewOrder, lastUpdated }: TopbarProps) {
  const { sidebarOpen, toggleSidebar } = useShell()

  return (
    <header className="h-14 shrink-0 bg-s1 border-b border-border flex items-center justify-between px-4 md:px-6">
      <div className="flex items-center gap-3">
        <button
          onClick={toggleSidebar}
          className="hidden md:flex items-center justify-center w-7 h-7 rounded-lg border border-border hover:border-border2 text-muted hover:text-text transition-all cursor-pointer"
          title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          {sidebarOpen ? (
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="9" y1="3" x2="9" y2="21" />
              <path d="M15 9l-3 3 3 3" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="9" y1="3" x2="9" y2="21" />
              <path d="M15 9l3 3-3 3" />
            </svg>
          )}
        </button>
        <h1 className="text-sm font-semibold text-text">{title}</h1>
        {lastUpdated && (
          <span className="text-[11px] text-muted/60">{lastUpdated}</span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="flex items-center justify-center w-7 h-7 rounded-lg border border-border hover:border-border2 text-muted hover:text-text transition-all cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 2.5a5.487 5.487 0 00-4.131 1.869l1.204 1.204A.25.25 0 014.896 6H1.25A.25.25 0 011 5.75V2.104a.25.25 0 01.427-.177l1.38 1.38A7.002 7.002 0 0115 8a.75.75 0 01-1.5 0 5.5 5.5 0 00-5.5-5.5zM2.5 8a.75.75 0 00-1.5 0 7.002 7.002 0 0012.193 4.693l1.38 1.38a.25.25 0 00.427-.177V10.25a.25.25 0 00-.25-.25h-3.646a.25.25 0 00-.177.427l1.204 1.204A5.487 5.487 0 018 13.5 5.5 5.5 0 012.5 8z" />
            </svg>
          </button>
        )}

        {onNewOrder && (
          <button
            onClick={onNewOrder}
            className="hidden md:flex items-center gap-1.5 bg-green/10 hover:bg-green/20 text-green text-[11px] font-medium rounded-lg px-3 py-1.5 border border-green/20 transition-all cursor-pointer"
          >
            <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
              <path d="M7.75 2a.75.75 0 01.75.75V7h4.25a.75.75 0 010 1.5H8.5v4.25a.75.75 0 01-1.5 0V8.5H2.75a.75.75 0 010-1.5H7V2.75A.75.75 0 017.75 2z" />
            </svg>
            New Order
          </button>
        )}
      </div>
    </header>
  )
}
