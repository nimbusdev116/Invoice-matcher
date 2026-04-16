import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

console.log('Server starting...')
console.log('Node version:', process.version)
console.log('PORT env:', process.env.PORT)

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err)
  process.exit(1)
})
process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err)
})

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3000

app.use(cors())
app.use(express.json())

// Supabase admin client (uses service role key to bypass RLS for server operations)
const supabaseUrl = process.env.VITE_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || ''
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || ''
const supabaseKey = supabaseServiceKey || supabaseAnonKey
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null

if (!supabaseServiceKey && supabaseAnonKey) {
  console.warn('WARNING: SUPABASE_SERVICE_ROLE_KEY not set — using anon key. Zoho sync will fail due to RLS policies.')
}

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

function classifySource(referenceNumber, customerName) {
  const ref = (referenceNumber || '').trim().toUpperCase()
  const name = (customerName || '').toUpperCase()

  if (ref.startsWith('BWG') || name.includes('BWG')) {
    return { source: 'bwg_portal', channel: 'bwg' }
  }
  if (ref.startsWith('X')) return { source: 'musgrave_portal', channel: 'musgrave' }
  if (ref.startsWith('INV')) return { source: 'mirakl', channel: 'direct' }
  return { source: 'b2b_portal', channel: 'direct' }
}

// ─── Watermark Helpers ───────────────────────────────────────────────────────

const SYNC_FLOOR = '2026-04-01T00:00:00+00:00'

async function getWatermark() {
  if (!supabase) return SYNC_FLOOR
  const { data } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'zoho_last_sync_at')
    .single()
  let val = data?.value
  if (typeof val === 'string') {
    val = val.replace(/^"|"$/g, '')
    if (val.length > 4) return val
  }
  return SYNC_FLOOR
}

async function setWatermark(iso) {
  if (!supabase) return
  await supabase
    .from('app_settings')
    .upsert(
      { key: 'zoho_last_sync_at', value: iso, description: 'Last Zoho sync timestamp', is_sensitive: false },
      { onConflict: 'key' }
    )
}

// ─── Sync Endpoint (incremental) ─────────────────────────────────────────────

app.post('/api/zoho/sync', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Supabase not configured' })
    }
    if (!supabaseServiceKey) {
      return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY is required for sync' })
    }
    const missing = ['ZOHO_REFRESH_TOKEN', 'ZOHO_CLIENT_ID', 'ZOHO_CLIENT_SECRET', 'ZOHO_ORGANIZATION_ID', 'ZOHO_ACCOUNTS_DOMAIN']
      .filter(k => !process.env[k])
    if (missing.length) {
      return res.status(500).json({ error: `Missing env vars: ${missing.join(', ')}` })
    }

    const fullResync = req.query.full === 'true' || req.body?.full === true

    if (fullResync) {
      console.log('Full resync requested — resetting watermark to floor date')
      await setWatermark(SYNC_FLOOR)
    }

    const watermark = await getWatermark()
    const syncStartedAt = new Date().toISOString()
    console.log(`Sync starting. watermark=${watermark}, full=${fullResync}`)

    let page = 1
    let hasMore = true
    let totalSynced = 0
    let totalSkipped = 0
    const errors = []

    const floorDate = SYNC_FLOOR.slice(0, 10)

    while (hasMore) {
      const params = {
        sort_column: 'last_modified_time',
        sort_order: 'A',
        per_page: 200,
        page,
        date_start: floorDate,
      }

      console.log(`Fetching Zoho SO page ${page}`)
      const data = await zohoGet('/salesorders', params)

      const salesOrders = data.salesorders || []
      console.log(`Got ${salesOrders.length} sales orders on page ${page}`)
      if (salesOrders.length === 0) break

      for (const so of salesOrders) {
        try {
          if (!fullResync) {
            const modTime = so.last_modified_time || so.created_time || ''
            if (modTime && modTime < watermark) {
              totalSkipped++
              continue
            }
          }

          console.log(`SO ${so.salesorder_number}: zoho_status=${so.status}, date=${so.date}, ref=${so.reference_number}, customer=${so.customer_name}`)

          const { source, channel } = classifySource(so.reference_number, so.customer_name)
          const { status: mappedStatus, invoiceId, invoiceNumber } = await resolveOrderStatus(so)
          console.log(`  → status=${mappedStatus}, channel=${channel}${invoiceId ? ', inv=' + invoiceNumber : ''}`)

          const zohoDate = so.date || so.created_time || ''
          let orderCreatedAt
          if (zohoDate) {
            const parsed = new Date(zohoDate)
            orderCreatedAt = isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString()
          } else {
            orderCreatedAt = new Date().toISOString()
          }

          const orderData = {
            so_number: so.salesorder_number,
            zoho_so_id: so.salesorder_id,
            zoho_invoice_id: invoiceId,
            zoho_invoice_number: invoiceNumber,
            reference_number: so.reference_number || null,
            customer_name: so.customer_name,
            customer_email: so.email || null,
            source,
            channel,
            status: mappedStatus,
            value: parseFloat(so.total) || 0,
            currency: so.currency_code || 'EUR',
            notes: so.notes || null,
            created_at: orderCreatedAt,
          }

          const { error } = await supabase
            .from('orders')
            .upsert(orderData, { onConflict: 'so_number' })

          if (error) {
            console.error('Upsert failed:', so.salesorder_number, error.message, error.details)
            errors.push(`${so.salesorder_number}: ${error.message}`)
          } else {
            totalSynced++
          }
        } catch (err) {
          console.error('Order error:', so.salesorder_number, err.message)
          errors.push(`${so.salesorder_number}: ${err.message}`)
        }
      }

      hasMore = data.page_context?.has_more_page ?? false
      page++
      if (page > 50) break
    }

    if (errors.length === 0 || totalSynced > 0) {
      await setWatermark(syncStartedAt)
    }

    await supabase.from('zoho_sync_log').insert({
      operation: 'fetch_orders',
      status: errors.length === 0 ? 'success' : errors.length < totalSynced ? 'partial' : 'error',
      records_affected: totalSynced,
      error_message: errors.length > 0 ? errors.slice(0, 5).join('; ') : null,
      completed_at: new Date().toISOString(),
    })

    console.log(`Sync done: synced=${totalSynced}, skipped=${totalSkipped}, errors=${errors.length}`)

    res.json({
      success: true,
      synced: totalSynced,
      skipped: totalSkipped,
      watermark,
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

function mapZohoSOStatus(zohoStatus) {
  if (zohoStatus === 'void' || zohoStatus === 'cancelled') return 'cancelled'
  if (zohoStatus === 'fulfilled' || zohoStatus === 'closed') return 'delivered'
  if (zohoStatus === 'confirmed') return 'awaiting_shipment'
  if (zohoStatus === 'open') return 'processing'
  if (zohoStatus === 'draft' || zohoStatus === 'awaiting_approval') return 'pending'
  console.warn('Unmapped Zoho SO status:', zohoStatus)
  return 'pending'
}

async function resolveOrderStatus(so) {
  const baseStatus = mapZohoSOStatus(so.status)
  if (baseStatus === 'awaiting_shipment' || baseStatus === 'processing') {
    try {
      const invoiceData = await zohoGet('/invoices', {
        salesorder_id: so.salesorder_id,
        per_page: 5,
      })
      const invoices = invoiceData.invoices || []
      for (const inv of invoices) {
        if (inv.status === 'sent' || inv.status === 'overdue' || inv.status === 'paid') {
          return { status: 'shipped', invoiceId: inv.invoice_id, invoiceNumber: inv.invoice_number }
        }
      }
    } catch (err) {
      console.warn(`Invoice lookup failed for ${so.salesorder_number}:`, err.message)
    }
  }
  return { status: baseStatus, invoiceId: null, invoiceNumber: null }
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

// ─── Health Check ───────────────────────────────────────────────────────────

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// ─── Static Files (SPA) ─────────────────────────────────────────────────────

app.use(express.static(path.join(__dirname, 'dist')))
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'))
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`)
  console.log(`Supabase configured: ${!!supabase}`)
  console.log(`Zoho env vars: REFRESH_TOKEN=${!!process.env.ZOHO_REFRESH_TOKEN}, CLIENT_ID=${!!process.env.ZOHO_CLIENT_ID}, ORG_ID=${!!process.env.ZOHO_ORGANIZATION_ID}`)
})
