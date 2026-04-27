import { NextResponse } from 'next/server'
import { validateAuth } from '../_auth'
import { upstashGet, upstashSet } from '../../lib/upstash-server'

export const dynamic = 'force-dynamic'

const MAX_PAGES = 20

// --- HubSpot search with pagination — returns { total, mkt, com, amount_total, amount_mkt, amount_com } ---
async function hubspotSearchSplit(token, objectType, filters, splitProp, properties, sumField) {
  let total = 0, mkt = 0, com = 0
  let amountTotal = 0, amountMkt = 0, amountCom = 0
  let after = undefined

  const propsToFetch = [...new Set([splitProp, ...(sumField ? [sumField] : []), ...properties])]

  for (let page = 0; page < MAX_PAGES; page++) {
    const body = {
      filterGroups: [{ filters }],
      properties: propsToFetch,
      limit: 100,
    }
    if (after) body.after = after

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
    const results = data.results || []

    for (const item of results) {
      total++
      const props = item.properties || {}
      const splitVal = props[splitProp]
      const isMkt = splitVal === 'true' || splitVal === true
      const isCom = splitVal === 'false' || splitVal === false

      if (isMkt) mkt++
      else if (isCom) com++

      if (sumField) {
        const amt = parseFloat(props[sumField]) || 0
        amountTotal += amt
        if (isMkt) amountMkt += amt
        else if (isCom) amountCom += amt
      }
    }

    if (data.paging?.next?.after) {
      after = data.paging.next.after
    } else {
      break
    }
  }

  const result = { total, mkt, com }
  if (sumField) {
    result.amount_total = amountTotal
    result.amount_mkt = amountMkt
    result.amount_com = amountCom
  }
  return result
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

// UDN exclusion filters shared by multiple metrics
const UDN_FILTERS = [
  { propertyName: 'udn', operator: 'HAS_PROPERTY' },
  { propertyName: 'udn', operator: 'NEQ', value: 'Interno' },
  { propertyName: 'udn', operator: 'NEQ', value: 'CF' },
]

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
  const cacheKey = `gdd-hubspot-v2-${ranges.formatted.semana_desde}`
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

  // Metric definitions with split properties
  const metricDefs = {
    leads: {
      objectType: 'contacts',
      dateField: 'fecha_lead',
      splitProp: 'contacto_marketing',
      baseFilters: [...UDN_FILTERS],
    },
    mqls: {
      objectType: 'contacts',
      dateField: 'fecha_mql',
      splitProp: 'conversion',
      baseFilters: [
        { propertyName: 'lifecyclestage', operator: 'EQ', value: 'marketingqualifiedlead' },
        ...UDN_FILTERS,
      ],
    },
    sqls: {
      objectType: 'meetings',
      dateField: 'hs_timestamp',
      splitProp: 'reunion_generado_por',
      baseFilters: [
        { propertyName: 'hs_activity_type', operator: 'EQ', value: 'Credenciales' },
        { propertyName: 'hs_meeting_outcome', operator: 'EQ', value: 'COMPLETED' },
        { propertyName: 'contactos_asociados', operator: 'EQ', value: '1' },
        ...UDN_FILTERS,
      ],
    },
    opps: {
      objectType: 'deals',
      dateField: 'createdate',
      splitProp: 'negocio_marketing',
      sumField: 'amount',
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
    const counts = { semana: {}, anterior: {}, mes: {}, ytd: {} }
    const errors = []

    for (let mi = 0; mi < metrics.length; mi++) {
      if (mi > 0) await new Promise(r => setTimeout(r, 1100))
      const metric = metrics[mi]
      const def = metricDefs[metric]
      const batch = periodNames.map(period => {
        const { desde, hasta } = periods[period]
        const dateFilters = [
          { propertyName: def.dateField, operator: 'GTE', value: String(desde.getTime()) },
          { propertyName: def.dateField, operator: 'LTE', value: String(hasta.getTime()) },
        ]
        return {
          period,
          promise: hubspotSearchSplit(
            hsToken,
            def.objectType,
            [...def.baseFilters, ...dateFilters],
            def.splitProp,
            [],
            def.sumField || null,
          ),
        }
      })

      const batchResults = await Promise.allSettled(batch.map(b => b.promise))

      batchResults.forEach((r, i) => {
        const { period } = batch[i]
        if (r.status === 'fulfilled') {
          const v = r.value
          counts[period][metric] = v.total
          counts[period][`${metric}_mkt`] = v.mkt
          counts[period][`${metric}_com`] = v.com
          if (v.amount_total !== undefined) {
            counts[period].pipeline_total = v.amount_total
            counts[period].pipeline_mkt = v.amount_mkt
            counts[period].pipeline_com = v.amount_com
          }
        } else {
          counts[period][metric] = 0
          counts[period][`${metric}_mkt`] = 0
          counts[period][`${metric}_com`] = 0
          const errMsg = `${metric}/${period}: ${r.reason?.message || r.reason}`
          if (!errors.some(e => e.startsWith(`${metric}/`))) {
            errors.push(errMsg)
          }
        }
      })
    }

    errors.forEach(e => console.error('GDD query error:', e))

    const allFailed = errors.length >= metrics.length
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
