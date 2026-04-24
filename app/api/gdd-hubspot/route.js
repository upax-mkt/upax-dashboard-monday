import { NextResponse } from 'next/server'
import { validateAuth } from '../_auth'

export const dynamic = 'force-dynamic'

// --- Upstash cache helpers ---
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

// --- HubSpot count-only search (single request, no pagination) ---
async function hubspotCount(token, objectType, filters) {
  const body = {
    filterGroups: [{ filters }],
    properties: [],
    limit: 1,
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10000)
  let res
  try {
    res = await fetch(`https://api.hubapi.com/crm/v3/objects/${objectType}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: controller.signal,
    })
  } catch (fetchErr) {
    clearTimeout(timer)
    if (fetchErr.name === 'AbortError') throw new Error(`HS ${objectType} timeout`)
    throw fetchErr
  }
  clearTimeout(timer)

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`HS ${objectType} ${res.status}: ${text.slice(0, 120)}`)
  }

  const data = await res.json()
  return data.total || 0
}

// --- Date range calculation (Mexico City timezone) ---
function getDateRanges() {
  const now = new Date()
  const mxOffset = -6 * 60
  const localOffset = now.getTimezoneOffset()
  const mxNow = new Date(now.getTime() + (localOffset + mxOffset) * 60000)

  const year = mxNow.getFullYear()
  const month = mxNow.getMonth()

  const dayOfWeek = mxNow.getDay() || 7
  const monday = new Date(mxNow)
  monday.setDate(mxNow.getDate() - (dayOfWeek - 1))
  monday.setHours(0, 0, 0, 0)

  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)

  const prevMonday = new Date(monday)
  prevMonday.setDate(monday.getDate() - 7)
  const prevSunday = new Date(monday)
  prevSunday.setDate(monday.getDate() - 1)
  prevSunday.setHours(23, 59, 59, 999)

  const mesDesde = new Date(year, month, 1)
  const mesHasta = new Date(year, month + 1, 0, 23, 59, 59, 999)

  const ytdDesde = new Date(year, 0, 1)

  const fmtDate = (d) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  return {
    semana:   { desde: monday,     hasta: sunday },
    anterior: { desde: prevMonday, hasta: prevSunday },
    mes:      { desde: mesDesde,   hasta: mesHasta },
    ytd:      { desde: ytdDesde,   hasta: mxNow },
    formatted: {
      semana_desde: fmtDate(monday),
      semana_hasta: fmtDate(sunday),
    },
  }
}

export async function GET(request) {
  const authErr = validateAuth(request)
  if (authErr) return authErr

  const hsToken = process.env.HUBSPOT_PRIVATE_APP_TOKEN
  if (!hsToken) {
    return NextResponse.json({ error: 'HUBSPOT_PRIVATE_APP_TOKEN no configurado', source: 'error' }, { status: 503 })
  }

  const { searchParams } = new URL(request.url)
  const noCache = searchParams.get('nocache') === '1'

  const ranges = getDateRanges()

  // Check cache
  const cacheKey = `gdd-hubspot-${ranges.formatted.semana_desde}`
  if (!noCache) {
    const cached = await upstashGet(cacheKey)
    if (cached) {
      return NextResponse.json({ ...cached, cached: true })
    }
  }

  // Build date range filters for each period
  const periods = {
    semana:   { desde: ranges.semana.desde,   hasta: ranges.semana.hasta },
    anterior: { desde: ranges.anterior.desde, hasta: ranges.anterior.hasta },
    mes:      { desde: ranges.mes.desde,      hasta: ranges.mes.hasta },
    ytd:      { desde: ranges.ytd.desde,      hasta: ranges.ytd.hasta },
  }

  // Metric definitions: each has base filters + date field + object type
  const metricDefs = {
    leads: {
      objectType: 'contacts',
      dateField: 'fecha_lead',
      baseFilters: [
        { propertyName: 'udn', operator: 'HAS_PROPERTY' },
        { propertyName: 'udn', operator: 'NEQ', value: 'Interno' },
        { propertyName: 'udn', operator: 'NEQ', value: 'CF' },
      ],
    },
    mqls: {
      objectType: 'contacts',
      dateField: 'fecha_mql',
      baseFilters: [
        { propertyName: 'lifecyclestage', operator: 'EQ', value: 'marketingqualifiedlead' },
      ],
    },
    sqls: {
      objectType: 'meetings',
      dateField: 'hs_timestamp',
      baseFilters: [
        { propertyName: 'hs_activity_type', operator: 'EQ', value: 'Credenciales' },
        { propertyName: 'hs_meeting_outcome', operator: 'EQ', value: 'COMPLETED' },
        { propertyName: 'contactos_asociados', operator: 'EQ', value: '1' },
      ],
    },
    opps: {
      objectType: 'deals',
      dateField: 'createdate',
      baseFilters: [
        { propertyName: 'tipo_de_venta', operator: 'EQ', value: 'Venta Externa' },
        { propertyName: 'pipeline', operator: 'IN', values: [
          '646364160', '31468827', '79805840', '53534318',
          '53534328', '53652407', '31419220', '646793827',
        ]},
      ],
    },
  }

  const metrics = ['leads', 'mqls', 'sqls', 'opps']
  const periodNames = ['semana', 'anterior', 'mes', 'ytd']

  try {
    // Build all 16 count queries (4 metrics × 4 periods)
    const queries = []
    for (const metric of metrics) {
      const def = metricDefs[metric]
      for (const period of periodNames) {
        const { desde, hasta } = periods[period]
        const dateFilters = [
          { propertyName: def.dateField, operator: 'GTE', value: String(desde.getTime()) },
          { propertyName: def.dateField, operator: 'LTE', value: String(hasta.getTime()) },
        ]
        queries.push({
          metric,
          period,
          promise: hubspotCount(hsToken, def.objectType, [...def.baseFilters, ...dateFilters]),
        })
      }
    }

    // Run all queries with allSettled — max 16 simple requests (no pagination)
    const results = await Promise.allSettled(queries.map(q => q.promise))

    // Collect results and errors
    const counts = { semana: {}, anterior: {}, mes: {}, ytd: {} }
    const errors = []

    results.forEach((r, i) => {
      const { metric, period } = queries[i]
      if (r.status === 'fulfilled') {
        counts[period][metric] = r.value
      } else {
        counts[period][metric] = 0
        const errMsg = `${metric}/${period}: ${r.reason?.message || r.reason}`
        // Only log unique metric errors (not all 4 periods of same failure)
        if (!errors.some(e => e.startsWith(`${metric}/`))) {
          errors.push(errMsg)
        }
      }
    })

    errors.forEach(e => console.error('GDD query error:', e))

    // Check if ALL metrics failed (all 16 queries)
    const allFailed = results.every(r => r.status === 'rejected')
    if (allFailed) {
      return NextResponse.json({
        error: 'All HubSpot queries failed',
        errors,
        source: 'error',
      }, { status: 503 })
    }

    const result = {
      semana:   counts.semana,
      anterior: counts.anterior,
      mes:      counts.mes,
      ytd:      counts.ytd,
      fechas:   ranges.formatted,
      source:   errors.length > 0 ? 'hubspot_partial' : 'hubspot_live',
      errors:   errors.length > 0 ? errors : undefined,
      lastUpdate: new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }),
    }

    // Only cache if all queries succeeded
    if (errors.length === 0) {
      await upstashSet(cacheKey, result, 900)
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('GDD HubSpot error:', error.message)
    return NextResponse.json({
      error: error.message,
      source: 'error',
    }, { status: 503 })
  }
}
