'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { RefreshCw, Wifi, WifiOff, Clock, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════════ */

const TODAY_STR = new Date().toISOString().split('T')[0]
const TODAY = new Date(TODAY_STR)

const SQUADS = [
  { id: 'inbound', name: 'Inbound Studio', color: '#FF375F', lead: 'Jean Pierre' },
  { id: 'performance', name: 'Performance y Conversión', color: '#30D158', lead: 'Iris' },
  { id: 'revops', name: 'RevOps & Analytics', color: '#0A84FF', lead: 'César' },
  { id: 'portafolio', name: 'Portafolio y Ecosistema', color: '#FF2D97', lead: 'David' },
  { id: 'outbound', name: 'Outbound y Pipeline', color: '#FFD60A', lead: 'Ileana' },
]

const SQUAD_ALIASES = {
  'REVOPS Y ANALITYCS': 'RevOps & Analytics',
  'REVOPS Y ANALYTICS': 'RevOps & Analytics',
  'RevOps': 'RevOps & Analytics',
  'Portafolio y ecosistema': 'Portafolio y Ecosistema',
  'PR & Brand': 'Portafolio y Ecosistema',
  'Mkt Digital': 'Performance y Conversión',
  'Squad 1': 'Inbound Studio',
  'Squad 2': 'Portafolio y Ecosistema',
  'Squad 3': 'Performance y Conversión',
}

const PHASES = {
  '⏳Backlog': '#475569',
  '🚧 Sprint': '#F59E0B',
  '👀 Review': '#06B6D4',
  '⚙️ Modificación': '#A855F7',
  '✅ Done': '#22C55E',
  '🚫 Detenido': '#EF4444',
}

const AGENDA = [
  { id: 'apertura', label: 'Apertura CMO', presenter: 'Franco', start: 0, dur: 5 },
  { id: 'panorama', label: 'Panorama Semanal', presenter: 'Víctor', start: 5, dur: 10 },
  { id: 'inbound', label: 'Inbound Studio', presenter: 'Jean Pierre', start: 15, dur: 5 },
  { id: 'performance', label: 'Performance y Conversión', presenter: 'Iris', start: 20, dur: 5 },
  { id: 'revops', label: 'RevOps & Analytics', presenter: 'César', start: 25, dur: 5 },
  { id: 'portafolio', label: 'Portafolio y Ecosistema', presenter: 'David', start: 30, dur: 5 },
  { id: 'outbound', label: 'Outbound y Pipeline', presenter: 'Ileana', start: 35, dur: 5 },
  { id: 'cross', label: 'Cross-Squad', presenter: 'Todos los líderes', start: 40, dur: 10 },
  { id: 'cierre', label: 'Compromisos y Cierre', presenter: 'Víctor + Franco', start: 50, dur: 10 },
]

/* ═══════════════════════════════════════════════════════════════
   UTILITIES
═══════════════════════════════════════════════════════════════ */

function normalizeSquad(raw) {
  if (!raw) return null
  return SQUAD_ALIASES[raw] || raw
}

function parseTL(t) {
  if (!t || typeof t !== 'string') return { start: null, end: null }
  const p = t.split(' - ')
  return { start: p[0] ? new Date(p[0]) : null, end: p[1] ? new Date(p[1]) : null }
}

function daysDiff(a, b) { return Math.round((a - b) / 86400000) }

function getWeekBounds() {
  const now = new Date(TODAY_STR)
  const day = now.getDay()
  const nextMon = new Date(now)
  if (day === 1) { /* today is Monday */ }
  else if (day === 0) nextMon.setDate(now.getDate() + 1)
  else nextMon.setDate(now.getDate() + (8 - day))
  const fri = new Date(nextMon)
  fri.setDate(nextMon.getDate() + 4)
  return { start: nextMon, end: fri }
}

const WEEK = getWeekBounds()

function overlapsThisWeek(timelineStr) {
  if (!timelineStr) return false
  const tl = parseTL(timelineStr)
  if (!tl.start || !tl.end) return false
  return tl.start <= WEEK.end && tl.end >= WEEK.start
}

function isActive(ph) { return ['🚧 Sprint', '👀 Review', '⚙️ Modificación'].includes(ph) }

function isOverdue(it) {
  const ph = getColValue(it, 'color_mkz09na')
  if (ph === '✅ Done' || ph === '🚫 Detenido') return false
  const tl = parseTL(getColValue(it, 'timerange_mkzcqv0j'))
  return tl.end ? tl.end < TODAY : false
}

function getColValue(item, colId) {
  if (!item?.column_values) return null
  const col = item.column_values.find(c => c.id === colId)
  if (!col) return null
  if (col.text) return col.text
  if (col.value) {
    try {
      const p = JSON.parse(col.value)
      return p?.label?.text || p?.text || p?.name || null
    } catch {}
  }
  return null
}

function shortName(n) { return (n || '—').split(' ').slice(0, 2).join(' ') }

function pctColor(pct) { return pct >= 80 ? '#22C55E' : pct >= 50 ? '#F59E0B' : '#EF4444' }

/* ═══════════════════════════════════════════════════════════════
   ANALYSIS ENGINE
═══════════════════════════════════════════════════════════════ */

function analyze(items) {
  const byPhase = {}, bySquad = {}, byPersonWeek = {}, overdue = [], noCrono = [], stoppedWeek = [], backlogWithDates = []

  items.forEach(it => {
    const ph = getColValue(it, 'color_mkz09na') || '?'
    const sqRaw = getColValue(it, 'color_mkz0s203')
    const sq = normalizeSquad(sqRaw) || '?'
    const pr = getColValue(it, 'person')
    const timeline = getColValue(it, 'timerange_mkzcqv0j')
    const isThisWeek = overlapsThisWeek(timeline)

    byPhase[ph] = (byPhase[ph] || 0) + 1
    if (!bySquad[sq]) bySquad[sq] = { total: 0, phases: {} }
    bySquad[sq].total++
    bySquad[sq].phases[ph] = (bySquad[sq].phases[ph] || 0) + 1

    if (isActive(ph) && isThisWeek) {
      const touched = new Set()
      if (pr) pr.split(', ').forEach(p => touched.add(p.trim()))
      ;(it.subitems || []).forEach(s => {
        const sp = getColValue(s, 'person')
        if (sp) sp.split(', ').forEach(p => touched.add(p.trim()))
      })
      touched.forEach(p => {
        if (!p) return
        if (!byPersonWeek[p]) byPersonWeek[p] = { items: 0, stopped: 0, total: 0 }
        byPersonWeek[p].items++
        byPersonWeek[p].total++
      })
    }

    if (ph === '🚫 Detenido' && isThisWeek) {
      stoppedWeek.push(it)
      const touched = new Set()
      if (pr) pr.split(', ').forEach(p => touched.add(p.trim()))
      touched.forEach(p => {
        if (!p) return
        if (!byPersonWeek[p]) byPersonWeek[p] = { items: 0, stopped: 0, total: 0 }
        byPersonWeek[p].stopped++
        byPersonWeek[p].total++
      })
    }

    if (ph === '⏳Backlog' && timeline) backlogWithDates.push(it)
    if (isOverdue(it)) overdue.push(it)
    if (ph === '🚧 Sprint' && !timeline) noCrono.push(it)
  })

  return { byPhase, bySquad, byPersonWeek, overdue, noCrono, stoppedWeek, backlogWithDates }
}

/* ═══════════════════════════════════════════════════════════════
   SHARED UI
═══════════════════════════════════════════════════════════════ */

function KPICard({ label, value, color, sub }) {
  return (
    <div style={{ background: '#1C1C1E', border: '1px solid #2C2C2E', borderLeft: `3px solid ${color}`, borderRadius: 12, padding: '16px 18px', flex: '1 1 120px' }}>
      <div style={{ fontSize: 10, color: '#8E8E93', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8, fontFamily: 'monospace' }}>{label}</div>
      <div style={{ fontFamily: 'monospace', fontSize: 36, fontWeight: 800, color, lineHeight: 1, letterSpacing: '-0.04em' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#636366', marginTop: 6 }}>{sub}</div>}
    </div>
  )
}

function PhaseBar({ items }) {
  const counts = {}
  items.forEach(it => {
    const ph = getColValue(it, 'color_mkz09na') || '?'
    counts[ph] = (counts[ph] || 0) + 1
  })
  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  if (!total) return null
  return (
    <div>
      <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', height: 18, background: '#2C2C2E' }}>
        {Object.entries(PHASES).map(([ph, c]) => {
          const v = counts[ph] || 0
          if (!v) return null
          return (
            <div key={ph} title={`${ph}: ${v}`} style={{ width: `${(v / total) * 100}%`, background: c, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff', minWidth: 14, fontFamily: 'monospace' }}>
              {v > 2 ? v : ''}
            </div>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
        {Object.entries(PHASES).map(([ph, c]) => counts[ph] ? (
          <div key={ph} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#8E8E93' }}>
            <div style={{ width: 7, height: 7, borderRadius: 2, background: c }} />
            {ph}: <strong style={{ color: '#fff' }}>{counts[ph]}</strong>
          </div>
        ) : null)}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   TAB: HOME
═══════════════════════════════════════════════════════════════ */

function TabHome({ items, an }) {
  const [expandedPerson, setExpandedPerson] = useState(null)
  const activeCount = (an.byPhase['🚧 Sprint'] || 0) + (an.byPhase['👀 Review'] || 0) + (an.byPhase['⚙️ Modificación'] || 0)
  const sortedPeople = Object.entries(an.byPersonWeek).sort((a, b) => b[1].total - a[1].total)
  const stoppedSquads = SQUADS.filter(sq => an.bySquad[sq.name]?.phases['🚫 Detenido'] > 0)

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <KPICard label="Activos" value={activeCount} color="#F8FAFC" />
        <KPICard label="Vencidos" value={an.overdue.length} color={an.overdue.length > 0 ? '#EF4444' : '#22C55E'} sub={an.overdue.length > 0 ? 'Requieren atención' : 'En tiempo'} />
        <KPICard label="Detenidos" value={an.byPhase['🚫 Detenido'] || 0} color={(an.byPhase['🚫 Detenido'] || 0) > 0 ? '#F59E0B' : '#22C55E'} />
        <KPICard label="Done" value={an.byPhase['✅ Done'] || 0} color="#22C55E" sub="Completados 2026" />
      </div>

      {/* Distribución por fase */}
      <div style={{ background: '#1C1C1E', border: '1px solid #2C2C2E', borderRadius: 12, padding: '16px 18px', marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Distribución por Fase</div>
        <PhaseBar items={items} />
      </div>

      {/* Carga semanal */}
      <div style={{ background: '#1C1C1E', border: '1px solid #2C2C2E', borderRadius: 12, padding: '16px 18px', marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>👥 Carga del Equipo</div>
        <div style={{ fontSize: 11, color: '#636366', marginBottom: 10 }}>
          Proyectos activos esta semana · {WEEK.start.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })} – {WEEK.end.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
        </div>
        {sortedPeople.length === 0
          ? <div style={{ color: '#636366', fontSize: 12, textAlign: 'center', padding: '16px 0' }}>No hay items con cronograma esta semana</div>
          : sortedPeople.map(([person, d], i) => {
            const open = expandedPerson === person
            return (
              <div key={person}>
                <div onClick={() => setExpandedPerson(open ? null : person)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px', borderRadius: 8, marginBottom: 2, cursor: 'pointer', background: open ? '#2C2C2E' : d.total > 8 ? 'rgba(239,68,68,.08)' : 'transparent' }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#636366', minWidth: 16 }}>{i + 1}</span>
                  <span style={{ flex: 1, fontSize: 12, fontWeight: 600 }}>{shortName(person)} {d.total > 8 && '⚠️'}</span>
                  <span style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 700, color: d.total > 8 ? '#EF4444' : '#fff', minWidth: 24, textAlign: 'right' }}>{d.total}</span>
                  {d.stopped > 0
                    ? <span style={{ fontSize: 10, color: '#636366' }}><span style={{ color: '#fff' }}>{d.items} activos</span> + <span style={{ color: '#EF4444' }}>{d.stopped} 🚫</span></span>
                    : <span style={{ fontSize: 10, color: '#636366' }}>proy</span>}
                  {open ? <ChevronUp size={12} color="#636366" /> : <ChevronDown size={12} color="#636366" />}
                </div>
                {open && (
                  <div style={{ padding: '4px 8px 8px 32px', fontSize: 11, color: '#8E8E93' }}>
                    {items.filter(it => isActive(getColValue(it, 'color_mkz09na')) && overlapsThisWeek(getColValue(it, 'timerange_mkzcqv0j')) && getColValue(it, 'person')?.includes(person)).slice(0, 5).map((it, j) => (
                      <div key={j} style={{ display: 'flex', gap: 6, padding: '2px 0' }}>
                        <div style={{ width: 5, height: 5, borderRadius: '50%', background: PHASES[getColValue(it, 'color_mkz09na')] || '#555', marginTop: 4, flexShrink: 0 }} />
                        <span>{it.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
      </div>

      {/* Alertas */}
      <div style={{ background: '#1C1C1E', border: '1px solid #2C2C2E', borderRadius: 12, padding: '16px 18px' }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>⚡ Alertas Ejecutivas</div>
        {an.overdue.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#EF4444', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>🔴 Top vencidos ({an.overdue.length})</div>
            {an.overdue.slice(0, 5).map(it => {
              const tl = parseTL(getColValue(it, 'timerange_mkzcqv0j'))
              const d = tl.end ? daysDiff(TODAY, tl.end) : 0
              return (
                <div key={it.id} style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '3px 0', fontSize: 11 }}>
                  <span style={{ fontFamily: 'monospace', color: '#EF4444', fontWeight: 700, minWidth: 32 }}>-{d}d</span>
                  <span style={{ flex: 1, color: '#8E8E93', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.name}</span>
                  <span style={{ color: '#636366', fontSize: 10 }}>{shortName(getColValue(it, 'person'))}</span>
                </div>
              )
            })}
          </div>
        )}
        {stoppedSquads.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#F59E0B', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>⚠️ Squads con detenidos</div>
            {stoppedSquads.map(sq => (
              <div key={sq.id} style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '3px 0', fontSize: 12 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: sq.color }} />
                <span style={{ color: sq.color, fontWeight: 600 }}>{sq.name}</span>
                <span style={{ color: '#636366' }}>— {an.bySquad[sq.name]?.phases['🚫 Detenido']} detenido(s)</span>
              </div>
            ))}
          </div>
        )}
        {an.stoppedWeek.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#EF4444', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>🚫 Detenidos con fecha esta semana · {an.stoppedWeek.length}</div>
            {an.stoppedWeek.map(it => (
              <div key={it.id} style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '3px 0', fontSize: 11 }}>
                <span style={{ flex: 1, color: '#8E8E93', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.name}</span>
                <span style={{ color: '#636366', fontSize: 10 }}>{shortName(getColValue(it, 'person'))}</span>
              </div>
            ))}
          </div>
        )}
        {an.noCrono.length > 0 && (
          <div style={{ fontSize: 11, color: '#F59E0B' }}>⚠️ {an.noCrono.length} items en Sprint sin Cronograma</div>
        )}
        {an.overdue.length === 0 && stoppedSquads.length === 0 && an.stoppedWeek.length === 0 && (
          <div style={{ textAlign: 'center', padding: '16px 0', color: '#22C55E', fontSize: 13, fontWeight: 600 }}>✅ Sin alertas críticas</div>
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   TAB: AGENDA
═══════════════════════════════════════════════════════════════ */

function TabAgenda({ elapsed }) {
  const eMin = elapsed / 60
  return (
    <div>
      {AGENDA.map((b, i) => {
        const isCur = eMin >= b.start && eMin < b.start + b.dur
        const isPast = eMin > b.start + b.dur
        return (
          <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, marginBottom: 3, background: isCur ? 'rgba(255,255,255,.05)' : 'transparent', opacity: isPast ? 0.4 : 1, border: isCur ? '1px solid rgba(255,255,255,.1)' : '1px solid transparent' }}>
            <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#636366', minWidth: 38, fontSize: 11 }}>{String(b.start).padStart(2, '0')}:00</span>
            <div style={{ width: 3, height: 20, borderRadius: 2, background: isCur ? '#0A84FF' : isPast ? '#2C2C2E' : '#3A3A3C' }} />
            <span style={{ minWidth: 130, fontWeight: isCur ? 700 : 500, fontSize: 13, color: isCur ? '#fff' : '#8E8E93' }}>{b.label}</span>
            <span style={{ flex: 1, fontSize: 12, color: '#636366' }}>{b.presenter}</span>
            <span style={{ fontFamily: 'monospace', color: '#636366', fontSize: 11 }}>{b.dur}'</span>
            {isPast && <span style={{ color: '#22C55E', fontSize: 12 }}>✓</span>}
          </div>
        )
      })}
      <div style={{ marginTop: 12, padding: 10, borderRadius: 8, background: '#1C1C1E', border: '1px solid #2C2C2E', fontSize: 11, color: '#636366', textAlign: 'center' }}>
        +2 min de discusión → "lo sacamos offline" · Compromiso = Qué + Quién + Cuándo
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   TAB: PANORAMA
═══════════════════════════════════════════════════════════════ */

function TabPanorama({ items, an }) {
  const [sec, setSec] = useState('squads')
  const sections = ['squads', 'carga', 'vencidos']

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap' }}>
        {sections.map(s => (
          <button key={s} onClick={() => setSec(s)} style={{ background: sec === s ? '#0A84FF' : '#1C1C1E', color: sec === s ? '#fff' : '#8E8E93', border: sec === s ? 'none' : '1px solid #2C2C2E', borderRadius: 20, padding: '6px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {sec === 'squads' && SQUADS.map(sq => {
        const d = an.bySquad[sq.name]
        if (!d) return null
        const act = (d.phases['🚧 Sprint'] || 0) + (d.phases['👀 Review'] || 0) + (d.phases['⚙️ Modificación'] || 0)
        const total = Object.values(d.phases).reduce((a, b) => a + b, 0)
        return (
          <div key={sq.id} style={{ background: '#1C1C1E', border: '1px solid #2C2C2E', borderLeft: `3px solid ${sq.color}`, borderRadius: 12, padding: '14px 16px', marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: sq.color }}>{sq.name}</span>
              <span style={{ fontSize: 11, color: '#636366' }}>{act} activos · {total} total</span>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {Object.entries(PHASES).map(([ph, c]) => d.phases[ph] ? (
                <div key={ph} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                  <div style={{ width: 7, height: 7, borderRadius: 2, background: c }} />
                  <span style={{ color: '#8E8E93' }}>{ph.replace(/[^\w\s]/g, '').trim()}: <strong style={{ color: '#fff' }}>{d.phases[ph]}</strong></span>
                </div>
              ) : null)}
            </div>
          </div>
        )
      })}

      {sec === 'carga' && (
        <div>
          <div style={{ fontSize: 11, color: '#636366', marginBottom: 10 }}>
            Carga por persona · semana {WEEK.start.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })} – {WEEK.end.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
          </div>
          {Object.entries(an.byPersonWeek).sort((a, b) => b[1].total - a[1].total).map(([p, d]) => (
            <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, marginBottom: 3, background: d.total > 8 ? 'rgba(239,68,68,.08)' : '#1C1C1E', border: '1px solid #2C2C2E' }}>
              <span style={{ flex: 1, fontSize: 12, fontWeight: 600 }}>{shortName(p)} {d.total > 8 && '⚠️'}</span>
              <span style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 700, color: d.total > 8 ? '#EF4444' : '#fff' }}>{d.total}</span>
              {d.stopped > 0 && <span style={{ fontSize: 10, color: '#EF4444' }}>{d.stopped}🚫</span>}
            </div>
          ))}
          {Object.keys(an.byPersonWeek).length === 0 && <div style={{ textAlign: 'center', color: '#636366', fontSize: 12, padding: '20px 0' }}>No hay items con cronograma esta semana</div>}
        </div>
      )}

      {sec === 'vencidos' && (
        <div>
          {an.overdue.length === 0
            ? <div style={{ textAlign: 'center', color: '#22C55E', fontSize: 13, padding: '20px 0' }}>✅ Sin items vencidos</div>
            : an.overdue.sort((a, b) => (parseTL(getColValue(a, 'timerange_mkzcqv0j')).end || TODAY) - (parseTL(getColValue(b, 'timerange_mkzcqv0j')).end || TODAY)).map(it => {
              const tl = parseTL(getColValue(it, 'timerange_mkzcqv0j'))
              const d = tl.end ? daysDiff(TODAY, tl.end) : 0
              const sq = normalizeSquad(getColValue(it, 'color_mkz0s203'))
              const sqData = SQUADS.find(s => s.name === sq)
              return (
                <div key={it.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 10px', borderRadius: 8, marginBottom: 4, background: '#1C1C1E', border: '1px solid #2C2C2E' }}>
                  <span style={{ fontFamily: 'monospace', color: '#EF4444', fontWeight: 700, minWidth: 36, fontSize: 11 }}>-{d}d</span>
                  <span style={{ flex: 1, fontSize: 12, color: '#8E8E93', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.name}</span>
                  {sqData && <div style={{ width: 6, height: 6, borderRadius: '50%', background: sqData.color, flexShrink: 0 }} />}
                  <span style={{ fontSize: 10, color: '#636366', flexShrink: 0 }}>{shortName(getColValue(it, 'person'))}</span>
                </div>
              )
            })}
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   TAB: COMPROMISOS
═══════════════════════════════════════════════════════════════ */

function TabCompromisos() {
  const [commitments, setCommitments] = useState([])
  const [newItem, setNewItem] = useState({ text: '', owner: '', date: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/commitments')
      .then(r => r.json())
      .then(d => { setCommitments(d.commitments || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const save = async (updated) => {
    setSaving(true)
    try {
      await fetch('/api/commitments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commitments: updated }),
      })
    } finally { setSaving(false) }
  }

  const add = async () => {
    if (!newItem.text.trim()) return
    const updated = [...commitments, { id: Date.now(), ...newItem, done: false, createdAt: new Date().toISOString() }]
    setCommitments(updated)
    setNewItem({ text: '', owner: '', date: '' })
    await save(updated)
  }

  const toggle = async (id) => {
    const updated = commitments.map(c => c.id === id ? { ...c, done: !c.done } : c)
    setCommitments(updated)
    await save(updated)
  }

  const remove = async (id) => {
    const updated = commitments.filter(c => c.id !== id)
    setCommitments(updated)
    await save(updated)
  }

  if (loading) return <div style={{ textAlign: 'center', padding: '40px 0', color: '#636366' }}>Cargando...</div>

  const pending = commitments.filter(c => !c.done)
  const done = commitments.filter(c => c.done)

  const inputStyle = { background: '#2C2C2E', border: '1px solid #3A3A3C', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#fff', outline: 'none', fontFamily: 'inherit' }

  return (
    <div>
      <div style={{ background: '#1C1C1E', border: '1px solid #2C2C2E', borderRadius: 12, padding: '16px 18px', marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: '#636366', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Nuevo Compromiso</div>
        <input style={{ ...inputStyle, width: '100%', marginBottom: 8, boxSizing: 'border-box' }} placeholder="Descripción del compromiso..." value={newItem.text} onChange={e => setNewItem(p => ({ ...p, text: e.target.value }))} onKeyDown={e => e.key === 'Enter' && add()} />
        <div style={{ display: 'flex', gap: 8 }}>
          <input style={{ ...inputStyle, flex: 1 }} placeholder="Responsable" value={newItem.owner} onChange={e => setNewItem(p => ({ ...p, owner: e.target.value }))} />
          <input type="date" style={{ ...inputStyle, flex: 1 }} value={newItem.date} onChange={e => setNewItem(p => ({ ...p, date: e.target.value }))} />
          <button onClick={add} style={{ background: '#0A84FF', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{saving ? '...' : '+ Agregar'}</button>
        </div>
      </div>

      {pending.length > 0 && (
        <div style={{ background: '#1C1C1E', border: '1px solid #2C2C2E', borderRadius: 12, padding: '16px 18px', marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: '#636366', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Pendientes ({pending.length})</div>
          {pending.map(c => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0', borderBottom: '1px solid #2C2C2E' }}>
              <button onClick={() => toggle(c.id)} style={{ width: 16, height: 16, borderRadius: 4, border: '1px solid #3A3A3C', background: 'transparent', cursor: 'pointer', marginTop: 2, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: '#fff' }}>{c.text}</div>
                <div style={{ fontSize: 11, color: '#636366', marginTop: 3 }}>
                  {c.owner && <span>👤 {c.owner}</span>}
                  {c.owner && c.date && <span>  ·  </span>}
                  {c.date && <span>📅 {c.date}</span>}
                </div>
              </div>
              <button onClick={() => remove(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#636366', fontSize: 14 }}>✕</button>
            </div>
          ))}
        </div>
      )}

      {done.length > 0 && (
        <div style={{ background: '#1C1C1E', border: '1px solid #2C2C2E', borderRadius: 12, padding: '16px 18px', opacity: 0.5 }}>
          <div style={{ fontSize: 11, color: '#636366', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Completados ({done.length})</div>
          {done.map(c => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
              <button onClick={() => toggle(c.id)} style={{ width: 16, height: 16, borderRadius: 4, background: '#22C55E', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>✓</button>
              <span style={{ fontSize: 13, color: '#636366', textDecoration: 'line-through', flex: 1 }}>{c.text}</span>
              <button onClick={() => remove(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#636366', fontSize: 12 }}>✕</button>
            </div>
          ))}
        </div>
      )}

      {commitments.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#636366', fontSize: 13 }}>No hay compromisos registrados</div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   TIMER HOOK
═══════════════════════════════════════════════════════════════ */

function useTimer() {
  const [elapsed, setElapsed] = useState(0)
  const [running, setRunning] = useState(false)
  const intRef = useRef(null)
  const startRef = useRef(null)
  const elRef = useRef(0)

  const start = useCallback(() => { startRef.current = Date.now(); elRef.current = elapsed; setRunning(true) }, [elapsed])
  const pause = useCallback(() => { setRunning(false); clearInterval(intRef.current) }, [])
  const reset = useCallback(() => { setRunning(false); clearInterval(intRef.current); setElapsed(0); elRef.current = 0 }, [])

  useEffect(() => {
    if (running) intRef.current = setInterval(() => setElapsed(elRef.current + Math.floor((Date.now() - startRef.current) / 1000)), 200)
    return () => clearInterval(intRef.current)
  }, [running])

  return { elapsed, running, start, pause, reset }
}

/* ═══════════════════════════════════════════════════════════════
   MAIN APP
═══════════════════════════════════════════════════════════════ */

const TABS = [
  { id: 'home', label: '🏠 Home' },
  { id: 'agenda', label: '⏱ Agenda' },
  { id: 'panorama', label: '📊 Panorama' },
  { id: 'compromisos', label: '📝 Compromisos' },
]

export default function Dashboard() {
  const [tab, setTab] = useState('home')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const { elapsed, running, start, pause, reset } = useTimer()

  const fetchData = useCallback(async () => {
    setRefreshing(true)
    try {
      setError(null)
      const res = await fetch('/api/monday')
      if (!res.ok) throw new Error(`Error ${res.status}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setItems(data.items || [])
      setLastUpdate(new Date())
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 10 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchData])

  const an = useMemo(() => items.length ? analyze(items) : null, [items])

  const eMin = elapsed / 60
  const mm = Math.floor(elapsed / 60)
  const ss = elapsed % 60
  const overtime = eMin >= 60
  const curBlock = AGENDA.find(b => eMin >= b.start && eMin < b.start + b.dur) || AGENDA[AGENDA.length - 1]

  return (
    <div style={{ minHeight: '100vh', background: '#000', color: '#fff', fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#111', borderBottom: '1px solid #2C2C2E', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 860, margin: '0 auto', padding: '12px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.03em' }}>⚡ Weekly <span style={{ color: '#636366', fontWeight: 400 }}>Mkt Corp</span></div>
              <div style={{ fontSize: 11, color: '#636366', marginTop: 2 }}>
                {TODAY.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })} · {items.length} items
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {lastUpdate && <span style={{ fontSize: 10, color: '#636366' }}>{lastUpdate.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</span>}
              <button onClick={fetchData} disabled={refreshing} style={{ background: '#1C1C1E', border: '1px solid #2C2C2E', borderRadius: 8, padding: '5px 10px', fontSize: 11, color: '#8E8E93', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                <RefreshCw size={12} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
                Sync
              </button>
            </div>
          </div>

          {/* Timer bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ fontFamily: 'monospace', fontSize: 24, fontWeight: 700, color: overtime ? '#EF4444' : '#fff', letterSpacing: '-0.05em', minWidth: 70 }}>
              {String(mm).padStart(2, '0')}:{String(ss).padStart(2, '0')}
            </span>
            {!running
              ? <button onClick={start} style={{ background: '#22C55E', color: '#fff', border: 'none', borderRadius: 8, padding: '5px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>▶ {elapsed === 0 ? 'Iniciar' : 'Reanudar'}</button>
              : <button onClick={pause} style={{ background: '#F59E0B', color: '#fff', border: 'none', borderRadius: 8, padding: '5px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>⏸ Pausar</button>}
            {elapsed > 0 && <button onClick={reset} style={{ background: '#1C1C1E', color: '#636366', border: '1px solid #2C2C2E', borderRadius: 8, padding: '5px 10px', fontSize: 11, cursor: 'pointer' }}>⏹</button>}
            {running && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, background: '#1C1C1E', border: '1px solid #2C2C2E', borderRadius: 8, padding: '5px 10px', fontSize: 12 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#0A84FF', animation: 'pulse 1s ease infinite' }} />
                <span style={{ fontWeight: 600, color: '#0A84FF' }}>{curBlock.label}</span>
                <span style={{ color: '#636366', fontSize: 11 }}>{curBlock.presenter}</span>
                <span style={{ marginLeft: 'auto', fontFamily: 'monospace', fontSize: 11, color: '#8E8E93' }}>{Math.ceil(Math.max(0, curBlock.start + curBlock.dur - eMin))}m</span>
              </div>
            )}
          </div>

          {/* Progress */}
          <div style={{ height: 3, background: '#2C2C2E', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', background: overtime ? '#EF4444' : '#0A84FF', width: `${Math.min(100, (eMin / 60) * 100)}%`, transition: 'width 1s linear' }} />
          </div>
        </div>

        {/* Tabs */}
        <div style={{ maxWidth: 860, margin: '0 auto', padding: '0 16px', display: 'flex', gap: 0, borderTop: '1px solid #2C2C2E' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ background: 'transparent', color: tab === t.id ? '#fff' : '#636366', border: 'none', borderBottom: tab === t.id ? '2px solid #0A84FF' : '2px solid transparent', padding: '10px 16px', fontSize: 12, fontWeight: tab === t.id ? 600 : 400, cursor: 'pointer' }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '20px 16px 48px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#636366' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⚡</div>
            Conectando con Monday.com...
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <AlertCircle size={32} color="#EF4444" style={{ marginBottom: 12 }} />
            <div style={{ color: '#EF4444', marginBottom: 12 }}>{error}</div>
            <button onClick={fetchData} style={{ background: '#1C1C1E', border: '1px solid #2C2C2E', borderRadius: 8, padding: '8px 20px', fontSize: 13, color: '#fff', cursor: 'pointer' }}>Reintentar</button>
          </div>
        ) : an ? (
          <>
            {tab === 'home' && <TabHome items={items} an={an} />}
            {tab === 'agenda' && <TabAgenda elapsed={elapsed} />}
            {tab === 'panorama' && <TabPanorama items={items} an={an} />}
            {tab === 'compromisos' && <TabCompromisos />}
          </>
        ) : null}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }
        * { box-sizing: border-box; margin: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: #2C2C2E; border-radius: 2px; }
      `}</style>
    </div>
  )
}
