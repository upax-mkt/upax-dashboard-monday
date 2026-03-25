import { NextResponse } from 'next/server'

const COMMITMENTS_KEY = 'upax_commitments'

// In-memory fallback for dev / when KV is not connected
let memStore = []

export async function GET() {
  try {
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      const { kv } = await import('@vercel/kv')
      const data = await kv.get(COMMITMENTS_KEY)
      return NextResponse.json({ commitments: data || [] })
    }
    return NextResponse.json({ commitments: memStore })
  } catch (error) {
    return NextResponse.json({ commitments: memStore })
  }
}

export async function POST(request) {
  try {
    const body = await request.json()
    const { commitments } = body

    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      const { kv } = await import('@vercel/kv')
      await kv.set(COMMITMENTS_KEY, commitments)
    } else {
      memStore = commitments
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
