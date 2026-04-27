import { NextResponse } from 'next/server'
import { upstashGet, upstashSet } from '../../lib/upstash-server'

export const dynamic = 'force-dynamic'

const GDD_HISTORY_KEY = 'gdd_history'

export async function GET(request) {
  // Proteger endpoint — requiere CRON_SECRET (mismo esquema que gdd-weekly-save)
  const auth = request.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const internalAuth = process.env.API_SECRET ? { 'Authorization': `Bearer ${process.env.API_SECRET}` } : {}

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
          { cache: 'no-store', headers: internalAuth }
        )
        if (mqlRes.ok) {
          const mqlData = await mqlRes.json()
          por_origen = (mqlData.por_origen || []).map(o => ({ origen: o.origen, count: o.count, pct: o.pct }))
          breakdown_macro = mqlData.breakdown_macro || breakdown_macro
        }
      } catch (e) {
        console.error(`Backfill fetch error for ${sd}:`, e.message)
      }

      enriched.push({ ...entry, por_origen, breakdown_macro })
      updated++
    }

    // Save updated history
    const sorted = enriched.sort((a, b) => b.id.localeCompare(a.id))
    await upstashSet(GDD_HISTORY_KEY, sorted, 60 * 60 * 24 * 365)

    return NextResponse.json({ ok: true, updated, skipped, total: enriched.length })

  } catch (error) {
    console.error('Backfill error:', error.message)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
