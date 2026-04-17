const API_BASE = import.meta.env.DEV ? 'http://localhost:3000' : ''

export async function zohoSync(opts?: { full?: boolean }): Promise<{
  success: boolean
  synced: number
  skipped?: number
  shipped?: number
  errors: string[]
}> {
  const url = opts?.full
    ? `${API_BASE}/api/zoho/sync?full=true`
    : `${API_BASE}/api/zoho/sync`
  const res = await fetch(url, { method: 'POST' })
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
  return res.json()
}
