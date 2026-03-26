import { NextResponse } from 'next/server'

// In-memory fallback cuando no hay Upstash configurado
const memStore = new Map()

// Cliente Upstash REST — sin SDK, fetch directo a la REST API
// Compatible con UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
// que Vercel inyecta automáticamente al conectar Upstash desde el Marketplace
async function upstash(command, ...args) {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null // sin config → fallback a memoria

  const res = await fetch(`${url}/${[command, ...args.map(a => encodeURIComponent(a))].join('/')}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Upstash ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return data.result
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
        // Fallback a memoria
        const memVal = memStore.get(key) ?? null
        return NextResponse.json({ value: memVal })
      }
      // Upstash devuelve el valor como string JSON — parsear
      let val = result
      try { val = JSON.parse(result) } catch {}
      return NextResponse.json({ value: val })
    }

    if (action === 'list' && prefix !== null) {
      const result = await upstash('KEYS', `${prefix}*`)
      if (result === null) {
        // Fallback a memoria
        const keys = [...memStore.keys()].filter(k => k.startsWith(prefix))
        return NextResponse.json({ keys })
      }
      return NextResponse.json({ keys: result || [] })
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
      // Serializar value a string para Upstash
      const serialized = typeof value === 'string' ? value : JSON.stringify(value)
      // TTL: 365 días (minutas persisten 1 año)
      const result = await upstash('SET', key, serialized, 'EX', String(60 * 60 * 24 * 365))
      if (result === null) {
        // Fallback a memoria
        memStore.set(key, value)
      }
      return NextResponse.json({ success: true })
    }

    if (action === 'delete' && key) {
      const result = await upstash('DEL', key)
      if (result === null) {
        memStore.delete(key)
      }
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Storage POST error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
