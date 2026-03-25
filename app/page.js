'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Calendar, Users, Target, Activity, CheckSquare,
  RefreshCw, Wifi, WifiOff, ChevronRight,
  AlertCircle, Clock, TrendingUp, User
} from 'lucide-react'

const TABS = [
  { id: 'agenda', label: 'Agenda', icon: Calendar },
  { id: 'carga', label: 'Carga por Persona', icon: Users },
  { id: 'squads', label: 'Squads Focus', icon: Target },
  { id: 'health', label: 'Board Health', icon: Activity },
  { id: 'compromisos', label: 'Compromisos', icon: CheckSquare },
]

const SQUAD_LEADS = {
  'Jean Pierre': 'Inbound Studio',
  'Iris': 'Performance y Conversión',
  'César': 'RevOps',
  'David': 'Portafolio y Ecosistema',
  'Ileana': 'Outbound y Pipeline',
  'Víctor': 'PMO',
}

const STATUS_COLORS = {
  'Done': '#22c55e',
  'Working on it': '#6C63FF',
  'Stuck': '#FF6B6B',
  'Waiting': '#f59e0b',
  'In Progress': '#6C63FF',
}

function StatusBadge({ status }) {
  const color = STATUS_COLORS[status] || '#3A3A4A'
  return (
    <span
      className="px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap"
      style={{ backgroundColor: color + '20', color, border: `1px solid ${color}40` }}
    >
      {status || 'Sin estado'}
    </span>
  )
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-upax-accent border-t-transparent rounded-full animate-spin" />
        <p className="text-upax-text-muted text-sm">Cargando datos de Monday...</p>
      </div>
    </div>
  )
}

function ErrorState({ message, onRetry }) {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-4 text-center max-w-sm">
        <AlertCircle className="w-10 h-10 text-red-400" />
        <p className="text-upax-text-muted text-sm">{message}</p>
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-upax-card border border-upax-border rounded-lg text-sm hover:border-upax-accent transition-colors text-upax-text"
        >
          Reintentar
        </button>
      </div>
    </div>
  )
}

// ── AGENDA ────────────────────────────────────────────────────────────────────
function AgendaView({ items }) {
  const today = new Date().toLocaleDateString('es-MX', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  })

  const pending = items
    .filter(item => {
      const status = item.column_values?.find(c => c.column?.type === 'color')?.text
      return status !== 'Done'
    })
    .slice(0, 10)

  return (
    <div className="space-y-6 fade-in">
      <div className="bg-upax-card border border-upax-border rounded-xl p-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-2 h-2 rounded-full bg-green-400 live-dot" />
          <span className="text-upax-text-muted text-xs uppercase tracking-widest">Reunión semanal</span>
        </div>
        <h2 className="font-display text-4xl text-upax-text tracking-wide capitalize">{today}</h2>
        <p className="text-upax-text-muted text-sm mt-1">Equipo Marketing · Grupo UPAX · 27 personas</p>
      </div>

      <div className="bg-upax-card border border-upax-border rounded-xl p-6">
        <h3 className="font-display text-xl text-upax-text mb-4 tracking-wide">ITEMS ACTIVOS</h3>
        <div className="space-y-2">
          {pending.length === 0 ? (
            <p className="text-upax-text-muted text-sm">No hay items pendientes 🎉</p>
          ) : pending.map((item, i) => {
            const status = item.column_values?.find(c => c.column?.type === 'color')?.text
            const person = item.column_values?.find(c => c.column?.type === 'multiple-person')?.text
            return (
              <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg bg-upax-dark border border-upax-border">
                <span className="text-upax-text-muted text-xs w-5 flex-shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-upax-text text-sm truncate">{item.name}</p>
                  {person && <p className="text-upax-text-muted text-xs mt-0.5">{person}</p>}
                </div>
                <StatusBadge status={status} />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── CARGA POR PERSONA ─────────────────────────────────────────────────────────
function CargaView({ items }) {
  const personLoad = {}

  items.forEach(item => {
    const personCol = item.column_values?.find(c => c.column?.type === 'multiple-person')
    const status = item.column_values?.find(c => c.column?.type === 'color')?.text
    const names = personCol?.text?.split(',').map(n => n.trim()).filter(Boolean) || ['Sin asignar']

    names.forEach(name => {
      if (!personLoad[name]) personLoad[name] = { total: 0, done: 0, stuck: 0, inProgress: 0 }
      personLoad[name].total++
      if (status === 'Done') personLoad[name].done++
      else if (status === 'Stuck') personLoad[name].stuck++
      else if (status === 'Working on it' || status === 'In Progress') personLoad[name].inProgress++
    })
  })

  const sorted = Object.entries(personLoad).sort((a, b) => b[1].total - a[1].total)
  const totalDone = items.filter(i => i.column_values?.find(c => c.column?.type === 'color')?.text === 'Done').length
  const totalStuck = items.filter(i => i.column_values?.find(c => c.column?.type === 'color')?.text === 'Stuck').length

  return (
    <div className="space-y-3 fade-in">
      <div className="grid grid-cols-3 gap-3 mb-2">
        {[
          { label: 'Total Items', value: items.length, color: '#6C63FF' },
          { label: 'Completados', value: totalDone, color: '#22c55e' },
          { label: 'Bloqueados', value: totalStuck, color: '#FF6B6B' },
        ].map(stat => (
          <div key={stat.label} className="bg-upax-card border border-upax-border rounded-xl p-4 text-center">
            <p className="font-display text-3xl" style={{ color: stat.color }}>{stat.value}</p>
            <p className="text-upax-text-muted text-xs mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {sorted.map(([name, load]) => {
        const pct = load.total > 0 ? Math.round((load.done / load.total) * 100) : 0
        const barColor = pct > 70 ? '#22c55e' : pct > 40 ? '#6C63FF' : '#FF6B6B'
        return (
          <div key={name} className="bg-upax-card border border-upax-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-upax-muted flex items-center justify-center flex-shrink-0">
                  <span className="text-upax-text text-xs font-medium">{name[0]}</span>
                </div>
                <div>
                  <p className="text-upax-text text-sm font-medium">{name}</p>
                  <p className="text-upax-text-muted text-xs">{SQUAD_LEADS[name] || 'Equipo'}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-upax-text text-sm font-medium">{load.total} items</p>
                <p className="text-upax-text-muted text-xs">{pct}% completado</p>
              </div>
            </div>
            <div className="w-full bg-upax-dark rounded-full h-1.5">
              <div className="h-1.5 rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: barColor }} />
            </div>
            <div className="flex gap-3 mt-2">
              {load.inProgress > 0 && <span className="text-xs" style={{ color: '#6C63FF' }}>● {load.inProgress} en progreso</span>}
              {load.stuck > 0 && <span className="text-xs text-red-400">● {load.stuck} bloqueados</span>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── SQUADS FOCUS ──────────────────────────────────────────────────────────────
function SquadsView({ items, groups }) {
  return (
    <div className="space-y-4 fade-in">
      {groups?.map(group => {
        const groupItems = items.filter(i => i.group?.id === group.id)
        const done = groupItems.filter(i => i.column_values?.find(c => c.column?.type === 'color')?.text === 'Done').length
        return (
          <div key={group.id} className="bg-upax-card border border-upax-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: group.color || '#6C63FF' }} />
                <h3 className="font-display text-lg text-upax-text tracking-wide">{group.title}</h3>
              </div>
              <span className="text-upax-text-muted text-sm">{done}/{groupItems.length}</span>
            </div>
            {groupItems.length === 0 ? (
              <p className="text-upax-text-muted text-xs">Sin items en este grupo</p>
            ) : (
              <div className="space-y-2">
                {groupItems.map(item => {
                  const status = item.column_values?.find(c => c.column?.type === 'color')?.text
                  return (
                    <div key={item.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-upax-dark transition-colors">
                      <ChevronRight className="w-3 h-3 text-upax-muted flex-shrink-0" />
                      <span className="text-upax-text text-xs flex-1 truncate">{item.name}</span>
                      <StatusBadge status={status} />
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── BOARD HEALTH ──────────────────────────────────────────────────────────────
function HealthView({ items }) {
  const statuses = {}
  items.forEach(item => {
    const status = item.column_values?.find(c => c.column?.type === 'color')?.text || 'Sin estado'
    statuses[status] = (statuses[status] || 0) + 1
  })

  const noAssignee = items.filter(i => !i.column_values?.find(c => c.column?.type === 'multiple-person')?.text).length
  const stuck = statuses['Stuck'] || 0
  const healthScore = Math.max(0, 100 - (stuck * 10) - (noAssignee * 5))
  const healthColor = healthScore > 70 ? '#22c55e' : healthScore > 40 ? '#f59e0b' : '#FF6B6B'

  return (
    <div className="space-y-4 fade-in">
      <div className="bg-upax-card border border-upax-border rounded-xl p-6 text-center">
        <p className="text-upax-text-muted text-xs uppercase tracking-widest mb-2">Board Health Score</p>
        <p className="font-display text-7xl" style={{ color: healthColor }}>{healthScore}</p>
        <p className="text-upax-text-muted text-sm mt-2">
          {healthScore > 70 ? '✓ Board en buen estado' : healthScore > 40 ? '⚠ Requiere atención' : '✗ Estado crítico'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-upax-card border border-upax-border rounded-xl p-4">
          <p className="text-upax-text-muted text-xs mb-3">Distribución de Estados</p>
          <div className="space-y-2">
            {Object.entries(statuses).map(([status, count]) => (
              <div key={status} className="flex justify-between items-center">
                <StatusBadge status={status} />
                <span className="text-upax-text text-sm font-medium">{count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-upax-card border border-upax-border rounded-xl p-4">
          <p className="text-upax-text-muted text-xs mb-3">Alertas</p>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <div>
                <p className="text-upax-text text-xs font-medium">{stuck} bloqueados</p>
                <p className="text-upax-text-muted text-xs">Items en Stuck</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 flex-shrink-0" style={{ color: '#f59e0b' }} />
              <div>
                <p className="text-upax-text text-xs font-medium">{noAssignee} sin asignar</p>
                <p className="text-upax-text-muted text-xs">Sin responsable</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-400 flex-shrink-0" />
              <div>
                <p className="text-upax-text text-xs font-medium">{items.length} items totales</p>
                <p className="text-upax-text-muted text-xs">En el board</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── COMPROMISOS ───────────────────────────────────────────────────────────────
function CompromisosView() {
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
    } finally {
      setSaving(false)
    }
  }

  const add = async () => {
    if (!newItem.text.trim()) return
    const updated = [...commitments, {
      id: Date.now(),
      ...newItem,
      done: false,
      createdAt: new Date().toISOString()
    }]
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

  if (loading) return <LoadingSpinner />

  const pending = commitments.filter(c => !c.done)
  const done = commitments.filter(c => c.done)

  return (
    <div className="space-y-4 fade-in">
      <div className="bg-upax-card border border-upax-border rounded-xl p-4">
        <p className="text-upax-text-muted text-xs uppercase tracking-widest mb-3">Nuevo Compromiso</p>
        <div className="space-y-2">
          <input
            className="w-full bg-upax-dark border border-upax-border rounded-lg px-3 py-2 text-sm text-upax-text placeholder-upax-text-muted focus:outline-none focus:border-upax-accent"
            placeholder="Descripción del compromiso..."
            value={newItem.text}
            onChange={e => setNewItem(p => ({ ...p, text: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && add()}
          />
          <div className="flex gap-2">
            <input
              className="flex-1 bg-upax-dark border border-upax-border rounded-lg px-3 py-2 text-sm text-upax-text placeholder-upax-text-muted focus:outline-none focus:border-upax-accent"
              placeholder="Responsable"
              value={newItem.owner}
              onChange={e => setNewItem(p => ({ ...p, owner: e.target.value }))}
            />
            <input
              type="date"
              className="flex-1 bg-upax-dark border border-upax-border rounded-lg px-3 py-2 text-sm text-upax-text focus:outline-none focus:border-upax-accent"
              value={newItem.date}
              onChange={e => setNewItem(p => ({ ...p, date: e.target.value }))}
            />
            <button
              onClick={add}
              className="px-4 py-2 bg-upax-accent text-white rounded-lg text-sm font-medium hover:opacity-80 transition-opacity"
            >
              {saving ? '...' : 'Agregar'}
            </button>
          </div>
        </div>
      </div>

      {pending.length > 0 && (
        <div className="bg-upax-card border border-upax-border rounded-xl p-4">
          <p className="text-upax-text-muted text-xs uppercase tracking-widest mb-3">Pendientes ({pending.length})</p>
          <div className="space-y-2">
            {pending.map(c => (
              <div key={c.id} className="flex items-start gap-3 p-3 rounded-lg bg-upax-dark border border-upax-border">
                <button
                  onClick={() => toggle(c.id)}
                  className="mt-0.5 w-4 h-4 rounded border border-upax-muted hover:border-upax-accent transition-colors flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-upax-text text-sm">{c.text}</p>
                  <div className="flex gap-3 mt-1">
                    {c.owner && <span className="text-upax-text-muted text-xs">👤 {c.owner}</span>}
                    {c.date && <span className="text-upax-text-muted text-xs">📅 {c.date}</span>}
                  </div>
                </div>
                <button onClick={() => remove(c.id)} className="text-upax-muted hover:text-red-400 text-xs transition-colors">✕</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {done.length > 0 && (
        <div className="bg-upax-card border border-upax-border rounded-xl p-4 opacity-60">
          <p className="text-upax-text-muted text-xs uppercase tracking-widest mb-3">Completados ({done.length})</p>
          <div className="space-y-2">
            {done.map(c => (
              <div key={c.id} className="flex items-center gap-3 p-3 rounded-lg">
                <button onClick={() => toggle(c.id)} className="w-4 h-4 rounded bg-green-500 flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xs">✓</span>
                </button>
                <p className="text-upax-text-muted text-sm line-through flex-1">{c.text}</p>
                <button onClick={() => remove(c.id)} className="text-upax-muted hover:text-red-400 text-xs">✕</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {commitments.length === 0 && (
        <div className="text-center py-12 text-upax-text-muted text-sm">
          No hay compromisos registrados aún
        </div>
      )}
    </div>
  )
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('agenda')
  const [boardData, setBoardData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [online, setOnline] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      setError(null)
      const res = await fetch('/api/monday')
      if (!res.ok) throw new Error('Error al conectar con Monday.com')
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setBoardData(data.board)
      setLastUpdated(new Date())
      setOnline(true)
    } catch (err) {
      setError(err.message)
      setOnline(false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchData])

  const items = boardData?.items_page?.items || []
  const groups = boardData?.groups || []

  return (
    <div className="min-h-screen bg-upax-dark">
      <header className="sticky top-0 z-50 bg-upax-dark border-b border-upax-border">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl text-upax-text tracking-widest">UPAX</h1>
            <span className="text-upax-text-muted text-xs">Marketing Weekly</span>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdated && (
              <span className="text-upax-text-muted text-xs hidden sm:block">
                <Clock className="w-3 h-3 inline mr-1" />
                {lastUpdated.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            {online
              ? <Wifi className="w-4 h-4 text-green-400" />
              : <WifiOff className="w-4 h-4 text-red-400" />
            }
            <button onClick={fetchData} className="p-1.5 rounded-lg hover:bg-upax-card transition-colors">
              <RefreshCw className="w-4 h-4 text-upax-text-muted hover:text-upax-text" />
            </button>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 flex gap-1 pb-3 overflow-x-auto">
          {TABS.map(tab => {
            const Icon = tab.icon
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all whitespace-nowrap ${
                  active
                    ? 'tab-active text-upax-accent border-upax-accent'
                    : 'text-upax-text-muted border-transparent hover:text-upax-text hover:bg-upax-card'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            )
          })}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {loading ? (
          <LoadingSpinner />
        ) : error ? (
          <ErrorState message={error} onRetry={fetchData} />
        ) : (
          <>
            {activeTab === 'agenda' && <AgendaView items={items} />}
            {activeTab === 'carga' && <CargaView items={items} />}
            {activeTab === 'squads' && <SquadsView items={items} groups={groups} />}
            {activeTab === 'health' && <HealthView items={items} />}
            {activeTab === 'compromisos' && <CompromisosView />}
          </>
        )}
      </main>
    </div>
  )
}
