'use client'
import { useState, useEffect, useRef, useCallback } from 'react'

const GDD_HISTORY_KEY = 'gdd_history'
const GDD_MANUAL_KEY = 'config:gdd-metrics'

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

// Storage helpers (inline para evitar dependencia circular)
async function storeGet(key) {
  try {
    const r = await fetch(`/api/storage?action=get&key=${encodeURIComponent(key)}`)
    const d = await r.json()
    if (!d.value) return null
    return typeof d.value === 'string' ? JSON.parse(d.value) : d.value
  } catch { return null }
}

const GDD_EMPTY = {
  semana: { leads: 0, mqls: 0, sqls: 0, opps: 0, pipeline_mkt: 0, pipeline_com: 0 },
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
 * - Google Sheets (via /api/gdd): Leads, SQLs, OPPs, Pipeline
 * - HubSpot (via /api/hubspot-mqls): Desglose de MQLs por origen
 * - Upstash (via /api/storage): Historial semanal
 *
 * Retorna:
 * - gddData: datos de la semana actual (Sheets como fuente principal)
 * - mqlBreakdown: desglose de MQLs por origen (HubSpot)
 * - history: historial semanal
 * - loading: true mientras carga
 * - error: mensaje de error si hay
 * - refetch: funcion para recargar datos
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
      // 1. Fetch Google Sheets — fuente autoritativa para Leads, SQLs, OPPs
      let sheetsData = null
      try {
        const res = await fetchWithTimeout('/api/gdd', {}, 10000)
        if (res.ok) {
          const data = await res.json()
          const hasData = !data.error && (
            (data.semana?.leads > 0) ||
            (data.semana?.mqls > 0) ||
            (data.semana?.sqls > 0) ||
            (data.semana?.opps > 0) ||
            (data.semana?.pipeline_mkt > 0)
          )
          if (hasData) sheetsData = data
        }
      } catch (err) {
        console.warn('GdD Sheets fetch error:', err.message)
      }

      // 2. Si no hay datos de Sheets, intentar override manual
      if (!sheetsData) {
        const manual = await storeGet(GDD_MANUAL_KEY)
        if (manual && Object.keys(manual).length > 0) {
          sheetsData = { ...manual, source: 'manual' }
        }
      }

      // 3. Si seguimos sin datos, usar GDD_EMPTY
      const finalData = sheetsData || GDD_EMPTY
      setGddData(finalData)

      // 4. Fetch HubSpot MQLs por origen — solo si tenemos fechas
      if (finalData.fechas?.semana_desde) {
        const sd = finalData.fechas.semana_desde
        const sh = finalData.fechas.semana_hasta || sd
        try {
          const mqlRes = await fetchWithTimeout(
            `/api/hubspot-mqls?semana_desde=${encodeURIComponent(sd)}&semana_hasta=${encodeURIComponent(sh)}`,
            {}, 10000
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
      }

      // 5. Fetch historial desde Upstash
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
