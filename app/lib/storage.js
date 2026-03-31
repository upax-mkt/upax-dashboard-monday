'use client'
// lib/storage.js — Upstash Redis via /api/storage

export async function storeGet(key) {
  try {
    const r = await fetch(`/api/storage?action=get&key=${encodeURIComponent(key)}`)
    const d = await r.json()
    if (!d.value) return null
    return typeof d.value === 'string' ? JSON.parse(d.value) : d.value
  } catch { return null }
}
export async function storeSet(key, val) {
  try {
    await fetch('/api/storage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'set', key, value: JSON.stringify(val) }),
    })
  } catch {}
}
export async function storeDel(key) {
  try {
    await fetch('/api/storage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', key }),
    })
  } catch {}
}
export async function storeList(prefix) {
  try {
    const r = await fetch(`/api/storage?action=list&prefix=${encodeURIComponent(prefix)}`)
    const d = await r.json()
    if (d.keys?.length > 0) return d.keys
  } catch {}
  // Fallback: scan last 8 Mondays — usar addDays() para respetar timezone local (P2.2)
  const candidates = Array.from({ length: 8 }, (_, i) => {
    const dateStr = addDays(TODAY_STR, -i * 7)
    return `weekly:${dateStr}`
  })
  const results = await Promise.all(candidates.map(async (k) => {
    const v = await storeGet(k); return v ? k : null
  }))
  return results.filter(Boolean)
}
export async function storeGetRaw(key) {
  try {
    const r = await fetch(`/api/storage?action=get&key=${encodeURIComponent(key)}`)
    const d = await r.json()
    return d.value ? (typeof d.value === 'string' ? d.value : JSON.stringify(d.value)) : null
  } catch { return null }
}
export async function storeSetRaw(key, val) {
  try {
    await fetch('/api/storage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'set', key, value: val }),
    })
  } catch {}
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 4: DATA LAYER — Next.js API routes
   Reemplaza MCP calls por fetch directo a rutas propias
   ═══════════════════════════════════════════════════════════════ */
