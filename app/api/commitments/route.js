import { NextResponse } from 'next/server'
import { validateAuth } from '../_auth'

// Commitments route — Upstash REST directo, sin dependencias externas
const COMMITMENTS_KEY = 'upax_commitments'

async function upstash(command, ...args) {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  const encoded = args.map(a => encodeURIComponent(String(a)))
  const res = await fetch(`${url}/${[command, ...encoded].join('/')}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!res.ok) return null
  const data = await res.json()
  return data.result ?? null
}

export async function GET(request) {
  const authErr = validateAuth(request)
  if (authErr) return authErr

  try {
    const data = await upstash('GET', COMMITMENTS_KEY)
    const commitments = data
      ? (typeof data === 'string' ? JSON.parse(data) : data)
      : []
    return NextResponse.json({ commitments })
  } catch {
    return NextResponse.json({ commitments: [] })
  }
}

export async function POST(request) {
  const authErr = validateAuth(request)
  if (authErr) return authErr

  try {
    const { commitments } = await request.json()
    await upstash('SET', COMMITMENTS_KEY, JSON.stringify(commitments), 'EX', String(60 * 60 * 24 * 365))
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
