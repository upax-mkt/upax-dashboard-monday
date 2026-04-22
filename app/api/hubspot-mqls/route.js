import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'


// Etiquetas legibles para hs_analytics_source
const SOURCE_LABELS = {
  PAID_SEARCH: 'Paid Search',
  PAID_SOCIAL: 'Paid Social',
  ORGANIC_SEARCH: 'Organic Search',
  SOCIAL_MEDIA: 'Redes Organicas',
  OFFLINE: 'Offline / SDR',
  DIRECT_TRAFFIC: 'Direct Traffic',
  REFERRALS: 'Referral',
  EMAIL_MARKETING: 'Email Marketing',
  OTHER_CAMPAIGNS: 'Otras Campanas',
  AI_REFERRALS: 'AI / ChatGPT',
}

// --- Upstash REST cache helpers (sin @vercel/kv) ---
async function upstashGet(key) {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  try {
    const res = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
    })
    if (!res.ok) return null
    const data = await res.json()
    const raw = data.result
    if (!raw) return null
    return typeof raw === 'string' ? JSON.parse(raw) : raw
  } catch { return null }
}

async function upstashSet(key, value, ttlSeconds) {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return
  try {
    const serialized = JSON.stringify(value)
    await fetch(
      `${url}/set/${encodeURIComponent(key)}/${encodeURIComponent(serialized)}/ex/${ttlSeconds}`,
      { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }
    )
  } catch (e) { console.error('Cache set error:', e.message) }
}

// --- HubSpot search with pagination ---
async function hubspotSearchAll(token, filters, properties) {
  const results = []
  let after = undefined
  const MAX_PAGES = 20 // safety limit: 20 * 100 = 2000 contacts max

  for (let page = 0; page < MAX_PAGES; page++) {
    const body = {
      filterGroups: [{ filters }],
      properties,
      sorts: [{ propertyName: 'fecha_mql', direction: 'DESCENDING' }],
      limit: 100,
    }
    if (after) body.after = after

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)
    let res
    try {
      res = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
        cache: 'no-store',
        signal: controller.signal,
      })
    } catch (fetchErr) {
      clearTimeout(timer)
      if (fetchErr.name === 'AbortError') throw new Error('HubSpot timeout (8s)')
      throw fetchErr
    }
    clearTimeout(timer)

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`HubSpot ${res.status}: ${text.slice(0, 300)}`)
    }

    const data = await res.json()
    results.push(...(data.results || []))

    if (data.paging?.next?.after) {
      after = data.paging.next.after
    } else {
      break
    }
  }

  return results
}

// --- Aggregation logic ---
function aggregateByOrigin(contacts) {
  const counts = {}
  const macroInbound = { inbound: 0, outbound: 0, unknown: 0 }

  for (const c of contacts) {
    const props = c.properties || {}

    // MACRO: fuente_mql binario
    const macro = (props.fuente_mql || '').toLowerCase()
    if (macro === 'inbound') macroInbound.inbound++
    else if (macro === 'outbound') macroInbound.outbound++
    else macroInbound.unknown++

    // GRANULAR: fuente_conversion primero, fallback a hs_analytics_source
    let label
    const fc = props.fuente_conversion
    if (fc && fc.trim() !== '' && fc !== 'N/A') {
      label = fc.trim()
    } else {
      const raw = props.hs_analytics_source || 'UNKNOWN'
      label = SOURCE_LABELS[raw] || raw
    }
    counts[label] = (counts[label] || 0) + 1
  }

  const total = contacts.length
  const por_origen = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([origen, count]) => ({
      origen,
      count,
      pct: total > 0 ? Math.round((count / total) * 100) : 0,
    }))

  return {
    total,
    por_origen,
    breakdown_macro: macroInbound,
    fuente_campo: 'fuente_conversion',
  }
}

export async function GET(request) {
  const token = process.env.HUBSPOT_PRIVATE_APP_TOKEN
  const { searchParams } = new URL(request.url)
  const semana_desde = searchParams.get('semana_desde')
  const semana_hasta = searchParams.get('semana_hasta')

  // Validate required params
  if (!semana_desde || !semana_hasta) {
    return NextResponse.json(
      { error: 'Params semana_desde y semana_hasta son requeridos (YYYY-MM-DD)' },
      { status: 400 }
    )
  }

  // No token → error, no mock data
  if (!token) {
    return NextResponse.json({ error: true, message: 'HUBSPOT_PRIVATE_APP_TOKEN no configurado', por_origen: [], total: 0, semana_desde, semana_hasta }, { status: 503 })
  }

  // Check Upstash cache first
  const cacheKey = `hubspot-mqls-${semana_desde}-${semana_hasta}`
  const cached = await upstashGet(cacheKey)
  if (cached) {
    return NextResponse.json({ ...cached, cached: true })
  }

  // Fetch from HubSpot
  // HubSpot date filters require Unix timestamps in milliseconds
  const desdeMs = new Date(semana_desde + 'T00:00:00Z').getTime()
  const hastaMs = new Date(semana_hasta + 'T23:59:59Z').getTime()

  try {
    const contacts = await hubspotSearchAll(
      token,
      [
        { propertyName: 'lifecyclestage', operator: 'EQ', value: 'marketingqualifiedlead' },
        { propertyName: 'fecha_mql', operator: 'GTE', value: String(desdeMs) },
        { propertyName: 'fecha_mql', operator: 'LTE', value: String(hastaMs) },
      ],
      ['fecha_mql', 'hs_analytics_source', 'fuente_mql', 'fuente_conversion', 'hubspot_owner_id']
    )

    const result = {
      ...aggregateByOrigin(contacts),
      semana_desde,
      semana_hasta,
      lastUpdate: new Date().toISOString(),
    }

    // Cache 30 min
    await upstashSet(cacheKey, result, 1800)

    return NextResponse.json(result)
  } catch (error) {
    console.error('HubSpot MQLs error:', error.message)
    return NextResponse.json({
      error: true,
      message: error.message,
      por_origen: [],
      total: 0,
      semana_desde,
      semana_hasta,
    }, { status: 503 })
  }
}
