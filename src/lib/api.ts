import { supabase } from './supabase'

const API_BASE = import.meta.env.DEV ? 'http://localhost:3000' : ''

async function authHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) {
    throw new Error('Not authenticated — please sign in again')
  }
  return {
    Authorization: `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  }
}

export async function zohoSync(opts?: { full?: boolean }): Promise<{
  success: boolean
  synced: number
  skipped?: number
  shipped?: number
  advanced?: number
  cancelled?: number
  errors: string[]
}> {
  const url = opts?.full
    ? `${API_BASE}/api/zoho/sync?full=true`
    : `${API_BASE}/api/zoho/sync`
  const headers = await authHeaders()
  const res = await fetch(url, { method: 'POST', headers })
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'Sync failed' }))
    throw new Error(data.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function zohoTestConnection(): Promise<{
  connected: boolean
  organization?: string
  error?: string
}> {
  const res = await fetch(`${API_BASE}/api/zoho/test`)
  if (!res.ok) {
    return { connected: false, error: `HTTP ${res.status}` }
  }
  return res.json()
}

export async function zohoAudit(opts?: { limit?: number; status?: string }): Promise<unknown> {
  const params = new URLSearchParams()
  if (opts?.limit) params.set('limit', String(opts.limit))
  if (opts?.status) params.set('status', opts.status)
  const qs = params.toString() ? `?${params}` : ''
  const headers = await authHeaders()
  const res = await fetch(`${API_BASE}/api/zoho/audit${qs}`, { headers })
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'Audit failed' }))
    throw new Error(data.error || `HTTP ${res.status}`)
  }
  return res.json()
}
