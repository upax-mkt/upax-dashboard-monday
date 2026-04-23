'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { storeGet } from '../lib/storage'

const GDD_HISTORY_KEY = 'gdd_history'

const authHeadersGet = () => ({
  ...(process.env.NEXT_PUBLIC_API_SECRET ? { 'Authorization': `Bearer ${process.env.NEXT_PUBLIC_API_SECRET}` } : {}),
})

// Helper: fetch con timeout
async function fetchWithTimeout(url, opts = {}, timeoutMs = 10000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal, cache: 'no-store' })
    clearTimeout(timer)
    return res
  } catch (err) {
    clearTimeout(timer)
    throw err
  }
}

// Calculate current ISO week dates (Monday-Sunday) locally
function getCurrentWeekDates() {
  const now = new Date()
  const dayOfWeek = now.getDay() || 7
  const monday = new Date(now)
  monday.setDate(now.getDate() - (dayOfWeek - 1))
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const fmt = (d) => d.toISOString().slice(0, 10)
  return { semana_desde: fmt(monday), semana_hasta: fmt(sunday) }
}

const GDD_EMPTY = {
  semana: { leads: 0, mqls: 0, sqls: 0, opps: 0 },
  anterior: { leads: 0, mqls: 0, sqls: 0, opps: 0 },
  mes: { leads: 0, mqls: 0, sqls: 0, opps: 0 },
  ytd: { leads: 0, mqls: 0, sqls: 0, opps: 0 },
  fechas: {},
  source: 'empty',
}

/**
 * useGDDData — Hook unificado para datos de Generacion de Demanda
 *
 * Fuentes autoritativas:
 * - HubSpot (via /api/gdd-hubspot): Leads, MQLs, SQLs, OPPs en tiempo real
 * - HubSpot (via /api/hubspot-mqls): Desglose de MQLs por origen/canal
 * - Upstash (via /api/storage): Historial semanal
 */
export function useGDDData() {
  const [gddData, setGddData] = useState(null)
  const [mqlBreakdown, setMqlBreakdown] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const fetchedRef = useRef(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // 1. Fetch HubSpot — fuente autoritativa para Leads, MQLs, SQLs, OPPs
      let hubspotData = null
      try {
        const res = await fetchWithTimeout('/api/gdd-hubspot', { headers: authHeadersGet() }, 15000)
        if (res.ok) {
          const data = await res.json()
          if (!data.error) hubspotData = data
        }
      } catch (err) {
        console.warn('GdD HubSpot fetch error:', err.message)
      }

      const finalData = hubspotData || GDD_EMPTY
      setGddData(finalData)

      // 2. Fetch HubSpot MQLs por origen — usar fechas de respuesta o calcular localmente
      const weekDates = finalData.fechas?.semana_desde
        ? { semana_desde: finalData.fechas.semana_desde, semana_hasta: finalData.fechas.semana_hasta }
        : getCurrentWeekDates()

      try {
        const mqlRes = await fetchWithTimeout(
          `/api/hubspot-mqls?semana_desde=${encodeURIComponent(weekDates.semana_desde)}&semana_hasta=${encodeURIComponent(weekDates.semana_hasta)}`,
          { headers: authHeadersGet() }, 10000
        )
        if (mqlRes.ok) {
          const mqlData = await mqlRes.json()
          if (!mqlData.error) {
            setMqlBreakdown(mqlData)
          }
        }
      } catch (err) {
        console.warn('HubSpot MQLs fetch error:', err.message)
      }

      // 3. Fetch historial desde Upstash
      try {
        const hist = await storeGet(GDD_HISTORY_KEY)
        setHistory(Array.isArray(hist) ? hist : [])
      } catch {
        setHistory([])
      }

    } catch (err) {
      console.error('useGDDData error:', err.message)
      setError(err.message)
      setGddData(GDD_EMPTY)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (fetchedRef.current) return
    fetchedRef.current = true
    fetchAll()
  }, [fetchAll])

  return {
    gddData,
    mqlBreakdown,
    history,
    setHistory,
    loading,
    error,
    refetch: fetchAll,
  }
}
