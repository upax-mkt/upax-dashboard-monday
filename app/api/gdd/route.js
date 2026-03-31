import { NextResponse } from 'next/server'

const SPREADSHEET_ID = '1FPzeq0eYJZInSzcnrR4pEa7SMb75Kj1ob8zM1l8mY98'
const SHEET_NAME = 'KPIs_Weekly'

// Genera un JWT para autenticarse con Google APIs usando la Service Account
async function getGoogleAccessToken() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '{}')
  if (!credentials.private_key || !credentials.client_email) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON no configurado')
  }

  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const payload = {
    iss: credentials.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }

  const encode = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url')
  const signingInput = `${encode(header)}.${encode(payload)}`

  // Firmar con la private key usando Web Crypto API
  const pemBody = credentials.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\n/g, '')
    .trim()

  const keyData = Buffer.from(pemBody, 'base64')
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', keyData,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign']
  )

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5', cryptoKey,
    Buffer.from(signingInput)
  )

  const jwt = `${signingInput}.${Buffer.from(signature).toString('base64url')}`

  // Intercambiar JWT por access token
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  })

  const tokenData = await tokenRes.json()
  if (!tokenData.access_token) throw new Error(`Token error: ${JSON.stringify(tokenData)}`)
  return tokenData.access_token
}

// Parsea los datos de la hoja KPIs_Weekly con la estructura de César
function parseKPIsWeekly(rows) {
  const result = {
    semana: { leads: 0, mqls: 0, sqls: 0, opps: 0, pipeline_mkt: 0, pipeline_com: 0 },
    anterior: { leads: 0, mqls: 0, sqls: 0, opps: 0 },
    mes: { leads: 0, mqls: 0, sqls: 0, opps: 0 },
    ytd: { leads: 0, mqls: 0, sqls: 0, opps: 0 },
    fechas: {},
    source: 'sheets_api',
    lastUpdate: new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }),
  }

  // Saltar header (fila 0)
  for (const row of rows.slice(1)) {
    const metrica = (row[0] || '').toLowerCase().trim()
    const valor = parseFloat((row[1] || '0').toString().replace(/,/g, '')) || 0
    const periodo = (row[2] || '').toLowerCase().trim()

    // Fechas — normalizar al formato YYYY-MM-DD
    // Sheets puede devolver DD/M/YYYY, D/M/YYYY o YYYY-MM-DD según la localización
    function normalizeFecha(raw) {
      if (!raw) return raw
      // Si ya es YYYY-MM-DD
      if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
      // Si es D/M/YYYY o DD/MM/YYYY
      const parts = raw.split('/')
      if (parts.length === 3) {
        const [d, m, y] = parts
        return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`
      }
      return raw
    }
    if (metrica === 'fecha_desde' && periodo === 'semana_actual') result.fechas.semana_desde = normalizeFecha(row[1])
    if (metrica === 'fecha_hasta' && periodo === 'semana_actual') result.fechas.semana_hasta = normalizeFecha(row[1])

    // Métricas por periodo
    const map = {
      semana_actual: 'semana',
      semana_anterior: 'anterior',
      mes_actual: 'mes',
      ytd: 'ytd',
      actual: 'semana', // pipeline usa "actual"
    }
    const target = map[periodo]
    if (!target) continue

    // Leads — separar total de breakdowns mkt/com para evitar double counting
    // La hoja tiene: leads_mkt, leads_com, leads (total) — solo usar el total para el KPI principal
    if (metrica.includes('leads') && !metrica.includes('mql') && !metrica.includes('sql')) {
      if (metrica.includes('mkt')) result[target].leads_mkt = valor
      else if (metrica.includes('com')) result[target].leads_com = valor
      else if (metrica === 'leads') result[target].leads = valor // solo el total exacto
    }
    if (metrica.includes('mql') && !metrica.includes('sql')) {
      if (metrica.includes('mkt')) result[target].mqls_mkt = valor
      else if (metrica.includes('com')) result[target].mqls_com = valor
      else if (metrica === 'mqls' || metrica === 'mql') result[target].mqls = valor
    }
    if (metrica.includes('sql') && !metrica.includes('mql')) {
      if (metrica.includes('mkt')) result[target].sqls_mkt = valor
      else if (metrica.includes('com')) result[target].sqls_com = valor
      else if (metrica === 'sqls' || metrica === 'sql') result[target].sqls = valor
    }
    if (metrica.includes('opp')) {
      if (metrica.includes('mkt')) result[target].opps_mkt = valor
      else if (metrica.includes('com')) result[target].opps_com = valor
      else if (metrica === 'opps' || metrica === 'opp') result[target].opps = valor
    }
    if (metrica.includes('pipeline_mkt')) result.semana.pipeline_mkt = valor
    if (metrica.includes('pipeline_com')) result.semana.pipeline_com = valor
    if (metrica.includes('pipeline_total') || metrica === 'pipeline') result.semana.pipeline_total = valor
  }

  return result
}

export async function GET() {
  try {
    const accessToken = await getGoogleAccessToken()

    const range = `${SHEET_NAME}!A:C`
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(range)}`

    const sheetsRes = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    })

    if (!sheetsRes.ok) {
      const err = await sheetsRes.text()
      throw new Error(`Sheets API error ${sheetsRes.status}: ${err}`)
    }

    const data = await sheetsRes.json()
    const rows = data.values || []

    if (rows.length < 2) {
      return NextResponse.json({ error: 'Hoja vacía o sin datos', source: 'sheets_api' }, { status: 200 })
    }

    const parsed = parseKPIsWeekly(rows)
    return NextResponse.json(parsed)

  } catch (error) {
    console.error('GdD API error:', error.message)
    return NextResponse.json({ error: error.message, source: 'error' }, { status: 200 })
  }
}
