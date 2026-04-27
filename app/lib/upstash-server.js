// Shared Upstash/Redis REST helpers for API routes
// Reads credentials from process.env on each call

export async function upstashGet(key) {
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

export async function upstashSet(key, value, ttlSeconds) {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return
  try {
    const serialized = JSON.stringify(value)
    await fetch(
      `${url}/set/${encodeURIComponent(key)}/${encodeURIComponent(serialized)}${ttlSeconds ? `/ex/${ttlSeconds}` : ''}`,
      { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }
    )
  } catch (e) { console.error('Cache set error:', e.message) }
}

// Low-level command helper for cron/backfill routes that need SET with EX as separate args
export async function upstashCommand(command, ...args) {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
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
