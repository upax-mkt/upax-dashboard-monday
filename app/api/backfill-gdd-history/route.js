import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const GDD_HISTORY_KEY = 'gdd_history'

async function upstash(command, ...args) {
  const url   = process.env.KV_REST_API_URL   || process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) throw new Error('Upstash no configurado')
  const encoded = args.map(a => encodeURIComponent(String(a)))
  const res = await fetch(`${url}/${[command, ...encoded].join('/')}`, {
    headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Upstash ${res.status}`)
  const data = await res.json()
  return data.result ?? null
}

async function upstashGet(key) {
  const raw = await upstash('GET', key)
  if (!raw) return null
  try { return typeof raw === 'string' ? JSON.parse(raw) : raw } catch { return null }
}

async function upstashSet(key, value) {
  const serialized = typeof value === 'string' ? value : JSON.stringify(value)
  await upstash('SET', key, serialized, 'EX', String(60 * 60 * 24 * 365))
}

export async function GET(request) {
  // Proteger endpoint — requiere CRON_SECRET (mismo esquema que gdd-weekly-save)
  const auth = request.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const history = (await upstashGet(GDD_HISTORY_KEY)) || []
    if (!Array.isArray(history) || history.length === 0) {
      return NextResponse.json({ ok: false, reason: 'empty_history' })
    }

    let updated = 0
    let skipped = 0
    const enriched = []

    for (const entry of history) {
      // Skip entries that already have por_origen
      if (Array.isArray(entry.por_origen) && entry.por_origen.length > 0) {
        enriched.push(entry)
        skipped++
        continue
      }

      // Fetch HubSpot for this entry's week
      const sd = entry.semana_desde || entry.id
      const sh = entry.semana_hasta || sd
      let por_origen = []
      let breakdown_macro = { inbound: 0, outbound: 0, unknown: 0 }

      try {
        const mqlRes = await fetch(
          new URL(`/api/hubspot-mqls?semana_desde=${sd}&semana_hasta=${sh}`, request.url).toString(),
          { cache: 'no-store' }
        )
        if (mqlRes.ok) {
          const mqlData = await mqlRes.json()
          if (!mqlData.mock) {
            por_origen = (mqlData.por_origen || []).map(o => ({ origen: o.origen, count: o.count, pct: o.pct }))
            breakdown_macro = mqlData.breakdown_macro || breakdown_macro
          }
        }
      } catch (e) {
        console.error(`Backfill fetch error for ${sd}:`, e.message)
      }

      enriched.push({ ...entry, por_origen, breakdown_macro })
      updated++
    }

    // Save updated history
    const sorted = enriched.sort((a, b) => b.id.localeCompare(a.id))
    await upstashSet(GDD_HISTORY_KEY, sorted)

    return NextResponse.json({ ok: true, updated, skipped, total: enriched.length })

  } catch (error) {
    console.error('Backfill error:', error.message)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
