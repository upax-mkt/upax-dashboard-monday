import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const CSV_URL = process.env.SHEETS_GDD_CSV_URL

function parseCSV(text) {
  const lines = text.trim().split('\n').filter(Boolean)
  if (lines.length < 2) return null
  const sep = lines[0].includes(';') ? ';' : ','
  const clean = (s) => (s || '').replace(/^["\s]+|["\s]+$/g, '').trim()
  const headers = lines[0].split(sep).map(clean).map(h => h.toLowerCase())
  const iMetrica = headers.indexOf('metrica')
  const iValor   = headers.indexOf('valor')
  const iPeriodo = headers.indexOf('periodo')
  if (iMetrica === -1 || iValor === -1 || iPeriodo === -1) return null
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(sep).map(clean)
    const metrica = cols[iMetrica]?.toLowerCase()
    const valor   = cols[iValor]
    const periodo = cols[iPeriodo]?.toLowerCase()
    if (!metrica || !periodo) continue
    rows.push({ metrica, valor, periodo })
  }
  return rows
}

function buildGdd(rows) {
  const gdd = {
    semana:   { leads: 0, mqls: 0, sqls: 0, opps: 0, pipeline_mkt: 0, pipeline_com: 0 },
    anterior: { leads: 0, mqls: 0, sqls: 0, opps: 0 },
    mes:      { leads: 0, mqls: 0, sqls: 0, opps: 0 },
    ytd:      { leads: 0, mqls: 0, sqls: 0, opps: 0 },
    fechas:   {},
    lastUpdate: new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }),
    source: 'sheets',
  }

  // Parsear número — maneja "$102,938,206" o "1186" o "102938206"
  const num = (v) => {
    if (!v) return 0
    const clean = String(v).replace(/[$,\s]/g, '')
    return parseFloat(clean) || 0
  }

  // Normalizar periodo
  const normPeriodo = (p) => p?.toLowerCase().replace(/\s+/g, '_') || ''

  for (const { metrica, valor, periodo } of rows) {
    const p = normPeriodo(periodo)
    const v = num(valor)

    // Semana actual
    if (p === 'semana_actual') {
      if (metrica === 'leads_total')   gdd.semana.leads = v
      if (metrica === 'mqls_total')    gdd.semana.mqls  = v
      if (metrica === 'sqls_total')    gdd.semana.sqls  = v
      if (metrica === 'opps_total')    gdd.semana.opps  = v
      // Fallback si no hay _total
      if (metrica === 'leads' && !gdd.semana.leads) gdd.semana.leads = v
      if (metrica === 'mqls'  && !gdd.semana.mqls)  gdd.semana.mqls  = v
      if (metrica === 'sqls'  && !gdd.semana.sqls)  gdd.semana.sqls  = v
      if (metrica === 'opps'  && !gdd.semana.opps)  gdd.semana.opps  = v
      // Fechas
      if (metrica === 'fecha_desde') gdd.fechas.semana_desde = valor
      if (metrica === 'fecha_hasta') gdd.fechas.semana_hasta = valor
    }

    // Semana anterior
    if (p === 'semana_anterior') {
      if (metrica === 'leads_total')   gdd.anterior.leads = v
      if (metrica === 'mqls_total')    gdd.anterior.mqls  = v
      if (metrica === 'sqls_total')    gdd.anterior.sqls  = v
      if (metrica === 'opps_total')    gdd.anterior.opps  = v
      if (metrica === 'leads' && !gdd.anterior.leads) gdd.anterior.leads = v
      if (metrica === 'mqls'  && !gdd.anterior.mqls)  gdd.anterior.mqls  = v
      if (metrica === 'sqls'  && !gdd.anterior.sqls)  gdd.anterior.sqls  = v
      if (metrica === 'opps'  && !gdd.anterior.opps)  gdd.anterior.opps  = v
    }

    // YTD — maneja "YTD" y "ytd"
    if (p === 'ytd') {
      if (metrica === 'leads_total')   gdd.ytd.leads = v
      if (metrica === 'mqls_total')    gdd.ytd.mqls  = v
      if (metrica === 'sqls_total')    gdd.ytd.sqls  = v
      if (metrica === 'opps_total')    gdd.ytd.opps  = v
      if (metrica === 'leads' && !gdd.ytd.leads) gdd.ytd.leads = v
      if (metrica === 'mqls'  && !gdd.ytd.mqls)  gdd.ytd.mqls  = v
      if (metrica === 'sqls'  && !gdd.ytd.sqls)  gdd.ytd.sqls  = v
      if (metrica === 'opps'  && !gdd.ytd.opps)  gdd.ytd.opps  = v
    }

    // Mes actual (cuando César lo agregue)
    if (['mes_actual', 'mes', 'mtd', 'acumulado_mes'].includes(p)) {
      if (metrica === 'leads_total' || metrica === 'leads') gdd.mes.leads = v
      if (metrica === 'mqls_total'  || metrica === 'mqls')  gdd.mes.mqls  = v
      if (metrica === 'sqls_total'  || metrica === 'sqls')  gdd.mes.sqls  = v
      if (metrica === 'opps_total'  || metrica === 'opps')  gdd.mes.opps  = v
    }

    // Pipeline activo — usa _valor para pesos
    if (p === 'actual') {
      if (metrica === 'pipeline_mkt_valor')   gdd.semana.pipeline_mkt = v
      if (metrica === 'pipeline_com_valor')   gdd.semana.pipeline_com = v
      if (metrica === 'pipeline_total_valor') {
        // Si no hay mkt/com separados, usar total
        if (!gdd.semana.pipeline_mkt && !gdd.semana.pipeline_com) {
          gdd.semana.pipeline_mkt = v
        }
      }
      // Fallback sin _valor
      if (metrica === 'pipeline_mkt' && !gdd.semana.pipeline_mkt)   gdd.semana.pipeline_mkt = v
      if (metrica === 'pipeline_com' && !gdd.semana.pipeline_com)   gdd.semana.pipeline_com = v
    }
  }

  return gdd
}

export async function GET() {
  if (!CSV_URL) {
    return NextResponse.json({
      semana: { leads: 0, mqls: 0, sqls: 0, opps: 0, pipeline_mkt: 0, pipeline_com: 0 },
      anterior: { leads: 0, mqls: 0, sqls: 0, opps: 0 },
      mes: { leads: 0, mqls: 0, sqls: 0, opps: 0 },
      ytd: { leads: 0, mqls: 0, sqls: 0, opps: 0 },
      fechas: {},
      source: 'fallback',
      error: 'SHEETS_GDD_CSV_URL no configurada',
    })
  }

  try {
    const res = await fetch(CSV_URL, {
      headers: { 'Accept': 'text/csv,text/plain,*/*' },
      next: { revalidate: 3600 },
    })
    if (!res.ok) throw new Error(`Sheets HTTP ${res.status}`)

    const text = await res.text()
    const rows = parseCSV(text)
    if (!rows?.length) throw new Error('CSV vacío o estructura no reconocida')

    const gdd = buildGdd(rows)
    return NextResponse.json(gdd, {
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' }
    })
  } catch (error) {
    console.error('GDD fetch error:', error.message)
    return NextResponse.json({
      semana: { leads: 0, mqls: 0, sqls: 0, opps: 0, pipeline_mkt: 0, pipeline_com: 0 },
      anterior: { leads: 0, mqls: 0, sqls: 0, opps: 0 },
      mes: { leads: 0, mqls: 0, sqls: 0, opps: 0 },
      ytd: { leads: 0, mqls: 0, sqls: 0, opps: 0 },
      fechas: {},
      source: 'fallback',
      error: error.message,
    })
  }
}
