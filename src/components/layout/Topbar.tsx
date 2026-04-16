interface TopbarProps {
  title: string
  onRefresh?: () => void
  onNewOrder?: () => void
  lastUpdated?: string
}

export default function Topbar({ title, onRefresh, onNewOrder, lastUpdated }: TopbarProps) {
  return (
    <header className="h-[54px] shrink-0 bg-s1 border-b border-border flex items-center justify-between px-5">
      {/* Left: title */}
      <h1 className="text-base font-semibold text-text">{title}</h1>

      {/* Right: last updated + actions */}
      <div className="flex items-center gap-3">
        {lastUpdated && (
          <span className="text-xs text-muted">
            Updated {lastUpdated}
          </span>
        )}

        {onRefresh && (
          <button
            onClick={onRefresh}
            className="flex items-center gap-1.5 bg-amber-d hover:bg-amber/25 text-amber text-xs font-medium rounded-md px-3 py-1.5 border border-amber/25 transition-colors cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 2.5a5.487 5.487 0 00-4.131 1.869l1.204 1.204A.25.25 0 014.896 6H1.25A.25.25 0 011 5.75V2.104a.25.25 0 01.427-.177l1.38 1.38A7.002 7.002 0 0115 8a.75.75 0 01-1.5 0 5.5 5.5 0 00-5.5-5.5zM2.5 8a.75.75 0 00-1.5 0 7.002 7.002 0 0012.193 4.693l1.38 1.38a.25.25 0 00.427-.177V10.25a.25.25 0 00-.25-.25h-3.646a.25.25 0 00-.177.427l1.204 1.204A5.487 5.487 0 018 13.5 5.5 5.5 0 012.5 8z" />
            </svg>
            Refresh
          </button>
        )}

        {onNewOrder && (
          <button
            onClick={onNewOrder}
            className="flex items-center gap-1.5 bg-green hover:bg-green/90 text-white text-xs font-medium rounded-md px-3 py-1.5 transition-colors cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
              <path d="M7.75 2a.75.75 0 01.75.75V7h4.25a.75.75 0 010 1.5H8.5v4.25a.75.75 0 01-1.5 0V8.5H2.75a.75.75 0 010-1.5H7V2.75A.75.75 0 017.75 2z" />
            </svg>
            New Order
          </button>
        )}
      </div>
    </header>
  )
}
