import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'

interface AppShellProps {
  pendingCount: number
}

export default function AppShell({ pendingCount }: AppShellProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      <Sidebar pendingCount={pendingCount} />
      <main className="flex-1 flex flex-col overflow-hidden">
        <Outlet />
      </main>
    </div>
  )
}
