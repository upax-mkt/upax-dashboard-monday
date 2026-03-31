'use client'
// lib/api.js — data layer hacia Next.js API routes
import { MONDAY_USERS } from './constants'

export async function fetchAllItems() {
  try {
    const res = await fetch('/api/monday', { cache: 'no-store' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    if (data.error) throw new Error(data.error)
    return data.items || []
  } catch (e) {
    console.error('fetchAllItems error:', e)
    return []
  }
}

export async function createMondayItem(name, dateStr, personName) {
  try {
    const userId = personName ? MONDAY_USERS[personName] : null
    const res = await fetch('/api/monday-write', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, dateStr, personId: userId }),
    })
    const data = await res.json()
    return data.success === true
  } catch { return false }
}

export async function sendToSlack(text) {
  try {
    const res = await fetch('/api/slack', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
    const data = await res.json()
    return data.success === true
  } catch { return false }
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 5: MINUTA GENERATOR
   ═══════════════════════════════════════════════════════════════ */
