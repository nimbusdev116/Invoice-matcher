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

/* ── Simple inline SVG icons (16x16) ── */

const icons = {
  dashboard: (
    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
      <path d="M1 2.5A1.5 1.5 0 012.5 1h3A1.5 1.5 0 017 2.5v3A1.5 1.5 0 015.5 7h-3A1.5 1.5 0 011 5.5v-3zm8 0A1.5 1.5 0 0110.5 1h3A1.5 1.5 0 0115 2.5v3A1.5 1.5 0 0113.5 7h-3A1.5 1.5 0 019 5.5v-3zm-8 8A1.5 1.5 0 012.5 9h3A1.5 1.5 0 017 10.5v3A1.5 1.5 0 015.5 15h-3A1.5 1.5 0 011 13.5v-3zm8 0A1.5 1.5 0 0110.5 9h3a1.5 1.5 0 011.5 1.5v3a1.5 1.5 0 01-1.5 1.5h-3A1.5 1.5 0 019 13.5v-3z" />
    </svg>
  ),
  pending: (
    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM0 8a8 8 0 1116 0A8 8 0 010 8zm8-3.25a.75.75 0 01.75.75v2.69l1.78 1.78a.75.75 0 11-1.06 1.06l-2-2A.75.75 0 017.25 8.5v-3a.75.75 0 01.75-.75z" />
    </svg>
  ),
  orders: (
    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
      <path d="M2 1.75C2 .784 2.784 0 3.75 0h8.5C13.216 0 14 .784 14 1.75v12.5A1.75 1.75 0 0112.25 16h-8.5A1.75 1.75 0 012 14.25V1.75zm1.75-.25a.25.25 0 00-.25.25v12.5c0 .138.112.25.25.25h8.5a.25.25 0 00.25-.25V1.75a.25.25 0 00-.25-.25h-8.5zM5 4.75A.75.75 0 015.75 4h4.5a.75.75 0 010 1.5h-4.5A.75.75 0 015 4.75zM5.75 7.5a.75.75 0 000 1.5h4.5a.75.75 0 000-1.5h-4.5zm0 3.5a.75.75 0 000 1.5h2.5a.75.75 0 000-1.5h-2.5z" />
    </svg>
  ),
  deliveries: (
    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
      <path d="M11.536 3.464a5 5 0 010 7.072L8 14.07l-3.536-3.535a5 5 0 117.072-7.072zM8 9a2 2 0 100-4 2 2 0 000 4z" />
    </svg>
  ),
  pod: (
    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
      <path d="M4.72.22a.75.75 0 011.06 0l1 1a.75.75 0 01-1.06 1.06L5.5 2.06v7.94a.75.75 0 01-1.5 0V2.06l-.22.22a.75.75 0 01-1.06-1.06l1-1zm5.56 1.28a.75.75 0 10-1.06 1.06l.22.22v7.94a.75.75 0 001.5 0V2.78l.22.22a.75.75 0 001.06-1.06l-1-1a.75.75 0 00-1.06 0l-.88.56zM1.5 13.75a.75.75 0 01.75-.75h11.5a.75.75 0 010 1.5H2.25a.75.75 0 01-.75-.75z" />
    </svg>
  ),
  alerts: (
    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 1.5c-1.736 0-3.369.674-4.596 1.897A6.448 6.448 0 001.5 8c0 1.736.674 3.369 1.904 4.603A6.448 6.448 0 008 14.5c1.736 0 3.369-.674 4.596-1.897A6.448 6.448 0 0014.5 8c0-1.736-.674-3.369-1.904-4.603A6.448 6.448 0 008 1.5zM8.75 4.75a.75.75 0 00-1.5 0v3.5a.75.75 0 001.5 0v-3.5zm-.75 6a.75.75 0 100-1.5.75.75 0 000 1.5z" />
    </svg>
  ),
  settings: (
    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
      <path d="M2 5.5a3.5 3.5 0 115.898 2.549 5.508 5.508 0 013.034 4.084.75.75 0 11-1.482.235 4.001 4.001 0 00-6.9 0 .75.75 0 01-1.482-.236A5.507 5.507 0 013.102 8.05 3.493 3.493 0 012 5.5zM5.5 4a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm5-.5a.75.75 0 01.75.75v1h1a.75.75 0 010 1.5h-1v1a.75.75 0 01-1.5 0v-1h-1a.75.75 0 010-1.5h1v-1A.75.75 0 0110.5 3.5z" />
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
    <aside className="w-60 shrink-0 h-screen bg-s1 border-r border-border flex flex-col">
      {/* Logo row */}
      <div className="px-4 py-4 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-8 h-8 rounded-md bg-green/15">
            <span className="text-green font-bold text-sm">OT</span>
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-text">OrderTrack</div>
            <div className="text-[10px] text-muted">Powered by Zoho Books</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-5">
        {/* Workspace group */}
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted font-medium px-2 mb-1.5">
            Workspace
          </div>
          <ul className="space-y-0.5">
            {workspaceItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm transition-colors ${
                      isActive
                        ? 'bg-amber-d text-amber'
                        : 'text-muted hover:text-text hover:bg-s2'
                    }`
                  }
                >
                  {item.icon}
                  <span className="flex-1">{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded-full min-w-[20px] text-center ${
                      item.badgeColor === 'red'
                        ? 'bg-red/20 text-red'
                        : 'bg-amber/20 text-amber'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>

        {/* Settings group */}
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted font-medium px-2 mb-1.5">
            Account
          </div>
          <ul className="space-y-0.5">
            {settingsItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm transition-colors ${
                      isActive
                        ? 'bg-amber-d text-amber'
                        : 'text-muted hover:text-text hover:bg-s2'
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

      {/* User row */}
      <div className="px-3 py-3 border-t border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-s3 border border-border flex items-center justify-center text-xs font-medium text-muted">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm text-text truncate">
              {profile?.full_name ?? 'Loading...'}
            </div>
            <div className="text-[10px] text-muted capitalize">
              {profile?.role ?? ''}
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}
