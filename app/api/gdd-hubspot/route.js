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

// --- HubSpot generic paginated search ---
async function hubspotSearchAll(token, objectType, filters, properties, sortField) {
  const results = []
  let after = undefined
  const MAX_PAGES = 20

  for (let page = 0; page < MAX_PAGES; page++) {
    const body = {
      filterGroups: [{ filters }],
      properties,
      limit: 100,
    }
    if (sortField) body.sorts = [{ propertyName: sortField, direction: 'DESCENDING' }]
    if (after) body.after = after

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)
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
      if (fetchErr.name === 'AbortError') throw new Error(`HubSpot ${objectType} timeout (8s)`)
      throw fetchErr
    }
    clearTimeout(timer)

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`HubSpot ${objectType} ${res.status}: ${text.slice(0, 300)}`)
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

// --- Date range calculation (Mexico City timezone) ---
function getDateRanges() {
  const now = new Date()
  // Approximate Mexico City offset (UTC-6 standard, UTC-5 DST)
  const mxOffset = -6 * 60
  const localOffset = now.getTimezoneOffset()
  const mxNow = new Date(now.getTime() + (localOffset + mxOffset) * 60000)

  const year = mxNow.getFullYear()
  const month = mxNow.getMonth()

  // ISO week: Monday to Sunday
  const dayOfWeek = mxNow.getDay() || 7 // Sunday = 7
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

// Filter results by date range using a date property
function filterByRange(results, dateField, desde, hasta) {
  const desdeMs = desde.getTime()
  const hastaMs = hasta.getTime()
  return results.filter(r => {
    const val = r.properties?.[dateField]
    if (!val) return false
    const ms = new Date(val).getTime()
    return ms >= desdeMs && ms <= hastaMs
  })
}

// Excluded UDNs
const EXCLUDED_UDNS = new Set(['', 'Interno', 'CF'])

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

  try {
    // YTD range for all queries
    const ytdDesdeMs = String(ranges.ytd.desde.getTime())
    const ytdHastaMs = String(ranges.ytd.hasta.getTime())

    // 4 queries in parallel — allSettled so one failure doesn't kill the rest
    const [leadsResult, mqlsResult, sqlsResult, oppsResult] = await Promise.allSettled([
      // LEADS: contacts with fecha_lead
      hubspotSearchAll(hsToken, 'contacts', [
        { propertyName: 'fecha_lead', operator: 'GTE', value: ytdDesdeMs },
        { propertyName: 'fecha_lead', operator: 'LTE', value: ytdHastaMs },
      ], ['fecha_lead', 'udn'], 'fecha_lead'),

      // MQLs: contacts with fecha_mql + lifecyclestage
      hubspotSearchAll(hsToken, 'contacts', [
        { propertyName: 'lifecyclestage', operator: 'EQ', value: 'marketingqualifiedlead' },
        { propertyName: 'fecha_mql', operator: 'GTE', value: ytdDesdeMs },
        { propertyName: 'fecha_mql', operator: 'LTE', value: ytdHastaMs },
      ], ['fecha_mql'], 'fecha_mql'),

      // SQLs: meetings (Credenciales + COMPLETED)
      hubspotSearchAll(hsToken, 'meetings', [
        { propertyName: 'hs_activity_type', operator: 'EQ', value: 'Credenciales' },
        { propertyName: 'hs_meeting_outcome', operator: 'EQ', value: 'COMPLETED' },
        { propertyName: 'hs_timestamp', operator: 'GTE', value: ytdDesdeMs },
        { propertyName: 'hs_timestamp', operator: 'LTE', value: ytdHastaMs },
      ], ['hs_timestamp', 'udn', 'contactos_asociados', 'hs_activity_type', 'hs_meeting_outcome'], 'hs_timestamp'),

      // OPPs: deals (Venta Externa + pipeline UDNs)
      hubspotSearchAll(hsToken, 'deals', [
        { propertyName: 'tipo_de_venta', operator: 'EQ', value: 'Venta Externa' },
        { propertyName: 'createdate', operator: 'GTE', value: ytdDesdeMs },
        { propertyName: 'createdate', operator: 'LTE', value: ytdHastaMs },
        { propertyName: 'pipeline', operator: 'IN', values: [
          '646364160', '31468827', '79805840', '53534318',
          '53534328', '53652407', '31419220', '646793827',
        ]},
      ], ['createdate', 'pipeline', 'amount', 'dealstage'], 'createdate'),
    ])

    // Extract results — default to empty array on failure
    const leadsRaw = leadsResult.status === 'fulfilled' ? leadsResult.value : []
    const mqlsRaw = mqlsResult.status === 'fulfilled' ? mqlsResult.value : []
    const sqlsRaw = sqlsResult.status === 'fulfilled' ? sqlsResult.value : []
    const oppsRaw = oppsResult.status === 'fulfilled' ? oppsResult.value : []

    // Track per-query errors for diagnostics
    const errors = []
    if (leadsResult.status === 'rejected') errors.push(`leads: ${leadsResult.reason?.message || leadsResult.reason}`)
    if (mqlsResult.status === 'rejected') errors.push(`mqls: ${mqlsResult.reason?.message || mqlsResult.reason}`)
    if (sqlsResult.status === 'rejected') errors.push(`sqls: ${sqlsResult.reason?.message || sqlsResult.reason}`)
    if (oppsResult.status === 'rejected') errors.push(`opps: ${oppsResult.reason?.message || oppsResult.reason}`)
    errors.forEach(e => console.error('GDD query error:', e))

    // If ALL 4 failed, return 503
    if (errors.length === 4) {
      return NextResponse.json({
        error: 'All HubSpot queries failed',
        errors,
        source: 'error',
      }, { status: 503 })
    }

    // Post-filter: Leads exclude bad UDNs
    const leads = leadsRaw.filter(c => {
      const udn = (c.properties?.udn || '').trim()
      return !EXCLUDED_UDNS.has(udn)
    })

    // Post-filter: SQLs must have valid UDN + exactly 1 associated contact
    const sqls = sqlsRaw.filter(m => {
      const props = m.properties || {}
      const udn = (props.udn || '').trim()
      return !EXCLUDED_UDNS.has(udn) && props.contactos_asociados === '1'
    })

    // MQLs and OPPs need no post-filtering
    const mqls = mqlsRaw
    const opps = oppsRaw

    // Count by period
    const countByPeriod = (items, dateField) => {
      const semana   = filterByRange(items, dateField, ranges.semana.desde, ranges.semana.hasta).length
      const anterior = filterByRange(items, dateField, ranges.anterior.desde, ranges.anterior.hasta).length
      const mes      = filterByRange(items, dateField, ranges.mes.desde, ranges.mes.hasta).length
      const ytd      = items.length // already filtered to YTD
      return { semana, anterior, mes, ytd }
    }

    const leadsCount = countByPeriod(leads, 'fecha_lead')
    const mqlsCount  = countByPeriod(mqls, 'fecha_mql')
    const sqlsCount  = countByPeriod(sqls, 'hs_timestamp')
    const oppsCount  = countByPeriod(opps, 'createdate')

    const result = {
      semana: {
        leads: leadsCount.semana,
        mqls:  mqlsCount.semana,
        sqls:  sqlsCount.semana,
        opps:  oppsCount.semana,
      },
      anterior: {
        leads: leadsCount.anterior,
        mqls:  mqlsCount.anterior,
        sqls:  sqlsCount.anterior,
        opps:  oppsCount.anterior,
      },
      mes: {
        leads: leadsCount.mes,
        mqls:  mqlsCount.mes,
        sqls:  sqlsCount.mes,
        opps:  oppsCount.mes,
      },
      ytd: {
        leads: leadsCount.ytd,
        mqls:  mqlsCount.ytd,
        sqls:  sqlsCount.ytd,
        opps:  oppsCount.ytd,
      },
      fechas: ranges.formatted,
      source: errors.length > 0 ? 'hubspot_partial' : 'hubspot_live',
      errors: errors.length > 0 ? errors : undefined,
      lastUpdate: new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }),
    }

    // Only cache if all queries succeeded (don't cache partial data)
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
