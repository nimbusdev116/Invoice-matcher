import { NavLink } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

interface SidebarProps {
  pendingCount: number
  alertCount: number
}

interface NavItem {
  label: string
  to: string
  icon: React.ReactNode
  badge?: number
  badgeColor?: 'amber' | 'red'
}

const icons = {
  dashboard: (
    <svg className="w-[15px] h-[15px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  ),
  pending: (
    <svg className="w-[15px] h-[15px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  orders: (
    <svg className="w-[15px] h-[15px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  ),
  deliveries: (
    <svg className="w-[15px] h-[15px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="3" width="15" height="13" rx="2" />
      <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
      <circle cx="5.5" cy="18.5" r="2.5" />
      <circle cx="18.5" cy="18.5" r="2.5" />
    </svg>
  ),
  pod: (
    <svg className="w-[15px] h-[15px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  ),
  alerts: (
    <svg className="w-[15px] h-[15px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  settings: (
    <svg className="w-[15px] h-[15px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
}

export default function Sidebar({ pendingCount, alertCount }: SidebarProps) {
  const { profile } = useAuth()

  const workspaceItems: NavItem[] = [
    { label: 'Dashboard', to: '/dashboard', icon: icons.dashboard },
    { label: 'Pending orders', to: '/orders', icon: icons.pending, badge: pendingCount },
    { label: 'All orders', to: '/all-orders', icon: icons.orders },
    { label: 'Deliveries', to: '/deliveries', icon: icons.deliveries },
    { label: 'POD tracker', to: '/pod-tracker', icon: icons.pod },
    { label: 'Alerts', to: '/alerts', icon: icons.alerts, badge: alertCount, badgeColor: 'red' },
  ]

  const settingsItems: NavItem[] = [
    { label: 'Settings', to: '/settings', icon: icons.settings },
  ]

  const initials = profile?.full_name
    ? profile.full_name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '??'

  return (
    <aside className="w-[220px] shrink-0 h-screen bg-s1 border-r border-border flex flex-col">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-green/12 border border-green/15">
            <span className="text-green font-bold text-[11px] tracking-tight">OT</span>
          </div>
          <div className="leading-tight">
            <div className="text-[13px] font-semibold text-text tracking-tight">OrderTrack</div>
            <div className="text-[9px] text-muted/60 uppercase tracking-wider">Zoho Books</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        <div>
          <div className="text-[9px] uppercase tracking-[0.1em] text-muted/50 font-semibold px-2.5 mb-1.5">
            Workspace
          </div>
          <ul className="space-y-0.5">
            {workspaceItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-[13px] transition-all duration-150 ${
                      isActive
                        ? 'bg-white/[0.07] text-text font-medium shadow-sm shadow-black/10'
                        : 'text-muted hover:text-text hover:bg-white/[0.04]'
                    }`
                  }
                >
                  {item.icon}
                  <span className="flex-1">{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md min-w-[20px] text-center ${
                      item.badgeColor === 'red'
                        ? 'bg-red/15 text-red'
                        : 'bg-amber/15 text-amber'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <div className="text-[9px] uppercase tracking-[0.1em] text-muted/50 font-semibold px-2.5 mb-1.5">
            Account
          </div>
          <ul className="space-y-0.5">
            {settingsItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-[13px] transition-all duration-150 ${
                      isActive
                        ? 'bg-white/[0.07] text-text font-medium shadow-sm shadow-black/10'
                        : 'text-muted hover:text-text hover:bg-white/[0.04]'
                    }`
                  }
                >
                  {item.icon}
                  <span>{item.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      {/* User */}
      <div className="px-3 py-3 border-t border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-green/20 to-blue/20 border border-border flex items-center justify-center text-[10px] font-semibold text-muted">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[12px] text-text truncate font-medium">
              {profile?.full_name ?? 'Loading...'}
            </div>
            <div className="text-[10px] text-muted/60 capitalize">
              {profile?.role ?? ''}
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}
