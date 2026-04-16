const API_BASE = import.meta.env.DEV ? 'http://localhost:3000' : ''

export async function zohoSync(): Promise<{
  success: boolean
  synced: number
  errors: string[]
}> {
  const res = await fetch(`${API_BASE}/api/zoho/sync`, { method: 'POST' })
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
