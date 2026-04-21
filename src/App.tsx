import { lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ToastProvider } from './contexts/ToastContext'
import AppShell from './components/layout/AppShell'
import Login from './pages/Login'
import Register from './pages/Register'

const PendingBoard = lazy(() => import('./pages/PendingBoard'))
const Dashboard    = lazy(() => import('./pages/Dashboard'))
const AllOrders    = lazy(() => import('./pages/AllOrders'))
const Deliveries   = lazy(() => import('./pages/Deliveries'))
const PodTracker   = lazy(() => import('./pages/PodTracker'))
const Alerts       = lazy(() => import('./pages/Alerts'))
const Settings     = lazy(() => import('./pages/Settings'))

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-bg">
        <div className="text-center">
          <div className="w-10 h-10 rounded-lg bg-green/15 flex items-center justify-center mx-auto mb-3">
            <span className="text-green font-bold text-sm">OT</span>
          </div>
          <div className="text-muted text-sm">Loading...</div>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) return null

  if (user) {
    return <Navigate to="/orders" replace />
  }

  return <>{children}</>
}

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicRoute>
            <Register />
          </PublicRoute>
        }
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/orders" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="orders" element={<PendingBoard />} />
        <Route path="all-orders" element={<AllOrders />} />
        <Route path="deliveries" element={<Deliveries />} />
        <Route path="pod-tracker" element={<PodTracker />} />
        <Route path="alerts" element={<Alerts />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/orders" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
