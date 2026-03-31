import { NextResponse } from 'next/server'

const SHEET_ID = '1FPzeq0eYJZInSzcnrR4pEa7SMb75Kj1ob8zM1l8mY98'
const SHEET_NAME = 'KPIs_Weekly'

// Genera un JWT firmado con la clave privada de la Service Account
// para autenticarse contra la Google Sheets API
async function getAccessToken() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON)
  const now = Math.floor(Date.now() / 1000)
  
  const header = { alg: 'RS256', typ: 'JWT' }
  const payload = {
    iss: credentials.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  }

  const encode = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url')
  const signingInput = `${encode(header)}.${encode(payload)}`

  // Importar clave privada RSA
  const pemKey = credentials.private_key
  const keyData = pemKey
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\n/g, '')
    .trim()

  const binaryKey = Buffer.from(keyData, 'base64')
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
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

// Parsear CSV de la hoja KPIs_Weekly
function parseSheetData(values) {
  if (!values || values.length < 2) return null

  const result = {
    semana: { leads: 0, mqls: 0, sqls: 0, opps: 0, pipeline_mkt: 0, pipeline_com: 0 },
    anterior: { leads: 0, mqls: 0, sqls: 0, opps: 0 },
    mes: { leads: 0, mqls: 0, sqls: 0, opps: 0 },
    ytd: { leads: 0, mqls: 0, sqls: 0, opps: 0 },
    fechas: {},
    source: 'sheets_api',
    lastUpdate: new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }),
  }

  // Saltar primera fila (headers)
  for (let i = 1; i < values.length; i++) {
    const row = values[i]
    if (!row || row.length < 2) continue
    const metrica = (row[0] || '').toString().trim().toLowerCase()
    const valor = parseFloat((row[1] || '0').toString().replace(/[,$]/g, '')) || 0
    const periodo = (row[2] || '').toString().trim().toLowerCase()

    if (periodo === 'semana_actual' || periodo === 'semana_actual_total') {
      if (metrica.includes('lead')) result.semana.leads = valor
      else if (metrica.includes('mql')) result.semana.mqls = valor
      else if (metrica.includes('sql')) result.semana.sqls = valor
      else if (metrica.includes('opp')) result.semana.opps = valor
      else if (metrica === 'fecha_desde') result.fechas.semana_desde = row[1]
      else if (metrica === 'fecha_hasta') result.fechas.semana_hasta = row[1]
    } else if (periodo === 'semana_anterior' || periodo === 'semana_anterior_total') {
      if (metrica.includes('lead')) result.anterior.leads = valor
      else if (metrica.includes('mql')) result.anterior.mqls = valor
      else if (metrica.includes('sql')) result.anterior.sqls = valor
      else if (metrica.includes('opp')) result.anterior.opps = valor
    } else if (periodo === 'mes_actual' || periodo === 'mes') {
      if (metrica.includes('lead')) result.mes.leads = valor
      else if (metrica.includes('mql')) result.mes.mqls = valor
      else if (metrica.includes('sql')) result.mes.sqls = valor
      else if (metrica.includes('opp')) result.mes.opps = valor
    } else if (periodo === 'ytd') {
      if (metrica.includes('lead')) result.ytd.leads = valor
      else if (metrica.includes('mql')) result.ytd.mqls = valor
      else if (metrica.includes('sql')) result.ytd.sqls = valor
      else if (metrica.includes('opp')) result.ytd.opps = valor
    } else if (periodo === 'actual') {
      if (metrica.includes('pipeline_mkt') || (metrica.includes('pipeline') && metrica.includes('mkt'))) result.semana.pipeline_mkt = valor
      else if (metrica.includes('pipeline_com') || (metrica.includes('pipeline') && metrica.includes('com'))) result.semana.pipeline_com = valor
    }
  }

  return result
}

const GDD_EMPTY = {
  semana: { leads: 0, mqls: 0, sqls: 0, opps: 0, pipeline_mkt: 0, pipeline_com: 0 },
  anterior: { leads: 0, mqls: 0, sqls: 0, opps: 0 },
  mes: { leads: 0, mqls: 0, sqls: 0, opps: 0 },
  ytd: { leads: 0, mqls: 0, sqls: 0, opps: 0 },
  fechas: {},
  source: 'empty',
}

export async function GET() {
  try {
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
      console.error('GdD: GOOGLE_SERVICE_ACCOUNT_JSON no configurado')
      return NextResponse.json({ ...GDD_EMPTY, error: 'credentials_missing' })
    }

    const accessToken = await getAccessToken()

    // Leer hoja KPIs_Weekly completa via Sheets API v4
    const range = encodeURIComponent(`${SHEET_NAME}!A:C`)
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}`
    
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('GdD Sheets API error:', res.status, err)
      return NextResponse.json({ ...GDD_EMPTY, error: `sheets_${res.status}` })
    }

    const data = await res.json()
    const parsed = parseSheetData(data.values)

    if (!parsed) {
      return NextResponse.json({ ...GDD_EMPTY, error: 'parse_failed' })
    }

    return NextResponse.json(parsed)
  } catch (err) {
    console.error('GdD error:', err.message)
    return NextResponse.json({ ...GDD_EMPTY, error: err.message })
  }
}
