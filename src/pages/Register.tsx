import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'

export default function Register() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { signUp } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (submitting) return

    if (password !== confirmPassword) {
      showToast('Passwords do not match', 'error')
      return
    }

    if (password.length < 6) {
      showToast('Password must be at least 6 characters', 'error')
      return
    }

    setSubmitting(true)
    try {
      await signUp(email, password, fullName)
      showToast('Account created! Check your email for confirmation.', 'success')
      navigate('/login', { replace: true })
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Sign up failed'
      showToast(message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const inputClass = "w-full bg-s2 border border-border rounded-lg px-3 py-2.5 text-[13px] text-text placeholder:text-muted/40 outline-none focus:border-blue/40 focus:ring-1 focus:ring-blue/15 transition-all"
  const labelClass = "block text-[11px] text-muted/60 uppercase tracking-wider font-semibold mb-1.5"

  return (
    <div className="flex items-center justify-center min-h-screen bg-bg px-4">
      <div className="w-full max-w-sm" style={{ animation: 'slideUp 0.3s ease-out' }}>
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-green/12 border border-green/15 mb-3">
            <span className="text-green font-bold text-base">OT</span>
          </div>
          <h1 className="text-lg font-semibold text-text">Create account</h1>
          <p className="text-muted text-xs mt-1">Join OrderTrack</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-s1 border border-border rounded-xl p-6 space-y-4"
        >
          <div>
            <label className={labelClass} htmlFor="fullName">Full name</label>
            <input
              id="fullName"
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="John Doe"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="confirmPassword">Confirm password</label>
            <input
              id="confirmPassword"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat your password"
              className={inputClass}
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-green hover:bg-green/90 text-white font-medium text-[13px] rounded-lg px-4 py-2.5 transition-all disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed mt-2"
          >
            {submitting ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <p className="text-center text-xs text-muted/60 mt-5">
          Already have an account?{' '}
          <Link to="/login" className="text-green hover:text-green/80 transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
