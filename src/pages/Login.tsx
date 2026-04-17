import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { signIn } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (submitting) return

    setSubmitting(true)
    try {
      await signIn(email, password)
      navigate('/orders', { replace: true })
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Sign in failed'
      showToast(message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-bg px-4">
      <div className="w-full max-w-sm" style={{ animation: 'slideUp 0.3s ease-out' }}>
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-green/12 border border-green/15 mb-3">
            <span className="text-green font-bold text-base">OT</span>
          </div>
          <h1 className="text-lg font-semibold text-text">OrderTrack</h1>
          <p className="text-muted text-xs mt-1">Sign in to your account</p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-s1 border border-border rounded-xl p-6 space-y-4"
        >
          <div>
            <label className="block text-[11px] text-muted/60 uppercase tracking-wider font-semibold mb-1.5" htmlFor="email">
              Email address
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="w-full bg-s2 border border-border rounded-lg px-3 py-2.5 text-[13px] text-text placeholder:text-muted/40 outline-none focus:border-blue/40 focus:ring-1 focus:ring-blue/15 transition-all"
            />
          </div>

          <div>
            <label className="block text-[11px] text-muted/60 uppercase tracking-wider font-semibold mb-1.5" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full bg-s2 border border-border rounded-lg px-3 py-2.5 text-[13px] text-text placeholder:text-muted/40 outline-none focus:border-blue/40 focus:ring-1 focus:ring-blue/15 transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-green hover:bg-green/90 text-white font-medium text-[13px] rounded-lg px-4 py-2.5 transition-all disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed mt-2"
          >
            {submitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p className="text-center text-xs text-muted/60 mt-5">
          Don&apos;t have an account?{' '}
          <Link to="/register" className="text-green hover:text-green/80 transition-colors">
            Create one
          </Link>
        </p>
      </div>
    </div>
  )
}
