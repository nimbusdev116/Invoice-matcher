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

// ─── Zoho API Helper (with rate-limit-safe delays) ───────────────────────────

let lastZohoCall = 0
const ZOHO_MIN_DELAY_MS = 120

async function zohoGet(endpoint, params = {}) {
  const now = Date.now()
  const elapsed = now - lastZohoCall
  if (elapsed < ZOHO_MIN_DELAY_MS) {
    await new Promise(r => setTimeout(r, ZOHO_MIN_DELAY_MS - elapsed))
  }
  lastZohoCall = Date.now()

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

  if (res.status === 429) {
    if ((params._retryCount || 0) >= 3) {
      throw new Error('Zoho rate limit: max retries exceeded')
    }
    console.warn('Zoho rate limited, waiting 10s...')
    await new Promise(r => setTimeout(r, 10000))
    return zohoGet(endpoint, { ...params, _retryCount: (params._retryCount || 0) + 1 })
  }

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Zoho API error: ${res.status} ${text}`)
  }

  return res.json()
}

async function zohoGetParallel(items, fn, batchSize = 5) {
  const results = []
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    const batchResults = await Promise.allSettled(batch.map(fn))
    results.push(...batchResults)
    if (i + batchSize < items.length) {
      await new Promise(r => setTimeout(r, 200))
    }
  }
  return results
}

// ─── Classification ─────────────────────────────────────────────────────────

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

// ─── Zoho Status Mapping ────────────────────────────────────────────────────

function resolveStatusFromDetail(so) {
  const status = (so.status || '').toLowerCase()

  if (status === 'void' || status === 'cancelled') return { status: 'cancelled', invoiceId: null, invoiceNumber: null }
  if (status === 'fulfilled' || status === 'closed') return { status: 'delivered', invoiceId: null, invoiceNumber: null }
  if (status === 'draft' || status === 'awaiting_approval') return { status: 'pending', invoiceId: null, invoiceNumber: null }

  const invoices = so.invoices || []

  if (invoices.length === 0) {
    const invoicedStatus = (so.invoiced_status || '').toLowerCase()
    if (!invoicedStatus || invoicedStatus === 'not_invoiced') {
      return { status: 'processing', invoiceId: null, invoiceNumber: null }
    }
    return { status: 'processing', invoiceId: null, invoiceNumber: null }
  }

  for (const inv of invoices) {
    const invStatus = (inv.status || '').toLowerCase()
    if (['sent', 'viewed', 'overdue', 'paid', 'partially_paid'].includes(invStatus)) {
      return { status: 'shipped', invoiceId: inv.invoice_id, invoiceNumber: inv.invoice_number }
    }
  }

  const firstInv = invoices[0]
  return { status: 'awaiting_shipment', invoiceId: firstInv.invoice_id, invoiceNumber: firstInv.invoice_number }
}

function resolveStatusFromList(so) {
  const status = (so.status || '').toLowerCase()

  if (status === 'void' || status === 'cancelled') return { status: 'cancelled', invoiceId: null, invoiceNumber: null }
  if (status === 'fulfilled' || status === 'closed') return { status: 'delivered', invoiceId: null, invoiceNumber: null }
  if (status === 'draft' || status === 'awaiting_approval') return { status: 'pending', invoiceId: null, invoiceNumber: null }

  const invoicedStatus = (so.invoiced_status || '').toLowerCase()
  if (!invoicedStatus || invoicedStatus === 'not_invoiced') {
    return { status: 'processing', invoiceId: null, invoiceNumber: null }
  }

  return { status: 'needs_detail_check', invoiceId: null, invoiceNumber: null }
}

// ─── Auth middleware (checks Supabase JWT) ───────────────────────────────────

async function requireAuth(req, res, next) {
  if (!supabase) {
    return res.status(500).json({ error: 'Supabase not configured' })
  }
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization header' })
  }

  const token = authHeader.replace('Bearer ', '')
  try {
    const { data, error: authError } = await supabase.auth.getUser(token)
    const user = data?.user
    const error = authError
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' })
    }
    req.user = user
    next()
  } catch {
    return res.status(401).json({ error: 'Authentication failed' })
  }
}

// ─── Sync Endpoint ──────────────────────────────────────────────────────────

app.post('/api/zoho/sync', requireAuth, async (req, res) => {
  const TIMEOUT_MS = 55000
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    console.warn('Sync hit timeout guard at 55s, sending partial results')
  }, TIMEOUT_MS)

  try {
    if (!supabase) {
      clearTimeout(timer)
      return res.status(500).json({ error: 'Supabase not configured' })
    }
    if (!supabaseServiceKey) {
      clearTimeout(timer)
      return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY is required for sync' })
    }
    const missing = ['ZOHO_REFRESH_TOKEN', 'ZOHO_CLIENT_ID', 'ZOHO_CLIENT_SECRET', 'ZOHO_ORGANIZATION_ID', 'ZOHO_ACCOUNTS_DOMAIN']
      .filter(k => !process.env[k])
    if (missing.length) {
      clearTimeout(timer)
      return res.status(500).json({ error: `Missing env vars: ${missing.join(', ')}` })
    }

    const fullResync = req.query.full === 'true' || req.body?.full === true

    if (fullResync) {
      console.log('Full resync requested — resetting watermark to floor date')
      await setWatermark(SYNC_FLOOR)
    }

    const watermark = await getWatermark()
    const watermarkDate = new Date(watermark)
    const syncStartedAt = new Date().toISOString()
    console.log(`Sync starting. watermark=${watermark}, full=${fullResync}`)

    // ── Phase 1: Fetch new/modified SOs from Zoho ──

    let page = 1
    let hasMore = true
    let totalSynced = 0
    let totalSkipped = 0
    const errors = []
    const phase1CheckedIds = new Set()
    const needsDetailCheck = []

    const floorDate = SYNC_FLOOR.slice(0, 10)

    while (hasMore && !timedOut) {
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
        if (timedOut) break
        try {
          if (!fullResync) {
            const modTime = so.last_modified_time || so.created_time || ''
            if (modTime) {
              const modDate = new Date(modTime)
              if (!isNaN(modDate.getTime()) && modDate < watermarkDate) {
                totalSkipped++
                continue
              }
            }
          }

          const { source, channel } = classifySource(so.reference_number, so.customer_name)
          const listResult = resolveStatusFromList(so)

          let mappedStatus = listResult.status
          let invoiceId = listResult.invoiceId
          let invoiceNumber = listResult.invoiceNumber

          if (mappedStatus === 'needs_detail_check') {
            needsDetailCheck.push({ so, source, channel })
            continue
          }

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
            console.error('Upsert failed:', so.salesorder_number, error.message)
            errors.push(`${so.salesorder_number}: ${error.message}`)
          } else {
            totalSynced++
            phase1CheckedIds.add(so.salesorder_id)
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

    // ── Phase 1b: Batch-check SOs that need invoice detail ──

    if (needsDetailCheck.length > 0 && !timedOut) {
      console.log(`Phase 1b: Checking ${needsDetailCheck.length} SOs for invoice details (parallel batches of 5)`)
      const detailResults = await zohoGetParallel(needsDetailCheck, async ({ so, source, channel }) => {
        const detail = await zohoGet(`/salesorders/${so.salesorder_id}`)
        const detailSo = detail.salesorder || so
        const { status: mappedStatus, invoiceId, invoiceNumber } = resolveStatusFromDetail(detailSo)

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

        if (error) throw new Error(`${so.salesorder_number}: ${error.message}`)
        phase1CheckedIds.add(so.salesorder_id)
        return so.salesorder_number
      }, 5)

      for (const r of detailResults) {
        if (r.status === 'fulfilled') {
          totalSynced++
        } else {
          errors.push(r.reason?.message || 'Unknown detail check error')
        }
      }
    }

    if (errors.length === 0 && totalSynced > 0) {
      await setWatermark(syncStartedAt)
    }

    // ── Phase 2: Re-check active orders (parallel batches of 5, skip already-checked) ──

    let totalShipped = 0
    let totalAdvanced = 0
    let totalCancelled = 0

    if (!timedOut) {
      console.log('Phase 2: Re-checking active orders against Zoho...')
      const { data: activeOrders } = await supabase
        .from('orders')
        .select('id, so_number, zoho_so_id, status')
        .in('status', ['pending', 'processing', 'awaiting_shipment'])

      const ordersToCheck = (activeOrders || []).filter(o => o.zoho_so_id && !phase1CheckedIds.has(o.zoho_so_id))
      console.log(`Phase 2: ${ordersToCheck.length} orders to check (${(activeOrders || []).length} active, ${phase1CheckedIds.size} already checked in Phase 1)`)

      const phase2Results = await zohoGetParallel(ordersToCheck, async (order) => {
        const detail = await zohoGet(`/salesorders/${order.zoho_so_id}`)
        const so = detail.salesorder
        if (!so) return { action: 'skip', so_number: order.so_number }

        const { status: expectedStatus, invoiceId, invoiceNumber } = resolveStatusFromDetail(so)

        if (expectedStatus === order.status) return { action: 'match', so_number: order.so_number }

        const updates = { status: expectedStatus }
        if (invoiceId) {
          updates.zoho_invoice_id = invoiceId
          updates.zoho_invoice_number = invoiceNumber
        }

        const { error: updateErr } = await supabase.from('orders').update(updates).eq('id', order.id)
        if (updateErr) throw new Error(`${order.so_number}: ${updateErr.message}`)
        console.log(`  ${order.so_number}: ${order.status} → ${expectedStatus}`)
        return { action: expectedStatus, so_number: order.so_number, from: order.status }
      }, 5)

      for (const r of phase2Results) {
        if (r.status === 'fulfilled') {
          const v = r.value
          if (v.action === 'shipped') totalShipped++
          else if (v.action === 'cancelled') totalCancelled++
          else if (v.action !== 'match' && v.action !== 'skip') totalAdvanced++
        } else {
          const msg = r.reason?.message || 'Unknown phase 2 error'
          console.warn('Phase 2 error:', msg)
          errors.push(`recheck: ${msg}`)
        }
      }

      console.log(`Phase 2 done: ${totalShipped} shipped, ${totalAdvanced} advanced, ${totalCancelled} cancelled`)
    }

    clearTimeout(timer)

    await supabase.from('zoho_sync_log').insert({
      operation: 'fetch_orders',
      status: errors.length === 0 ? 'success' : errors.length < totalSynced ? 'partial' : 'error',
      records_affected: totalSynced + totalShipped + totalAdvanced + totalCancelled,
      error_message: errors.length > 0 ? errors.slice(0, 5).join('; ') : null,
      completed_at: new Date().toISOString(),
    }).catch(err => console.warn('Failed to log sync:', err.message))

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
      timedOut,
    })
  } catch (err) {
    clearTimeout(timer)
    if (timedOut) return
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

app.get('/api/zoho/audit', requireAuth, async (req, res) => {
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

    const auditResults = await zohoGetParallel(samples, async (order) => {
      if (!order.zoho_so_id) return { so_number: order.so_number, db_status: order.status, expected_status: 'no-zoho-id', match: null }
      const detail = await zohoGet(`/salesorders/${order.zoho_so_id}`)
      const so = detail.salesorder
      if (!so) return { so_number: order.so_number, db_status: order.status, expected_status: 'no-detail', match: false }

      const { status: expected } = resolveStatusFromDetail(so)
      const invoices = (so.invoices || []).map(inv => ({ number: inv.invoice_number, status: inv.status }))

      return {
        so_number: order.so_number,
        customer: order.customer_name,
        db_status: order.status,
        expected_status: expected,
        match: order.status === expected,
        zoho_so_status: (so.status || '').toLowerCase(),
        zoho_invoiced_status: (so.invoiced_status || '').toLowerCase(),
        invoice_count: invoices.length,
        invoices,
      }
    }, 5)

    for (const r of auditResults) {
      if (r.status === 'fulfilled') {
        results.push(r.value)
        if (r.value.expected_status && r.value.match !== null) {
          expectedBreakdown[r.value.expected_status] = (expectedBreakdown[r.value.expected_status] || 0) + 1
        }
      } else {
        results.push({ error: r.reason?.message || 'Unknown error', match: false })
      }
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
