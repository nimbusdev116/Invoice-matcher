import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

// Load .env
const env = readFileSync('.env', 'utf8')
for (const line of env.split('\n')) {
  const [k, ...v] = line.split('=')
  if (k && v.length) process.env[k.trim()] = v.join('=').trim()
}

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

// ── Zoho auth ──
let cachedToken = null, tokenExpiresAt = 0
async function getToken() {
  if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken
  const params = new URLSearchParams({
    refresh_token: process.env.ZOHO_REFRESH_TOKEN,
    client_id: process.env.ZOHO_CLIENT_ID,
    client_secret: process.env.ZOHO_CLIENT_SECRET,
    grant_type: 'refresh_token',
  })
  const res = await fetch(`${process.env.ZOHO_ACCOUNTS_DOMAIN}/oauth/v2/token?${params}`, { method: 'POST' })
  const data = await res.json()
  if (data.error) throw new Error(`Token error: ${data.error}`)
  cachedToken = data.access_token
  tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000
  return cachedToken
}

async function zohoGet(path, params = {}) {
  const token = await getToken()
  const url = new URL(`https://www.zohoapis.eu/books/v3${path}`)
  url.searchParams.set('organization_id', process.env.ZOHO_ORGANIZATION_ID)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v))
  const res = await fetch(url.toString(), { headers: { Authorization: `Zoho-oauthtoken ${token}` } })
  if (!res.ok) throw new Error(`Zoho ${res.status}: ${await res.text()}`)
  return res.json()
}

// ── Audit ──
const { data: orders, error: dbErr } = await supabase
  .from('orders')
  .select('id, so_number, zoho_so_id, status, created_at, customer_name, value')
  .in('status', ['pending', 'processing', 'awaiting_shipment'])
  .order('created_at', { ascending: true })

if (dbErr) { console.error('Supabase error:', dbErr); process.exit(1) }
if (!orders) { console.error('No data returned from Supabase'); process.exit(1) }
console.log(`\nFound ${orders.length} active orders in DB`)
console.log('DB breakdown:', orders.reduce((a, o) => { a[o.status] = (a[o.status]||0)+1; return a }, {}))
console.log('\nChecking each against Zoho...\n')

const results = { matches: 0, mismatches: 0, errors: 0 }
const expectedBreakdown = {}
const mismatches = []

for (const order of orders) {
  if (!order.zoho_so_id) {
    console.log(`  SKIP ${order.so_number}: no zoho_so_id`)
    continue
  }
  try {
    const detail = await zohoGet(`/salesorders/${order.zoho_so_id}`)
    const so = detail.salesorder
    if (!so) { console.log(`  ERROR ${order.so_number}: no detail`); results.errors++; continue }

    const soStatus = (so.status || '').toLowerCase()
    const invoicedStatus = (so.invoiced_status || '').toLowerCase()
    const orderStatus = (so.order_status || '').toLowerCase()
    const invoices = (so.invoices || [])

    let expected
    if (soStatus === 'void' || soStatus === 'cancelled') expected = 'cancelled'
    else if (soStatus === 'fulfilled' || soStatus === 'closed') expected = 'delivered'
    else if (soStatus === 'draft' || soStatus === 'awaiting_approval') expected = 'pending'
    else if (invoices.length === 0) expected = 'processing'
    else {
      const sent = invoices.find(i => ['sent','viewed','overdue','paid','partially_paid'].includes((i.status||'').toLowerCase()))
      expected = sent ? 'shipped' : 'awaiting_shipment'
    }

    expectedBreakdown[expected] = (expectedBreakdown[expected]||0) + 1
    const match = order.status === expected

    if (!match) {
      results.mismatches++
      const invSummary = invoices.map(i => `${i.invoice_number}(${i.status})`).join(', ')
      mismatches.push({ so: order.so_number, customer: order.customer_name, db: order.status, expected, zoho_so_status: soStatus, zoho_order_status: orderStatus, invoiced_status: invoicedStatus, invoices: invSummary || 'none' })
      console.log(`  MISMATCH ${order.so_number} | DB=${order.status} → SHOULD BE=${expected} | zoho_status=${soStatus} order_status=${orderStatus} invoiced=${invoicedStatus} | invoices=[${invSummary||'none'}]`)
    } else {
      results.matches++
    }
  } catch (err) {
    results.errors++
    console.log(`  ERROR ${order.so_number}: ${err.message}`)
  }
}

console.log('\n════════════════════════════════════════')
console.log('AUDIT SUMMARY')
console.log('════════════════════════════════════════')
console.log(`Total checked : ${orders.length}`)
console.log(`✓ Correct     : ${results.matches}`)
console.log(`✗ Wrong status: ${results.mismatches}`)
console.log(`⚠ Errors      : ${results.errors}`)
console.log('\nDB breakdown:', orders.reduce((a, o) => { a[o.status] = (a[o.status]||0)+1; return a }, {}))
console.log('Expected     :', expectedBreakdown)

if (mismatches.length > 0) {
  console.log('\nMISMATCH BREAKDOWN:')
  const byCombo = {}
  for (const m of mismatches) {
    const key = `${m.db} → ${m.expected}`
    if (!byCombo[key]) byCombo[key] = []
    byCombo[key].push(m.so)
  }
  for (const [combo, sos] of Object.entries(byCombo)) {
    console.log(`  ${combo}: ${sos.length} orders (${sos.slice(0,5).join(', ')}${sos.length>5?'...':''})`)
  }
}
