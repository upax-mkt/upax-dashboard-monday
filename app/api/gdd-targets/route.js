import { NextResponse } from 'next/server'
import { validateAuth } from '../_auth'
import { upstashGet, upstashSet } from '../../lib/upstash-server'

export const dynamic = 'force-dynamic'

const _now = new Date()
const TARGETS_CACHE_KEY = `gdd-targets-v1-${_now.getFullYear()}-${_now.getMonth()}`
const TARGETS_TTL = 86400 // 24h

// Genera un JWT para autenticarse con Google APIs usando la Service Account
async function getGoogleAccessToken() {
  let credentials
  try {
    credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '{}')
  } catch (e) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON es JSON invalido: ' + e.message)
  }
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

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  })

  const tokenData = await tokenRes.json()
  if (!tokenData.access_token) throw new Error(`Token error: ${JSON.stringify(tokenData)}`)
  return tokenData.access_token
}

let _cachedGoogleToken = null
let _tokenExpiry = 0

async function getGoogleAccessTokenCached() {
  const now = Math.floor(Date.now() / 1000)
  if (_cachedGoogleToken && now < _tokenExpiry - 60) {
    return _cachedGoogleToken
  }
  const token = await getGoogleAccessToken()
  _cachedGoogleToken = token
  _tokenExpiry = now + 3600
  return token
}

function parseTargets(rows) {
  const targets = { leads: 0, mqls: 0, sqls: 0, opps: 0, pipeline: 0 }
  let mes = ''

  for (const row of rows.slice(1)) {
    const metrica = (row[0] || '').toLowerCase().trim()
    const valor = parseFloat((row[1] || '0').toString().replace(/,/g, '')) || 0
    const periodo = (row[2] || '').toLowerCase().trim()

    if (periodo === 'meta_mes' || periodo === 'target' || periodo === 'meta') {
      if (metrica === 'leads') targets.leads = valor
      else if (metrica === 'mqls' || metrica === 'mql') targets.mqls = valor
      else if (metrica === 'sqls' || metrica === 'sql') targets.sqls = valor
      else if (metrica === 'opps' || metrica === 'opp') targets.opps = valor
      else if (metrica.includes('pipeline')) targets.pipeline = valor
    }

    if (metrica === 'mes' || metrica === 'month') mes = (row[1] || '').trim()
  }

  return { targets, mes }
}

export async function GET(request) {
  const authErr = validateAuth(request)
  if (authErr) return authErr

  // Check cache first (24h TTL)
  const cached = await upstashGet(TARGETS_CACHE_KEY)
  if (cached) {
    return NextResponse.json({ ...cached, cached: true })
  }

  try {
    const SPREADSHEET_ID = process.env.SHEETS_GDD_SPREADSHEET_ID
    if (!SPREADSHEET_ID) {
      return NextResponse.json({ error: 'SHEETS_GDD_SPREADSHEET_ID no configurado', source: 'error' }, { status: 500 })
    }

    const SHEET_NAME = process.env.SHEETS_GDD_TAB_NAME || 'KPIs_Weekly'
    const accessToken = await getGoogleAccessTokenCached()

    const range = `${SHEET_NAME}!A:C`
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(range)}`

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)
    let sheetsRes
    try {
      sheetsRes = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
        signal: controller.signal,
      })
    } catch (fetchErr) {
      clearTimeout(timer)
      if (fetchErr.name === 'AbortError') throw new Error('Google Sheets timeout (8s)')
      throw fetchErr
    }
    clearTimeout(timer)

    if (!sheetsRes.ok) {
      const err = await sheetsRes.text()
      throw new Error(`Sheets API error ${sheetsRes.status}: ${err}`)
    }

    const data = await sheetsRes.json()
    const rows = data.values || []

    if (rows.length < 2) {
      return NextResponse.json({ targets: {}, mes: '', source: 'sheets' })
    }

    const parsed = parseTargets(rows)
    const result = {
      ...parsed,
      source: 'sheets',
      lastUpdate: new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }),
    }

    await upstashSet(TARGETS_CACHE_KEY, result, TARGETS_TTL)

    return NextResponse.json(result)
  } catch (error) {
    console.error('GdD Targets API error:', error.message)
    return NextResponse.json({ error: error.message, source: 'error' }, { status: 503 })
  }
}
