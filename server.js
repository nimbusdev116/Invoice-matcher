import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3000

app.use(cors())
app.use(express.json())

// Supabase admin client (uses service role key if available, otherwise anon key)
const supabaseUrl = process.env.VITE_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null

// ─── Zoho OAuth Token ────────────────────────────────────────────────────────

let cachedToken = null
let tokenExpiresAt = 0

async function getZohoAccessToken() {
  if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken

  const params = new URLSearchParams({
    refresh_token: process.env.ZOHO_REFRESH_TOKEN,
    client_id: process.env.ZOHO_CLIENT_ID,
    client_secret: process.env.ZOHO_CLIENT_SECRET,
    grant_type: 'refresh_token',
  })

  const res = await fetch(
    `${process.env.ZOHO_ACCOUNTS_DOMAIN}/oauth/v2/token?${params}`,
    { method: 'POST' }
  )

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Zoho token refresh failed: ${res.status} ${text}`)
  }

  const data = await res.json()
  if (data.error) throw new Error(`Zoho token error: ${data.error}`)

  cachedToken = data.access_token
  tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000
  return cachedToken
}

// ─── Zoho API Helper ─────────────────────────────────────────────────────────

async function zohoGet(endpoint, params = {}) {
  const token = await getZohoAccessToken()
  const orgId = process.env.ZOHO_ORGANIZATION_ID

  const url = new URL(`https://www.zohoapis.eu/books/v3${endpoint}`)
  url.searchParams.set('organization_id', orgId)
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v))
  }

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Zoho-oauthtoken ${token}` },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Zoho API error: ${res.status} ${text}`)
  }

  return res.json()
}

// ─── Classification (matches frontend classifySource) ────────────────────────

function classifySource(referenceNumber) {
  if (!referenceNumber || referenceNumber.trim() === '') {
    return { source: 'manual', channel: 'offline' }
  }
  const ref = referenceNumber.toUpperCase()
  if (ref.startsWith('BWG')) return { source: 'bwg_portal', channel: 'bwg' }
  if (ref.startsWith('X')) return { source: 'musgrave_portal', channel: 'musgrave' }
  if (ref.startsWith('INV')) return { source: 'mirakl', channel: 'musgrave' }
  return { source: 'b2b_portal', channel: 'direct' }
}

// ─── Sync Endpoint ───────────────────────────────────────────────────────────

app.post('/api/zoho/sync', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Supabase not configured (missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY)' })
    }
    const missing = ['ZOHO_REFRESH_TOKEN', 'ZOHO_CLIENT_ID', 'ZOHO_CLIENT_SECRET', 'ZOHO_ORGANIZATION_ID', 'ZOHO_ACCOUNTS_DOMAIN']
      .filter(k => !process.env[k])
    if (missing.length) {
      return res.status(500).json({ error: `Missing env vars: ${missing.join(', ')}` })
    }

    let page = 1
    let hasMore = true
    let totalSynced = 0
    let totalSkipped = 0
    const errors = []

    while (hasMore) {
      const data = await zohoGet('/salesorders', {
        sort_column: 'last_modified_time',
        sort_order: 'D',
        per_page: 200,
        page,
      })

      const salesOrders = data.salesorders || []
      if (salesOrders.length === 0) break

      for (const so of salesOrders) {
        try {
          const { source, channel } = classifySource(so.reference_number)
          const isCourier = false // will be set when fulfillment method is assigned

          const orderData = {
            so_number: so.salesorder_number,
            zoho_so_id: so.salesorder_id,
            reference_number: so.reference_number || null,
            customer_name: so.customer_name,
            customer_email: so.email || null,
            source,
            channel,
            status: mapZohoStatus(so.order_status, so.status),
            value: parseFloat(so.total) || 0,
            currency: so.currency_code || 'EUR',
            notes: so.notes || null,
            pod_required: isCourier,
            pod_received: false,
          }

          const { error } = await supabase
            .from('orders')
            .upsert(orderData, { onConflict: 'so_number' })

          if (error) {
            errors.push(`${so.salesorder_number}: ${error.message}`)
          } else {
            totalSynced++
          }
        } catch (err) {
          errors.push(`${so.salesorder_number}: ${err.message}`)
        }
      }

      hasMore = data.page_context?.has_more_page ?? false
      page++

      // Safety limit
      if (page > 20) break
    }

    // Log the sync
    await supabase?.from('zoho_sync_log').insert({
      operation: 'fetch_orders',
      status: errors.length === 0 ? 'success' : errors.length < totalSynced ? 'partial' : 'error',
      records_affected: totalSynced,
      error_message: errors.length > 0 ? errors.slice(0, 5).join('; ') : null,
      completed_at: new Date().toISOString(),
    })

    res.json({
      success: true,
      synced: totalSynced,
      skipped: totalSkipped,
      errors: errors.slice(0, 10),
    })
  } catch (err) {
    console.error('Zoho sync error:', err)

    await supabase?.from('zoho_sync_log').insert({
      operation: 'fetch_orders',
      status: 'error',
      error_message: err.message,
      completed_at: new Date().toISOString(),
    }).catch(() => {})

    res.status(500).json({ error: err.message })
  }
})

// ─── Zoho Status Mapping ─────────────────────────────────────────────────────

function mapZohoStatus(orderStatus, zohoStatus) {
  if (zohoStatus === 'void' || zohoStatus === 'cancelled') return 'cancelled'
  if (orderStatus === 'delivered' || zohoStatus === 'fulfilled') return 'delivered'
  if (orderStatus === 'shipped' || zohoStatus === 'shipped') return 'shipped'
  if (zohoStatus === 'confirmed' || zohoStatus === 'open') return 'processing'
  if (zohoStatus === 'draft') return 'pending'
  return 'pending'
}

// ─── Zoho Connection Test ────────────────────────────────────────────────────

app.get('/api/zoho/test', async (req, res) => {
  try {
    const token = await getZohoAccessToken()
    const orgId = process.env.ZOHO_ORGANIZATION_ID
    const testRes = await fetch(
      `https://www.zohoapis.eu/books/v3/organizations?organization_id=${orgId}`,
      { headers: { Authorization: `Zoho-oauthtoken ${token}` } }
    )
    const data = await testRes.json()
    if (data.code === 0) {
      const org = data.organizations?.[0]
      res.json({ connected: true, organization: org?.name || 'Connected' })
    } else {
      res.json({ connected: false, error: data.message })
    }
  } catch (err) {
    res.json({ connected: false, error: err.message })
  }
})

// ─── Static Files (SPA) ─────────────────────────────────────────────────────

app.use(express.static(path.join(__dirname, 'dist')))
app.get('{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'))
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`)
})
