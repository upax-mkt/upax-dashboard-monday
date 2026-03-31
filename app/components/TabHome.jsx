'use client'
import React, { useState, useCallback } from 'react'
// components/TabHome.jsx — Tab Home + CargaRow + OverdueSection
import { PERSONAS, SQUADS, TODAY, TODAY_STR, WEEK, PREV_WEEK, PHASES, PHASE_SHORT } from '../lib/constants'
import { parseTL, daysDiff, pctColor, shortName, normalizeSquad, isActive, isOverdue, overlapsThisWeek } from '../lib/utils'
import { storeGet, storeSet } from '../lib/storage'
import { Chip, Card, Alerta } from './ui'

export function OverdueSection({ overdue }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? overdue : overdue.slice(0, 5);
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--red)", textTransform: "uppercase", letterSpacing: 1 }}>Vencidos · {overdue.length}</div>
        {overdue.length > 5 && (
          <button onClick={() => setShowAll(!showAll)} style={{ fontSize: 10, color: "var(--blue)", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
            {showAll ? "Ver menos ↑" : `+${overdue.length - 5} más ↓`}
          </button>
        )}
      </div>
      {visible.map((it) => {
        const tl = parseTL(it.column_values?.timerange_mkzcqv0j);
        const d = tl.end ? daysDiff(TODAY, tl.end) : 0;
        const sq = SQUADS.find(s => s.name === normalizeSquad(it.column_values?.color_mkz0s203));
        return (
          <div key={it.id} style={{ display: "flex", gap: 6, alignItems: "center", padding: "3px 0", fontSize: 11 }}>
            <span style={{ fontFamily: "var(--mono)", color: "var(--red)", fontWeight: 700, minWidth: 30 }}>-{d}d</span>
            {sq && <span style={{ width: 6, height: 6, borderRadius: "50%", background: sq.color, flexShrink: 0 }} />}
            <span style={{ flex: 1, color: "var(--tx2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</span>
            <span style={{ color: "var(--tx3)", fontSize: 10 }}>{shortName(it.column_values?.person)}</span>
          </div>
        );
      })}
    </div>
  );
}

// CargaRow — fuera de TabHome para evitar re-creación en cada render (P3.8)
export const CargaRow = React.memo(function CargaRow({ person, d, rank, maxVal, onClick, isExpanded, items }) {
  const pct = maxVal > 0 ? d.total / maxVal : 0;
  // Umbral de carga: proyectos + tareas combinados
  // >20 = rojo (sobrecargado), >10 = amarillo (carga alta), <=10 = verde (normal)
  const barColor = d.total > 20 ? "var(--red)" : d.total > 10 ? "var(--yellow)" : "var(--green)";
  const sq = PERSONAS.find((p) => p.name === person);
  const squadData = SQUADS.find((s) => s.name === sq?.squad);
  const squadColor = squadData?.color || "var(--tx3)";
  const projects = d.projects || 0;
  const tasks = d.tasks || 0;
  const squadShort = squadData?.name?.split(" ")[0] || "";
  return (
    <div onClick={onClick} style={{ cursor: "pointer", borderBottom: "1px solid var(--bg3)", transition: "background .1s" }}
      onMouseEnter={e => e.currentTarget.style.background = "var(--bg3)"}
      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0" }}>
        {/* Rank */}
        <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--tx3)", minWidth: 16, textAlign: "right", flexShrink: 0 }}>{rank}</span>
        {/* Squad dot */}
        <span title={squadData?.name} style={{ width: 8, height: 8, borderRadius: "50%", background: squadColor, flexShrink: 0 }} />
        {/* Nombre */}
        <span style={{ fontSize: 13, fontWeight: 600, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{shortName(person)}</span>
        {/* Squad label — solo en desktop */}
        <span className="mobile-hide" style={{ fontSize: 10, color: squadColor, fontWeight: 600, background: squadColor + "15", borderRadius: 4, padding: "1px 6px", flexShrink: 0 }}>{squadShort}</span>
        {/* Detenidos */}
        {d.stopped > 0 && <span style={{ fontSize: 10, color: "var(--red)", fontWeight: 700, flexShrink: 0 }}>{d.stopped}🚫</span>}
        {/* Barra de progreso — relativa al máximo del equipo */}
        <div title={`${d.total} de ${maxVal} (máximo del equipo)`} style={{ width: 60, height: 4, background: "var(--bg4)", borderRadius: 3, overflow: "hidden", flexShrink: 0, cursor: "help" }}>
          <div style={{ width: Math.min(pct * 100, 100) + "%", height: "100%", background: barColor, borderRadius: 3, transition: "width .4s ease" }} />
        </div>
        {/* Total + desglose proyectos/tareas */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", flexShrink: 0, minWidth: 60 }}>
          <span style={{ fontFamily: "var(--mono)", fontSize: 14, fontWeight: 800, color: barColor, lineHeight: 1 }}>{d.total}</span>
          {(projects > 0 || tasks > 0) && (
            <div style={{ display: "flex", gap: 4, marginTop: 2 }}>
              {projects > 0 && (
                <span style={{ fontSize: 10, fontWeight: 700, color: "var(--blue)", background: "rgba(0,122,255,.1)", borderRadius: 3, padding: "1px 4px", whiteSpace: "nowrap" }}>
                  {projects}P
                </span>
              )}
              {tasks > 0 && (
                <span style={{ fontSize: 10, fontWeight: 700, color: "var(--purple)", background: "rgba(175,82,222,.1)", borderRadius: 3, padding: "1px 4px", whiteSpace: "nowrap" }}>
                  {tasks}T
                </span>
              )}
            </div>
          )}
        </div>
        {/* Chevron */}
        <span style={{ fontSize: 10, color: "var(--tx3)", transform: isExpanded ? "rotate(180deg)" : "none", transition: "transform .2s", flexShrink: 0 }}>▾</span>
      </div>
      {/* Detalle expandido — proyectos activos de esta persona */}
      {isExpanded && (
        <div style={{ paddingLeft: 32, paddingBottom: 8 }}>
          {items
            .filter(it => {
              const ph = it.column_values?.color_mkz09na;
              if (!isActive(ph)) return false;
              const person_val = it.column_values?.person || "";
              return person_val.toLowerCase().includes(person.split(" ")[0].toLowerCase());
            })
            .slice(0, 6)
            .map((it, i) => {
              const ph = it.column_values?.color_mkz09na;
              const tl = parseTL(it.column_values?.timerange_mkzcqv0j);
              const od = isOverdue(it);
              return (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", padding: "3px 0", fontSize: 11 }}>
                  <div style={{ width: 5, height: 5, borderRadius: "50%", background: PHASES[ph] || "var(--tx3)", flexShrink: 0 }} />
                  <span style={{ flex: 1, color: od ? "var(--red)" : "var(--tx2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</span>
                  {tl.end && <span style={{ fontSize: 10, color: od ? "var(--red)" : "var(--tx3)", fontFamily: "var(--mono)", flexShrink: 0 }}>{tl.end.toLocaleDateString("es-MX",{day:"2-digit",month:"short"})}</span>}
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
});

const TabHome = React.memo(function TabHome({ analysis: an, items, elapsed, onStart, onViewAlerts }) {
  const [alertGroupsExpanded, setAlertGroupsExpanded] = useState({});
  const [expandedPerson, setExpandedPerson] = useState(null);
  const [cargaSquad, setCargaSquad] = useState("all");
  const [gddData, setGddData] = useState(null);
  const [gddEditing, setGddEditing] = useState(false);
  const GDD_KEY = "config:gdd-metrics";

  // GdD vacío — se muestra cuando no hay datos reales aún
  const GDD_EMPTY = {
    semana: { leads: 0, mqls: 0, sqls: 0, opps: 0, pipeline_mkt: 0, pipeline_com: 0 },
    anterior: { leads: 0, mqls: 0, sqls: 0, opps: 0 },
    mes: { leads: 0, mqls: 0, sqls: 0, opps: 0 },
    ytd: { leads: 0, mqls: 0, sqls: 0, opps: 0 },
    fechas: {},
    source: "empty",
  };

  useEffect(() => {
    (async () => {
      try {
        // 1. Fetch a /api/gdd PRIMERO — fuente de verdad (Google Sheets de César)
        //    Con timeout de 10s para no bloquear si Sheets tarda
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        try {
          const res = await fetch("/api/gdd", { cache: "no-store", signal: controller.signal });
          clearTimeout(timeout);
          if (res.ok) {
            const data = await res.json();
            const hasData = !data.error && (
              (data.semana?.leads > 0) ||
              (data.semana?.mqls > 0) ||
              (data.semana?.sqls > 0) ||
              (data.semana?.opps > 0) ||
              (data.semana?.pipeline_mkt > 0)
            );
            if (hasData) {
              setGddData(data);
              return;
            }
          }
        } catch (fetchErr) {
          clearTimeout(timeout);
          // Timeout o error de red — continuar al fallback
          console.warn("GdD fetch timeout/error:", fetchErr.message);
        }

        // 2. Override manual del usuario (solo si existe en storage)
        const manual = await storeGet(GDD_KEY);
        if (manual && Object.keys(manual).length > 0) {
          setGddData({ ...manual, source: "manual" });
          return;
        }

        // 3. Sin datos — mostrar vacío (no inventar números)
        setGddData(GDD_EMPTY);
      } catch {
        setGddData(GDD_EMPTY);
      }
    })();
  }, []);

  if (!an) return null;
  const activeCount = (an.byPhase["🚧 Sprint"] || 0) + (an.byPhase["👀 Review"] || 0) + (an.byPhase["⚙️ Modificación"] || 0);
  const activeWeek = (an.byPhaseWeek["🚧 Sprint"] || 0) + (an.byPhaseWeek["👀 Review"] || 0) + (an.byPhaseWeek["⚙️ Modificación"] || 0);
  const TEAM_NAMES = new Set(PERSONAS.map((p) => p.name));
  const sortedPeople = Object.entries(an.byPersonWeek).filter(([name]) => TEAM_NAMES.has(name) && !PERSONAS.find((p) => p.name === name)?.sdr).sort((a, b) => b[1].total - a[1].total);
  const stoppedSquads = SQUADS.filter((sq) => an.bySquad[sq.name]?.phases["🚫 Detenido"] > 0);
  const overdueCritical = (an.overdue || []).filter((it) => { const tl = parseTL(it.column_values?.timerange_mkzcqv0j); return tl.end && daysDiff(TODAY, tl.end) > 7; }).length;

  const KPI = (label, val, color, sub, icon) => (
    <div style={{ background: "var(--bg2)", border: "1px solid var(--bg4)", borderRadius: "var(--r)", padding: "16px 18px", flex: "1 1 120px", minWidth: 110, position: "relative", overflow: "hidden" }}>
      {/* Accent glow top bar */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: color, borderRadius: "var(--r) var(--r) 0 0" }} />
      {/* Icon watermark */}
      <div style={{ position: "absolute", top: 10, right: 14, fontSize: 22, opacity: 0.07, userSelect: "none" }}>{icon}</div>
      <div style={{ fontSize: 10, color: "var(--tx3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 10, fontFamily: "var(--mono)" }}>{label}</div>
      <div style={{ fontFamily: "var(--mono)", fontSize: 42, fontWeight: 800, color, lineHeight: 1, letterSpacing: "-0.05em", marginBottom: 8 }}>{val}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--tx3)", lineHeight: 1.4, paddingTop: 8, borderTop: "1px solid var(--bg4)" }}>{sub}</div>}
    </div>
  );


  return (
    <div className="fade">
      {elapsed === 0 && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "32px 0 36px" }}>
          <button onClick={onStart} style={{ background: "linear-gradient(135deg,#34C759,#30B350)", color: "#fff", border: "none", borderRadius: "var(--r-sm)", padding: "12px 36px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "var(--sans)", boxShadow: "0 2px 8px rgba(52,199,89,.25)" }}>
            ▶  Iniciar Weekly
          </button>
          <div style={{ fontSize: 14, color: "var(--tx3)", marginTop: 14 }}>{TODAY.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</div>
        </div>
      )}

      {/* Semaphore */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", marginBottom: 12, borderRadius: "var(--r)", background: (an.semaphore || "yellow") === "red" ? "rgba(255,59,48,.08)" : (an.semaphore || "yellow") === "yellow" ? "rgba(255,159,10,.08)" : "rgba(52,199,89,.08)", border: `1px solid ${(an.semaphore || "yellow") === "red" ? "rgba(255,59,48,.2)" : (an.semaphore || "yellow") === "yellow" ? "rgba(255,159,10,.2)" : "rgba(52,199,89,.2)"}` }}>
        <span style={{ fontSize: 24 }}>{(an.semaphore || "yellow") === "red" ? "🔴" : (an.semaphore || "yellow") === "yellow" ? "🟡" : "🟢"}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: (an.semaphore || "yellow") === "red" ? "var(--red)" : (an.semaphore || "yellow") === "yellow" ? "var(--yellow)" : "var(--green)" }}>
            {(an.semaphore || "yellow") === "red" ? "Temas urgentes que revisar" : (an.semaphore || "yellow") === "yellow" ? "Atención en algunos puntos" : "En control"}
          </div>
          <div style={{ fontSize: 11, color: "var(--tx3)", marginTop: 2 }}>{activeWeek} en sprint esta semana · {(an.velocity || {}).done || 0} completados sem. anterior · {(an.velocity || {}).overdue || 0} vencidos</div>
        </div>
      </div>

      {/* GdD boxes — arriba de todo, como KPIs de generación de demanda */}
      {(() => {
        const d = gddData || { semana: {}, anterior: {}, ytd: {} };
        const metrics = ["leads", "mqls", "sqls", "opps"];
        const labels = { leads: "Leads", mqls: "MQLs", sqls: "SQLs", opps: "Opps" };
        const colors = { leads: "var(--blue)", mqls: "var(--purple)", sqls: "var(--green)", opps: "var(--yellow)" };
        const icons = { leads: "👤", mqls: "⭐", sqls: "🎯", opps: "💼" };
        const updateField = (period, field, val) => setGddData((prev) => ({ ...prev, [period]: { ...(prev?.[period] || {}), [field]: val } }));
        const pctChange = (cur, prev) => (!prev || prev === 0) ? null : Math.round(((cur - prev) / prev) * 100);
        return (
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--tx3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                📊 Generación de Demanda{gddData?.source === "sheets_api" ? <span style={{ fontSize: 9, color: "var(--green)", marginLeft: 6, fontWeight: 700 }}>● LIVE</span> : gddData?.source === "empty" ? <span style={{ fontSize: 9, color: "var(--yellow)", marginLeft: 6 }}>sin datos</span> : gddData?.source === "fallback" ? <span style={{ fontSize: 9, color: "var(--red)", marginLeft: 6 }}>⚠ sin conexión</span> : null}
                {gddData?.fechas?.semana_desde && (() => {
                  const fD = (s) => { if (!s) return ""; const d = new Date(s + (s.includes("-") ? "T12:00:00" : ", 2026")); return isNaN(d) ? s : d.toLocaleDateString("es-MX",{day:"2-digit",month:"2-digit",year:"numeric"}).replace(/\//g," - "); };
                  return <span style={{ fontWeight: 400, marginLeft: 6, color: "var(--tx3)", fontSize: 11 }}>{fD(gddData.fechas.semana_desde)}{gddData.fechas.semana_hasta ? " al " + fD(gddData.fechas.semana_hasta) : ""}</span>;
                })()}
              </span>
              <button onClick={() => {
                if (gddEditing) {
                  const toSave = { ...gddData, lastUpdate: new Date().toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" }) };
                  setGddData(toSave); storeSet(GDD_KEY, toSave);
                }
                setGddEditing(!gddEditing);
              }} style={{ background: gddEditing ? "var(--blue)" : "transparent", color: gddEditing ? "#fff" : "var(--tx3)", border: gddEditing ? "none" : "1px solid var(--bg4)", borderRadius: 6, padding: "3px 10px", fontSize: 10, fontWeight: 600, cursor: "pointer" }}>
                {gddEditing ? "💾 Guardar" : "✏️ Editar"}
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 4 }}>
              {metrics.map((m) => {
                const cur = d.semana?.[m] || 0, prev = d.anterior?.[m] || 0, ytd = d.ytd?.[m] || 0;
                const pct = pctChange(cur, prev);
                const col = colors[m];
                const mesVal = (gddData?.mes || {})[m] || 0;
                return (
                  <div key={m} style={{ background: "var(--bg2)", border: "1px solid var(--bg4)", borderRadius: "var(--r)", padding: "12px 14px", position: "relative", overflow: "hidden" }}>
                    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: col }} />
                    <div style={{ position: "absolute", top: 8, right: 10, fontSize: 18, opacity: 0.06 }}>{icons[m]}</div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--tx3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>{labels[m]}</div>
                    {gddEditing
                      ? <NumInput initial={cur} onCommit={(v) => updateField("semana", m, v)} />
                      : <div style={{ fontFamily: "var(--mono)", fontSize: 32, fontWeight: 800, color: "var(--tx)", lineHeight: 1, letterSpacing: "-0.04em" }}>{cur.toLocaleString()}</div>}
                    {!gddEditing && pct !== null && (
                      <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 6, paddingTop: 6, borderTop: "1px solid var(--bg4)" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: pct >= 0 ? "var(--green)" : "var(--red)" }}>{pct >= 0 ? "▲" : "▼"}{Math.abs(pct)}%</span>
                        <span style={{ fontSize: 10, color: "var(--tx3)" }}>vs sem. ant.</span>
                      </div>
                    )}
                    {!gddEditing && mesVal > 0 && (
                      <div style={{ marginTop: 5, paddingTop: 4, borderTop: "1px solid var(--bg4)", fontSize: 10, color: "var(--tx3)" }}>
                        <span style={{ color: "var(--tx2)", fontWeight: 700, fontFamily: "var(--mono)" }}>{mesVal.toLocaleString()}</span> acum. mes
                      </div>
                    )}
                    {gddEditing && (
                      <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px solid var(--bg4)" }}>
                        <div style={{ fontSize: 9, color: "var(--tx3)", marginBottom: 2 }}>Ant: <NumInput initial={prev} onCommit={(v) => updateField("anterior", m, v)} style={{ width: 48, fontSize: 10, padding: "1px 4px" }} /></div>
                        <div style={{ fontSize: 9, color: "var(--tx3)" }}>YTD: <NumInput initial={ytd} onCommit={(v) => updateField("ytd", m, v)} style={{ width: 48, fontSize: 10, padding: "1px 4px" }} /></div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {gddData?.lastUpdate && <div style={{ fontSize: 10, color: "var(--tx3)", textAlign: "right" }}>Actualizado: {gddData.lastUpdate}</div>}
          </div>
        );
      })()}

      {/* Separador — diferenciado de Panorama */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, marginTop: 4 }}>
        <div style={{ flex: 1, height: 1, background: "var(--bg4)" }} />
        <span style={{ fontSize: 10, fontWeight: 700, color: "var(--tx3)", textTransform: "uppercase", letterSpacing: "0.1em", whiteSpace: "nowrap" }}>Estado del sprint</span>
        <button onClick={onViewAlerts} style={{ fontSize: 9, color: "var(--blue)", background: "none", border: "1px solid var(--blue)", borderRadius: 4, padding: "2px 8px", cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap" }}>Ver detalle completo →</button>
        <div style={{ flex: 1, height: 1, background: "var(--bg4)" }} />
      </div>

      {/* KPIs operativos con comparativos */}
      {(() => {
        // Done este mes = items Done con Fecha Entrega Real en el mes actual
        const thisMonthStart = new Date(TODAY.getFullYear(), TODAY.getMonth(), 1);
        const doneThisMonth = items.filter(it => {
          const fer = it.column_values?.date_mkzchmsq;
          if (!fer || it.column_values?.color_mkz09na !== "✅ Done") return false;
          const d = new Date(fer);
          return d >= thisMonthStart && d <= TODAY;
        }).length;

        // % vs sem anterior para activos: comparar activeWeek con byPhaseWeek de prev semana
        // No tenemos datos históricos de phases por semana, pero sí tenemos overdue y stoppedWeek
        const overdueCount = (an.overdue || []).length;
        const detCount = an.byPhase["🚫 Detenido"] || 0;
        const doneCount = (an.doneLastWeek || []).length;

        const KPIop = (label, val, color, line1, line2, icon) => (
          <div style={{ background: "var(--bg2)", border: "1px solid var(--bg4)", borderRadius: "var(--r)", padding: "14px 16px", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: color }} />
            <div style={{ position: "absolute", top: 8, right: 12, fontSize: 18, opacity: 0.07 }}>{icon}</div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--tx3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>{label}</div>
            <div style={{ fontFamily: "var(--mono)", fontSize: 36, fontWeight: 800, color, lineHeight: 1, letterSpacing: "-0.05em", marginBottom: 6 }}>{val}</div>
            <div style={{ paddingTop: 6, borderTop: "1px solid var(--bg4)" }}>
              {line1 && <div style={{ fontSize: 11, color: "var(--tx3)", lineHeight: 1.4 }}>{line1}</div>}
              {line2 && <div style={{ fontSize: 11, color: "var(--tx3)", lineHeight: 1.4, marginTop: 2 }}>{line2}</div>}
            </div>
          </div>
        );

        return (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 16 }}>
            {KPIop(
              "Esta semana",
              activeWeek,
              "var(--blue)",
              `${activeCount} activos total`,
              `${activeCount - activeWeek} fuera de semana`,
              "⚡"
            )}
            {KPIop(
              "Vencidos",
              overdueCount,
              overdueCount > 0 ? "var(--red)" : "var(--green)",
              overdueCount > 0 ? `${overdueCritical} con más de 7 días` : "Al día ✓",
              `${(an.backlogWithDates||[]).length} en backlog con fecha`,
              "⏰"
            )}
            {KPIop(
              "Detenidos",
              detCount,
              detCount > 0 ? "var(--yellow)" : "var(--green)",
              detCount > 0 ? `${(an.stoppedWeek||[]).length} con fecha esta semana` : "Sin bloqueos ✓",
              `${(an.noResp||[]).length} sin responsable`,
              "🚫"
            )}
            {KPIop(
              "Done sem.",
              doneCount,
              doneCount > 0 ? "var(--green)" : "var(--tx3)",
              `${PREV_WEEK.start.toLocaleDateString("es-MX",{day:"numeric",month:"short"})} – ${PREV_WEEK.end.toLocaleDateString("es-MX",{day:"numeric",month:"short"})}`,
              `${doneThisMonth} este mes · ${an.doneTotal||0} total`,
              "✅"
            )}
          </div>
        );
      })()}

      {/* Carga — tabla compacta de todo el equipo */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>👥 Carga del Equipo <span style={{ fontSize: 11, fontWeight: 400, color: "var(--tx3)" }}>{WEEK.start.toLocaleDateString("es-MX", { day: "numeric", month: "short" })} – {WEEK.end.toLocaleDateString("es-MX", { day: "numeric", month: "short" })}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <div style={{ display: "flex", gap: 6, fontSize: 10, color: "var(--tx3)" }}>
            <span style={{ color: "var(--blue)", fontWeight: 700, background: "rgba(0,122,255,.1)", borderRadius: 3, padding: "1px 5px" }}>P</span>
            <span style={{ marginRight: 2 }}>= Proyectos</span>
            <span style={{ color: "var(--purple)", fontWeight: 700, background: "rgba(175,82,222,.1)", borderRadius: 3, padding: "1px 5px" }}>T</span>
            <span>= Tareas</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
            <Chip label="Todos" active={cargaSquad === "all"} color="var(--tx2)" onClick={() => setCargaSquad("all")} />
            {SQUADS.map((sq) => <Chip key={sq.id} label={sq.name.split(" ")[0]} active={cargaSquad === sq.id} color={sq.color} onClick={() => setCargaSquad(sq.id)} />)}
          </div>
        </div>
        {(() => {
          const squadFilter = cargaSquad === "all" ? null : SQUADS.find((s) => s.id === cargaSquad);
          const filtered = sortedPeople.filter(([name]) => {
            if (!squadFilter) return true;
            const p = PERSONAS.find((x) => x.name === name);
            return p && p.squad === squadFilter.name;
          });
          const maxVal = filtered.length > 0 ? filtered[0][1].total : 1;
          if (!filtered.length) return <div style={{ textAlign: "center", padding: "16px 0", color: "var(--tx3)", fontSize: 12 }}>Sin tareas esta semana</div>;
          return (
            <div>
              {filtered.map(([p, d], i) => (
                <CargaRow
                  key={p} person={p} d={d} rank={i + 1} maxVal={maxVal}
                  isExpanded={expandedPerson === p}
                  onClick={() => setExpandedPerson(expandedPerson === p ? null : p)}
                />
              ))}
            </div>
          );
        })()}
        {(an.noCrono || []).length > 0 && <div style={{ marginTop: 8, padding: "5px 10px", borderRadius: 6, background: "rgba(245,158,11,.06)", fontSize: 10, color: "var(--yellow)" }}>⚠️ {(an.noCrono || []).length} en Sprint sin Fecha</div>}
      </Card>

      {/* Alertas compactas */}
      {(() => {
    const alertGroups = [
          { items: [...(an.overdue || [])].sort((a, b) => (parseTL(a.column_values?.timerange_mkzcqv0j).end || TODAY) - (parseTL(b.column_values?.timerange_mkzcqv0j).end || TODAY)), icon: "🔴", label: "Vencidos", color: "var(--red)", extra: (it) => { const d = parseTL(it.column_values?.timerange_mkzcqv0j).end ? daysDiff(TODAY, parseTL(it.column_values?.timerange_mkzcqv0j).end) : 0; return <span style={{ fontFamily: "var(--mono)", color: "var(--red)", fontWeight: 700, fontSize: 10, minWidth: 28 }}>-{d}d</span>; } },
          { items: an.stoppedWeek || [], icon: "🚫", label: "Detenidos", color: "var(--red)" },
          { items: an.noCrono || [], icon: "📅", label: "Sin Fecha", color: "var(--yellow)" },
          { items: an.backlogWithDates || [], icon: "⚠️", label: "Backlog c/fecha", color: "var(--yellow)" },
        ].filter((g) => g.items.length > 0);
        if (alertGroups.length === 0) return <Card style={{ textAlign: "center", padding: 24 }}><div style={{ fontSize: 28, marginBottom: 4 }}>✅</div><div style={{ color: "var(--green)", fontSize: 14, fontWeight: 600 }}>Sin alertas críticas</div></Card>;
        return (
          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 700 }}>⚡ Alertas Ejecutivas</span>
              <button onClick={onViewAlerts} style={{ background: "var(--bg3)", color: "var(--blue)", border: "none", borderRadius: "var(--r-sm)", padding: "4px 12px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Ver alertas →</button>
            </div>
            {alertGroups.map((g, gi) => (
              <div key={gi} style={{ marginBottom: gi < alertGroups.length - 1 ? 10 : 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 12 }}>{g.icon}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: g.color }}>{g.label}</span>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 14, fontWeight: 700, color: g.color }}>{g.items.length}</span>
                </div>
                {(alertGroupsExpanded[(["overdue","stopped","noCrono","backlog","noResp"][gi] || gi)] ? g.items : g.items.slice(0, 4)).map((it) => {
                  const sq = SQUADS.find((s) => s.name === normalizeSquad(it.column_values?.color_mkz0s203));
                  return (
                    <div key={it.id} style={{ display: "flex", gap: 5, alignItems: "center", padding: "3px 0 3px 20px", fontSize: 12 }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: sq?.color || "var(--tx3)", flexShrink: 0 }} />
                      {g.extra && g.extra(it)}
                      <span style={{ flex: 1, color: "var(--tx2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</span>
                      <span style={{ color: "var(--tx3)", fontSize: 10 }}>{shortName(it.column_values?.person)}</span>
                    </div>
                  );
                })}
                {g.items.length > 4 && <div style={{ fontSize: 10, color: "var(--tx3)", paddingLeft: 20, marginTop: 2 }}>+{g.items.length - 4} más</div>}
              </div>
            ))}
          </Card>
        );
      })()}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 10: TAB AGENDA
   ═══════════════════════════════════════════════════════════════ */

export { TabHome, CargaRow, OverdueSection }
