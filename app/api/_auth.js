// Shared auth validation for API routes
// Returns null if authorized, or a NextResponse error if not
import { NextResponse } from 'next/server'

export function validateAuth(request) {
  const secret = process.env.API_SECRET
  if (!secret) {
    if (process.env.NODE_ENV === 'development') return null
    return NextResponse.json(
      { error: 'Server misconfiguration: API_SECRET not set' },
      { status: 500 }
    )
  }
  const authHeader = request.headers.get('authorization')
  if (!authHeader || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}
