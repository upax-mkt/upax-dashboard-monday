import { NextResponse } from 'next/server'

// In-memory fallback cuando no hay KV conectado (dev/preview sin KV)
const memStore = new Map()

async function getKV() {
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    const { kv } = await import('@vercel/kv')
    return kv
  }
  return null
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')
  const key = searchParams.get('key')
  const prefix = searchParams.get('prefix')

  try {
    const kv = await getKV()

    if (action === 'get' && key) {
      const val = kv ? await kv.get(key) : memStore.get(key) ?? null
      return NextResponse.json({ value: val })
    }

    if (action === 'list' && prefix !== null) {
      if (kv) {
        // Scan keys with prefix
        const keys = []
        let cursor = 0
        do {
          const result = await kv.scan(cursor, { match: prefix + '*', count: 100 })
          cursor = result[0]
          keys.push(...result[1])
        } while (cursor !== 0)
        return NextResponse.json({ keys })
      } else {
        // In-memory fallback
        const keys = [...memStore.keys()].filter(k => k.startsWith(prefix))
        return NextResponse.json({ keys })
      }
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const { action, key, value } = await request.json()
    const kv = await getKV()

    if (action === 'set' && key) {
      if (kv) {
        await kv.set(key, value, { ex: 60 * 60 * 24 * 90 }) // 90 días TTL
      } else {
        memStore.set(key, value)
      }
      return NextResponse.json({ success: true })
    }

    if (action === 'delete' && key) {
      if (kv) {
        await kv.del(key)
      } else {
        memStore.delete(key)
      }
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
