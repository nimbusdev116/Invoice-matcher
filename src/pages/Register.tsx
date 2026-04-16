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

  return (
    <div className="flex items-center justify-center min-h-screen bg-bg px-4">
      <div className="w-full max-w-sm">
        {/* Logo / title */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center justify-center w-11 h-11 rounded-lg bg-green/15 mb-3">
            <span className="text-green font-bold text-lg">OT</span>
          </div>
          <h1 className="text-xl font-semibold text-text">Create account</h1>
          <p className="text-muted text-sm mt-1">Join OrderTrack</p>
        </div>

        {/* Card */}
        <form
          onSubmit={handleSubmit}
          className="bg-s1 border border-border rounded-lg p-6 space-y-4"
        >
          {/* Full name */}
          <div>
            <label className="block text-sm text-muted mb-1.5" htmlFor="fullName">
              Full name
            </label>
            <input
              id="fullName"
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="John Doe"
              className="w-full bg-s2 border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-muted/50 outline-none focus:border-green transition-colors"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm text-muted mb-1.5" htmlFor="email">
              Email address
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="w-full bg-s2 border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-muted/50 outline-none focus:border-green transition-colors"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm text-muted mb-1.5" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              className="w-full bg-s2 border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-muted/50 outline-none focus:border-green transition-colors"
            />
          </div>

          {/* Confirm password */}
          <div>
            <label className="block text-sm text-muted mb-1.5" htmlFor="confirmPassword">
              Confirm password
            </label>
            <input
              id="confirmPassword"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat your password"
              className="w-full bg-s2 border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-muted/50 outline-none focus:border-green transition-colors"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-green hover:bg-green/90 text-white font-medium text-sm rounded-lg px-4 py-2.5 transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
          >
            {submitting ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        {/* Link to login */}
        <p className="text-center text-sm text-muted mt-5">
          Already have an account?{' '}
          <Link to="/login" className="text-green hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
