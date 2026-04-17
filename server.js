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

          console.log(`SO ${so.salesorder_number}: status=${so.status}, order_status=${so.order_status}, invoiced=${so.invoiced_status}, shipped=${so.shipped_status}, date=${so.date}, ref=${so.reference_number}, customer=${so.customer_name}`)

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

    // ── Phase 2: Re-check ALL active orders (pending + processing + awaiting_shipment) ──
    let totalShipped = 0
    let totalAdvanced = 0
    let totalCancelled = 0
    console.log('Phase 2: Re-checking all active orders against Zoho...')
    const { data: activeOrders } = await supabase
      .from('orders')
      .select('id, so_number, zoho_so_id, status')
      .in('status', ['pending', 'processing', 'awaiting_shipment'])

    for (const order of activeOrders || []) {
      if (!order.zoho_so_id) continue
      try {
        const detail = await zohoGet(`/salesorders/${order.zoho_so_id}`)
        const so = detail.salesorder
        if (!so) { console.warn(`  ${order.so_number}: no SO detail returned`); continue }

        const soStatus = (so.status || '').toLowerCase()
        console.log(`  ${order.so_number} (db=${order.status}): zoho_status=${soStatus}, invoiced=${so.invoiced_status}`)

        // Cancelled/void in Zoho → cancel in our system
        if (soStatus === 'void' || soStatus === 'cancelled') {
          if (order.status !== 'cancelled') {
            await supabase.from('orders').update({ status: 'cancelled' }).eq('id', order.id)
            console.log(`    → cancelled (SO ${soStatus} in Zoho)`)
            totalCancelled++
          }
          continue
        }

        // Fulfilled/closed in Zoho → delivered
        if (soStatus === 'fulfilled' || soStatus === 'closed') {
          if (order.status !== 'delivered') {
            await supabase.from('orders').update({ status: 'delivered' }).eq('id', order.id)
            console.log(`    → delivered (SO ${soStatus} in Zoho)`)
            totalAdvanced++
          }
          continue
        }

        // Still draft → stay pending
        if (soStatus === 'draft' || soStatus === 'awaiting_approval') {
          if (order.status !== 'pending') {
            await supabase.from('orders').update({ status: 'pending' }).eq('id', order.id)
            console.log(`    → pending (SO still draft)`)
          }
          continue
        }

        // SO is active (open/confirmed) — check invoices
        const invoices = so.invoices || []
        console.log(`    ${invoices.length} invoice(s) linked`)

        if (invoices.length === 0) {
          // No invoice → processing
          if (order.status !== 'processing') {
            await supabase.from('orders').update({ status: 'processing' }).eq('id', order.id)
            console.log(`    → processing (no invoices)`)
            totalAdvanced++
          }
          continue
        }

        // Check if any invoice is sent
        let shipped = false
        for (const inv of invoices) {
          const invStatus = (inv.status || '').toLowerCase()
          console.log(`    inv ${inv.invoice_number}: status=${invStatus}`)
          if (['sent', 'viewed', 'overdue', 'paid', 'partially_paid'].includes(invStatus)) {
            await supabase.from('orders').update({
              status: 'shipped',
              zoho_invoice_id: inv.invoice_id,
              zoho_invoice_number: inv.invoice_number,
            }).eq('id', order.id)
            console.log(`    → shipped`)
            totalShipped++
            shipped = true
            break
          }
        }

        // Invoice exists but not sent → awaiting_shipment
        if (!shipped && order.status !== 'awaiting_shipment') {
          const firstInv = invoices[0]
          await supabase.from('orders').update({
            status: 'awaiting_shipment',
            zoho_invoice_id: firstInv.invoice_id,
            zoho_invoice_number: firstInv.invoice_number,
          }).eq('id', order.id)
          console.log(`    → awaiting_shipment (invoice exists but not sent)`)
          totalAdvanced++
        }
      } catch (err) {
        console.warn(`  Re-check failed for ${order.so_number}:`, err.message)
        errors.push(`recheck ${order.so_number}: ${err.message}`)
      }
    }
    console.log(`Phase 2 done: ${totalShipped} shipped, ${totalAdvanced} advanced, ${totalCancelled} cancelled, out of ${(activeOrders || []).length} checked`)

    await supabase.from('zoho_sync_log').insert({
      operation: 'fetch_orders',
      status: errors.length === 0 ? 'success' : errors.length < totalSynced ? 'partial' : 'error',
      records_affected: totalSynced + totalShipped + totalAdvanced + totalCancelled,
      error_message: errors.length > 0 ? errors.slice(0, 5).join('; ') : null,
      completed_at: new Date().toISOString(),
    })

    console.log(`Sync done: synced=${totalSynced}, skipped=${totalSkipped}, shipped=${totalShipped}, advanced=${totalAdvanced}, cancelled=${totalCancelled}, errors=${errors.length}`)

    res.json({
      success: true,
      synced: totalSynced,
      skipped: totalSkipped,
      shipped: totalShipped,
      advanced: totalAdvanced,
      cancelled: totalCancelled,
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

// ─── Audit Endpoint ──────────────────────────────────────────────────────────

app.get('/api/zoho/audit', async (req, res) => {
  const TIMEOUT_MS = 25000
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    res.status(504).json({ error: 'Audit timed out. Try fewer orders: ?limit=5&status=pending' })
  }, TIMEOUT_MS)

  try {
    if (!supabase) { clearTimeout(timer); return res.status(500).json({ error: 'Supabase not configured' }) }
    if (!process.env.ZOHO_REFRESH_TOKEN) { clearTimeout(timer); return res.status(500).json({ error: 'Zoho not configured' }) }

    const perStatus = Math.min(parseInt(req.query.limit || '10', 10), 25)
    const statusFilter = req.query.status || 'pending,processing,awaiting_shipment'
    const statuses = statusFilter.split(',').map(s => s.trim())

    const { data: allOrders } = await supabase
      .from('orders')
      .select('status')
      .in('status', statuses)
    const dbBreakdown = {}
    for (const o of allOrders || []) dbBreakdown[o.status] = (dbBreakdown[o.status] || 0) + 1

    if (timedOut) return

    const samples = []
    for (const s of statuses) {
      const { data } = await supabase
        .from('orders')
        .select('id, so_number, zoho_so_id, status, created_at, customer_name')
        .eq('status', s)
        .order('created_at', { ascending: true })
        .limit(perStatus)
      if (data) samples.push(...data)
    }

    console.log(`Audit: checking ${samples.length} sampled orders (${perStatus}/status)`)

    const results = []
    const expectedBreakdown = {}
    for (let i = 0; i < samples.length; i += 10) {
      if (timedOut) break
      const batch = samples.slice(i, i + 10)
      const batchResults = await Promise.all(batch.map(async (order) => {
        if (!order.zoho_so_id) return { so_number: order.so_number, db_status: order.status, expected_status: 'no-zoho-id', match: null }
        try {
          const detail = await zohoGet(`/salesorders/${order.zoho_so_id}`)
          const so = detail.salesorder
          if (!so) return { so_number: order.so_number, db_status: order.status, expected_status: 'no-detail', match: false }

          const soStatus = (so.status || '').toLowerCase()
          const invoicedStatus = (so.invoiced_status || '').toLowerCase()
          const invoices = (so.invoices || []).map(inv => ({ number: inv.invoice_number, status: inv.status }))

          let expected
          if (soStatus === 'void' || soStatus === 'cancelled') expected = 'cancelled'
          else if (soStatus === 'fulfilled' || soStatus === 'closed') expected = 'delivered'
          else if (soStatus === 'draft' || soStatus === 'awaiting_approval') expected = 'pending'
          else if (invoices.length === 0) expected = 'processing'
          else {
            const sent = invoices.find(inv => ['sent','viewed','overdue','paid','partially_paid'].includes((inv.status||'').toLowerCase()))
            expected = sent ? 'shipped' : 'awaiting_shipment'
          }

          expectedBreakdown[expected] = (expectedBreakdown[expected] || 0) + 1
          const match = order.status === expected
          return { so_number: order.so_number, customer: order.customer_name, db_status: order.status, expected_status: expected, match, zoho_so_status: soStatus, zoho_invoiced_status: invoicedStatus, invoice_count: invoices.length, invoices }
        } catch (err) {
          return { so_number: order.so_number, db_status: order.status, expected_status: `error: ${err.message}`, match: false }
        }
      }))
      results.push(...batchResults)
    }

    if (timedOut) return
    clearTimeout(timer)

    const mismatches = results.filter(r => r.match === false)
    const matches = results.filter(r => r.match === true)

    res.json({
      total_in_db: dbBreakdown,
      sampled: results.length,
      matches: matches.length,
      mismatches: mismatches.length,
      expected_breakdown_of_sample: expectedBreakdown,
      mismatch_details: mismatches,
      note: `Sampled ${perStatus} per status (max 25). Use ?limit=25&status=pending to focus.`,
    })
  } catch (err) {
    if (timedOut) return
    clearTimeout(timer)
    console.error('Audit error:', err)
    res.status(500).json({ error: err.message })
  }
})

// ─── Zoho Status Mapping ─────────────────────────────────────────────────────

async function resolveOrderStatus(so) {
  const status = (so.status || '').toLowerCase()

  if (status === 'void' || status === 'cancelled') return { status: 'cancelled', invoiceId: null, invoiceNumber: null }
  if (status === 'fulfilled' || status === 'closed') return { status: 'delivered', invoiceId: null, invoiceNumber: null }
  if (status === 'draft' || status === 'awaiting_approval') return { status: 'pending', invoiceId: null, invoiceNumber: null }

  // SO is active (open/confirmed) — check invoices to determine processing vs awaiting_shipment vs shipped
  const invoicedStatus = (so.invoiced_status || '').toLowerCase()

  if (!invoicedStatus || invoicedStatus === 'not_invoiced') {
    return { status: 'processing', invoiceId: null, invoiceNumber: null }
  }

  // Invoice exists — fetch SO detail to check individual invoice statuses
  try {
    const detail = await zohoGet(`/salesorders/${so.salesorder_id}`)
    const invoices = detail.salesorder?.invoices || []
    console.log(`  invoice lookup for ${so.salesorder_number}: found ${invoices.length} invoice(s)`)

    if (invoices.length === 0) {
      return { status: 'processing', invoiceId: null, invoiceNumber: null }
    }

    for (const inv of invoices) {
      const invStatus = (inv.status || '').toLowerCase()
      console.log(`    inv ${inv.invoice_number}: status=${invStatus}`)
      if (['sent', 'viewed', 'overdue', 'paid', 'partially_paid'].includes(invStatus)) {
        return { status: 'shipped', invoiceId: inv.invoice_id, invoiceNumber: inv.invoice_number }
      }
    }

    // Invoice exists but not yet sent → awaiting_shipment
    const firstInv = invoices[0]
    return { status: 'awaiting_shipment', invoiceId: firstInv.invoice_id, invoiceNumber: firstInv.invoice_number }
  } catch (err) {
    console.warn(`Invoice lookup failed for ${so.salesorder_number}:`, err.message)
    return { status: 'processing', invoiceId: null, invoiceNumber: null }
  }
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
