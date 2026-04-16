import { createContext, useContext, useState, useCallback, useRef } from 'react'
import type { ReactNode } from 'react'

type ToastType = 'success' | 'error' | 'info'

interface Toast {
  id: number
  message: string
  type: ToastType
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

const TOAST_COLORS: Record<ToastType, { bg: string; border: string }> = {
  success: { bg: 'bg-green-d', border: 'border-green' },
  error: { bg: 'bg-red-d', border: 'border-red' },
  info: { bg: 'bg-blue-d', border: 'border-blue' },
}

const TOAST_ICONS: Record<ToastType, ReactNode> = {
  success: (
    <svg className="w-4 h-4 text-green shrink-0" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 16A8 8 0 108 0a8 8 0 000 16zm3.78-9.72a.75.75 0 00-1.06-1.06L6.75 9.19 5.28 7.72a.75.75 0 00-1.06 1.06l2 2a.75.75 0 001.06 0l4.5-4.5z" />
    </svg>
  ),
  error: (
    <svg className="w-4 h-4 text-red shrink-0" viewBox="0 0 16 16" fill="currentColor">
      <path d="M2.343 13.657A8 8 0 1113.657 2.343 8 8 0 012.343 13.657zM6.03 4.97a.75.75 0 00-1.06 1.06L6.94 8 4.97 9.97a.75.75 0 101.06 1.06L8 9.06l1.97 1.97a.75.75 0 101.06-1.06L9.06 8l1.97-1.97a.75.75 0 10-1.06-1.06L8 6.94 6.03 4.97z" />
    </svg>
  ),
  info: (
    <svg className="w-4 h-4 text-blue shrink-0" viewBox="0 0 16 16" fill="currentColor">
      <path d="M0 8a8 8 0 1116 0A8 8 0 010 8zm8-6.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM6.5 7.75A.75.75 0 017.25 7h1a.75.75 0 01.75.75v2.75h.25a.75.75 0 010 1.5h-2a.75.75 0 010-1.5h.25v-2h-.25a.75.75 0 01-.75-.75zM8 6a1 1 0 110-2 1 1 0 010 2z" />
    </svg>
  ),
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(0)

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = nextId.current++
    setToasts((prev) => [...prev, { id, message, type }])

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 2600)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* Toast container */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => {
          const colors = TOAST_COLORS[toast.type]
          const icon = TOAST_ICONS[toast.type]
          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-lg border ${colors.bg} ${colors.border} text-text text-sm shadow-lg animate-slide-in`}
              style={{
                animation: 'slideIn 0.25s ease-out',
              }}
            >
              {icon}
              <span>{toast.message}</span>
            </div>
          )
        })}
      </div>

      {/* Inline keyframes */}
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (ctx === undefined) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return ctx
}
