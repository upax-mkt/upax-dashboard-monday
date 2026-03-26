import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// URL del CSV publicado — se configura en Vercel como variable de entorno
// SHEETS_GDD_CSV_URL = link del "Publicar en la web" de KPIs_Weekly
const CSV_URL = process.env.SHEETS_GDD_CSV_URL

// Fallback hardcoded (se muestra cuando la hoja no está disponible)
// Estos datos son PLACEHOLDER — se reemplazan en cuanto César publique la hoja
const FALLBACK = {
  semana: { leads: 0, mqls: 0, sqls: 0, opps: 0, pipeline_mkt: 0, pipeline_com: 0 },
  anterior: { leads: 0, mqls: 0, sqls: 0, opps: 0 },
  mes: { leads: 0, mqls: 0, sqls: 0, opps: 0 },
  ytd: { leads: 0, mqls: 0, sqls: 0, opps: 0 },
  fechas: { semana_desde: null, semana_hasta: null, mes_label: null },
  lastUpdate: null,
  source: 'fallback',
}

function parseCSV(text) {
  const lines = text.trim().split('\n').filter(Boolean)
  if (lines.length < 2) return null

  // Detectar separador: coma o punto y coma
  const sep = lines[0].includes(';') ? ';' : ','

  // Limpiar comillas y espacios de cada celda
  const clean = (s) => (s || '').replace(/^["\s]+|["\s]+$/g, '').trim()

  const headers = lines[0].split(sep).map(clean).map(h => h.toLowerCase())
  const iMetrica = headers.indexOf('metrica')
  const iValor   = headers.indexOf('valor')
  const iPeriodo = headers.indexOf('periodo')

  if (iMetrica === -1 || iValor === -1 || iPeriodo === -1) {
    console.error('GDD CSV: columnas no encontradas. Headers:', headers)
    return null
  }

  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(sep).map(clean)
    const metrica = cols[iMetrica]?.toLowerCase()
    const valor   = cols[iValor]
    const periodo = cols[iPeriodo]?.toLowerCase()
    if (!metrica || !periodo) continue
    rows.push({ metrica, valor: valor?.replace(/,/g, ''), periodo })
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

  const num = (v) => parseFloat(String(v).replace(/[^0-9.-]/g, '')) || 0

  for (const { metrica, valor, periodo } of rows) {
    // Semana actual
    if (['semana_actual', 'semana_current', 'current_week', 'this_week'].includes(periodo)) {
      if (['leads','mqls','sqls','opps'].includes(metrica)) gdd.semana[metrica] = num(valor)
      if (metrica === 'pipeline_mkt')   gdd.semana.pipeline_mkt = num(valor)
      if (metrica === 'pipeline_com')   gdd.semana.pipeline_com = num(valor)
      if (metrica === 'pipeline_total') gdd.semana.pipeline_mkt = num(valor) // fallback si no están separados
    }
    // Semana anterior
    if (['semana_anterior', 'previous_week', 'last_week', 'semana_prev'].includes(periodo)) {
      if (['leads','mqls','sqls','opps'].includes(metrica)) gdd.anterior[metrica] = num(valor)
    }
    // Mes actual / acumulado mes
    if (['mes_actual', 'mes', 'month', 'acumulado_mes', 'mtd', 'mes_corriente'].includes(periodo)) {
      if (['leads','mqls','sqls','opps'].includes(metrica)) gdd.mes[metrica] = num(valor)
    }
    // YTD
    if (['ytd', 'year_to_date', 'acumulado_anio', 'acumulado'].includes(periodo)) {
      if (['leads','mqls','sqls','opps'].includes(metrica)) gdd.ytd[metrica] = num(valor)
    }
    // Pipeline activo (puede tener periodo propio)
    if (['actual', 'pipeline_actual', 'active', 'pipeline'].includes(periodo)) {
      if (metrica === 'pipeline_mkt')   gdd.semana.pipeline_mkt = num(valor)
      if (metrica === 'pipeline_com')   gdd.semana.pipeline_com = num(valor)
      if (metrica === 'pipeline_total') {
        // Si solo hay total, dividir en mkt=60% y com=40% como estimado
        // o dejar todo en pipeline_mkt hasta que César los separe
        gdd.semana.pipeline_mkt = num(valor)
        gdd.semana.pipeline_com = 0
      }
    }
    // Fechas
    if (metrica === 'fecha_desde' && ['semana_actual', 'semana_current'].includes(periodo))
      gdd.fechas.semana_desde = valor
    if (metrica === 'fecha_hasta' && ['semana_actual', 'semana_current'].includes(periodo))
      gdd.fechas.semana_hasta = valor
    if (metrica === 'mes_label' || (metrica === 'fecha_mes' && periodo === 'mes_actual'))
      gdd.fechas.mes_label = valor
  }

  return gdd
}

export async function GET() {
  // Si no hay URL configurada, devolver fallback con mensaje claro
  if (!CSV_URL) {
    return NextResponse.json({
      ...FALLBACK,
      error: 'SHEETS_GDD_CSV_URL no configurada en Vercel',
    }, {
      headers: { 'Cache-Control': 'no-store' }
    })
  }

  try {
    const res = await fetch(CSV_URL, {
      headers: { 'Accept': 'text/csv,text/plain' },
      next: { revalidate: 3600 }, // cache 1 hora
    })

    if (!res.ok) throw new Error(`Sheets HTTP ${res.status}`)

    const text = await res.text()
    const rows = parseCSV(text)

    if (!rows || rows.length === 0) {
      throw new Error('CSV vacío o estructura no reconocida')
    }

    const gdd = buildGdd(rows)

    return NextResponse.json(gdd, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
      }
    })
  } catch (error) {
    console.error('GDD fetch error:', error.message)
    return NextResponse.json({
      ...FALLBACK,
      error: error.message,
    }, {
      headers: { 'Cache-Control': 'no-store' }
    })
  }
}
