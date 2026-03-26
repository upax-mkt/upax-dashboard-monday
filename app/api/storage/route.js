import { NextResponse } from 'next/server'

// In-memory fallback cuando no hay KV configurado
const memStore = new Map()

// Upstash REST API — usa las variables que Vercel inyecta automáticamente
// al conectar Upstash desde el Marketplace:
// KV_REST_API_URL + KV_REST_API_TOKEN
async function upstash(command, ...args) {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null // sin config → fallback a memoria

  const encoded = args.map(a => encodeURIComponent(String(a)))
  const res = await fetch(`${url}/${[command, ...encoded].join('/')}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Upstash ${res.status}: ${text}`)
  }
  const data = await res.json()
  return data.result ?? null
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')
  const key = searchParams.get('key')
  const prefix = searchParams.get('prefix')

  try {
    if (action === 'get' && key) {
      const result = await upstash('GET', key)
      if (result === null) {
        return NextResponse.json({ value: memStore.get(key) ?? null })
      }
      // Upstash devuelve strings — parsear JSON si es posible
      let val = result
      if (typeof val === 'string') {
        try { val = JSON.parse(val) } catch {}
      }
      return NextResponse.json({ value: val })
    }

    if (action === 'list' && prefix !== null) {
      const result = await upstash('KEYS', `${prefix}*`)
      if (result === null) {
        const keys = [...memStore.keys()].filter(k => k.startsWith(prefix))
        return NextResponse.json({ keys })
      }
      return NextResponse.json({ keys: Array.isArray(result) ? result : [] })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Storage GET error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const { action, key, value } = await request.json()

    if (action === 'set' && key) {
      const serialized = typeof value === 'string' ? value : JSON.stringify(value)
      // TTL: 365 días — minutas persisten 1 año
      const result = await upstash('SET', key, serialized, 'EX', String(60 * 60 * 24 * 365))
      if (result === null) memStore.set(key, value)
      return NextResponse.json({ success: true })
    }

    if (action === 'delete' && key) {
      const result = await upstash('DEL', key)
      if (result === null) memStore.delete(key)
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Storage POST error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
