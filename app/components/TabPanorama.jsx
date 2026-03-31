'use client'
import React, { useState } from 'react'
// components/TabPanorama.jsx
import { SQUADS, PHASES, TODAY, WEEK } from '../lib/constants'
import { parseTL, daysDiff, pctColor, shortName, normalizeSquad, isActive, isOverdue, overlapsThisWeek, getPersonDetail } from '../lib/utils'
import { Bar, Card, Chip, Alerta, PersonDetailView } from './ui'

const TabPanorama = React.memo(function TabPanorama({ analysis: an, items }) {
  const [sec, setSec] = useState(() => {
    try { return sessionStorage.getItem("panorama-tab") || "kanban"; } catch { return "kanban"; }
  });
  const setSecPersist = (s) => {
    setSec(s);
    try { sessionStorage.setItem("panorama-tab", s); } catch {}
  };
  const [expandedPerson, setExpandedPerson] = useState(null);

  const PanoramaPersonRow = ({ p, d, rank }) => {
    const open = expandedPerson === p;
    const detail = open ? getPersonDetail(p, items) : null;
    return (
      <div>
        <div onClick={() => setExpandedPerson(open ? null : p)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: "var(--r-sm)", marginBottom: 2, cursor: "pointer", background: open ? "var(--bg3)" : d.total > 8 ? "rgba(239,68,68,.06)" : "var(--bg2)", border: `1px solid ${open ? "var(--border)" : d.total > 8 ? "rgba(239,68,68,.2)" : "transparent"}` }}>
          <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--tx3)", minWidth: 16 }}>{rank}</span>
          <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{shortName(p)} {d.total > 8 && "⚠️"}</span>
          <span style={{ fontFamily: "var(--mono)", fontSize: 16, fontWeight: 700, color: d.total > 8 ? "var(--red)" : "var(--tx)", minWidth: 24, textAlign: "right" }}>{d.total}</span>
          {d.stopped > 0 ? <span style={{ fontSize: 10, color: "var(--tx3)" }}><span style={{ color: "var(--tx2)" }}>{d.items} act</span> + <span style={{ color: "var(--red)" }}>{d.stopped} 🚫</span></span> : <span style={{ fontSize: 10, color: "var(--tx3)" }}>tareas</span>}
          <span style={{ fontSize: 10, color: "var(--tx3)", transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }}>▾</span>
        </div>
        {open && detail && <PersonDetailView detail={detail} />}
      </div>
    );
  };

  return (
    <div className="fade">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700 }}>Panorama Semanal</h2>
        <div style={{ display: "flex", gap: 3 }}>
          {["kanban", "squads", "carga", "alertas"].map((s) => <Chip key={s} label={s.charAt(0).toUpperCase() + s.slice(1)} active={sec === s} color="var(--purple)" onClick={() => setSecPersist(s)} />)}
        </div>
      </div>

      {sec === "kanban" && (
        <div>
          <Card style={{ marginBottom: 8 }}>
            <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
              {[{ l: "Esta semana", v: (an.byPhaseWeek["🚧 Sprint"] || 0) + (an.byPhaseWeek["👀 Review"] || 0) + (an.byPhaseWeek["⚙️ Modificación"] || 0), c: "var(--blue)" }, { l: "Vencidos", v: (an.overdue || []).length, c: "var(--red)" }, { l: "Detenidos", v: an.byPhase["🚫 Detenido"] || 0, c: "var(--yellow)" }, { l: "Done sem.", v: (an.doneLastWeek || []).length, c: "var(--green)" }].map((k) => (
                <div key={k.l} style={{ background: "var(--bg3)", borderRadius: 8, padding: "6px 12px", flex: "1 1 60px", textAlign: "center", borderTop: `2px solid ${k.c}` }}>
                  <div style={{ fontFamily: "var(--mono)", fontSize: 20, fontWeight: 700, color: k.c }}>{k.v}</div>
                  <div style={{ fontSize: 9, color: "var(--tx3)", fontWeight: 600, textTransform: "uppercase" }}>{k.l}</div>
                </div>
              ))}
            </div>
            <Bar h={26} segs={Object.entries(PHASES).map(([p, c]) => ({ l: p, v: an.byPhase[p] || 0, c }))} />
            <div style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
              {Object.entries(PHASES).map(([p, c]) => <div key={p} style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, color: "var(--tx2)" }}><div style={{ width: 8, height: 8, borderRadius: "var(--r-sm)", background: c }} />{p}: <strong style={{ color: "var(--tx)" }}>{an.byPhase[p] || 0}</strong></div>)}
            </div>
          </Card>
          {(an.doneLastWeek || []).length > 0 && (
            <Card style={{ borderLeft: "4px solid var(--green)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--green)" }}>✅ Completados semana anterior</span>
                <span style={{ fontFamily: "var(--mono)", fontSize: 16, fontWeight: 700, color: "var(--green)" }}>{(an.doneLastWeek || []).length}</span>
              </div>
              <div style={{ maxHeight: 250, overflowY: "auto" }}>
                {(an.doneLastWeek || []).map((it) => {
                  const sq = SQUADS.find((s) => s.name === normalizeSquad(it.column_values?.color_mkz0s203));
                  return <div key={it.id} style={{ display: "flex", gap: 6, alignItems: "center", padding: "4px 0", borderBottom: "1px solid var(--bg3)", fontSize: 12 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: sq?.color || "var(--tx3)", flexShrink: 0 }} /><span style={{ flex: 1, color: "var(--tx)" }}>{it.name}</span><span style={{ color: "var(--tx3)", fontSize: 11 }}>{shortName(it.column_values?.person)}</span></div>;
                })}
              </div>
            </Card>
          )}
        </div>
      )}

      {sec === "squads" && SQUADS.map((sq) => {
        const d = an.bySquad[sq.name]; if (!d) return null;
        const act = (d.phases["🚧 Sprint"] || 0) + (d.phases["👀 Review"] || 0) + (d.phases["⚙️ Modificación"] || 0);
        const sqOverdue = (an.overdue || []).filter((it) => normalizeSquad(it.column_values?.color_mkz0s203) === sq.name);
        const sqNoCrono = (an.noCrono || []).filter((it) => normalizeSquad(it.column_values?.color_mkz0s203) === sq.name);
        return (
          <Card key={sq.id} style={{ marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: sq.color }}>{sq.name} <span style={{ fontWeight: 500, color: "var(--tx3)", fontSize: 12 }}>· {sq.lead}</span></span>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "var(--tx3)" }}>{act} activos</span>
                {sqOverdue.length > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: "var(--red)" }}>🔴 {sqOverdue.length} venc.</span>}
                {(d.phases["🚫 Detenido"] || 0) > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: "var(--red)" }}>🚫 {d.phases["🚫 Detenido"]} det.</span>}
              </div>
            </div>
            <Bar h={14} segs={[{ l: "Spr", v: d.phases["🚧 Sprint"] || 0, c: "var(--yellow)" }, { l: "Rev", v: d.phases["👀 Review"] || 0, c: "var(--cyan)" }, { l: "Mod", v: d.phases["⚙️ Modificación"] || 0, c: "var(--purple)" }, { l: "Det", v: d.phases["🚫 Detenido"] || 0, c: "var(--red)" }, { l: "BL", v: d.phases["⏳Backlog"] || 0, c: "var(--bg4)" }]} />
            {sqOverdue.length > 0 && (
              <div style={{ marginTop: 8, background: "rgba(255,59,48,.06)", borderRadius: 8, padding: "6px 10px", borderLeft: "3px solid var(--red)" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--red)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 }}>Vencidos · {sqOverdue.length}</div>
                {sqOverdue.map((it) => { const dd = parseTL(it.column_values?.timerange_mkzcqv0j).end ? daysDiff(TODAY, parseTL(it.column_values?.timerange_mkzcqv0j).end) : 0; return <div key={it.id} style={{ display: "flex", gap: 4, alignItems: "center", fontSize: 11, padding: "1px 0" }}><span style={{ fontFamily: "var(--mono)", color: "var(--red)", fontWeight: 700, minWidth: 28, fontSize: 10 }}>-{dd}d</span><span style={{ flex: 1, color: "var(--tx2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</span><span style={{ color: "var(--tx3)", fontSize: 10 }}>{shortName(it.column_values?.person)}</span></div>; })}
              </div>
            )}
            {sqNoCrono.length > 0 && (
              <div style={{ marginTop: 6, fontSize: 11, color: "var(--yellow)", padding: "6px 10px", background: "rgba(255,159,10,.06)", borderRadius: 8, borderLeft: "3px solid var(--yellow)" }}>
                <div style={{ fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>⚠️ {sqNoCrono.length} en Sprint sin Fecha</div>
                {sqNoCrono.map((it) => <div key={it.id} style={{ display: "flex", gap: 4, padding: "1px 0", color: "var(--tx2)" }}><span style={{ color: "var(--yellow)" }}>•</span><span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</span><span style={{ color: "var(--tx3)", fontSize: 10 }}>{shortName(it.column_values?.person)}</span></div>)}
              </div>
            )}
          </Card>
        );
      })}

      {sec === "carga" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 10, color: "var(--tx3)" }}>
            <span>Tareas por persona esta semana</span>
            <span>{WEEK.start.toLocaleDateString("es-MX", { day: "numeric", month: "short" })} – {WEEK.end.toLocaleDateString("es-MX", { day: "numeric", month: "short" })}</span>
          </div>
          {Object.entries(an.byPersonWeek).filter(([name]) => PERSONAS.some((p) => p.name === name)).sort((a, b) => b[1].total - a[1].total).map(([p, d], i) => <PanoramaPersonRow key={p} p={p} d={d} rank={i + 1} />)}
          {Object.keys(an.byPersonWeek).length === 0 && <div style={{ textAlign: "center", padding: "20px 0", color: "var(--tx3)", fontSize: 12 }}>No hay items con Fecha Definida esta semana</div>}
        </div>
      )}

      {sec === "alertas" && (
        <div>
          {[
            { items: (an.overdue || []).sort((a, b) => (parseTL(a.column_values?.timerange_mkzcqv0j).end || TODAY) - (parseTL(b.column_values?.timerange_mkzcqv0j).end || TODAY)), label: "🔴 Vencidos", color: "var(--red)", extra: (it) => { const d = parseTL(it.column_values?.timerange_mkzcqv0j).end ? daysDiff(TODAY, parseTL(it.column_values?.timerange_mkzcqv0j).end) : 0; return <span style={{ fontFamily: "var(--mono)", color: "var(--red)", fontWeight: 700, minWidth: 30, fontSize: 10 }}>-{d}d</span>; } },
            { items: an.stoppedWeek || [], label: "🚫 Detenidos esta semana", color: "var(--red)" },
            { items: an.noCrono || [], label: "📅 Sprint sin Fecha", color: "var(--yellow)" },
            { items: an.backlogWithDates || [], label: "📅 Backlog con Fecha", color: "var(--yellow)" },
            { items: an.noResp || [], label: "👤 Sin responsable", color: "var(--tx3)", showSquad: true },
          ].filter((g) => g.items.length > 0).map((g, gi) => (
            <Card key={gi} style={{ marginBottom: 8, borderLeft: `4px solid ${g.color}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: g.color }}>{g.label}</span>
                <span style={{ fontFamily: "var(--mono)", fontSize: 16, fontWeight: 700, color: g.color }}>{g.items.length}</span>
              </div>
              <div style={{ maxHeight: 220, overflowY: "auto" }}>
                {g.items.map((it) => {
                  const sq = SQUADS.find((s) => s.name === normalizeSquad(it.column_values?.color_mkz0s203));
                  return (
                    <div key={it.id} style={{ display: "flex", gap: 6, alignItems: "center", padding: "4px 0", borderBottom: "1px solid var(--bg3)", fontSize: 12 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: sq?.color || "var(--tx3)", flexShrink: 0 }} />
                      {g.extra && g.extra(it)}
                      <span style={{ flex: 1, color: "var(--tx)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</span>
                      {g.showSquad
                        ? <span style={{ fontSize: 10, fontWeight: 700, color: sq?.color || "var(--tx3)", background: (sq?.color || "#888") + "20", borderRadius: 4, padding: "2px 7px", flexShrink: 0 }}>{sq?.name?.split(" ")[0] || "?"}</span>
                        : <span style={{ color: "var(--tx3)", fontSize: 11 }}>{shortName(it.column_values?.person)}</span>}
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}
          {(an.overdue || []).length === 0 && (an.stoppedWeek || []).length === 0 && (an.noCrono || []).length === 0 && (
            <Card style={{ textAlign: "center", padding: 24 }}><div style={{ fontSize: 28, marginBottom: 4 }}>✅</div><div style={{ color: "var(--green)", fontSize: 14, fontWeight: 600 }}>Sin alertas de gobernanza</div></Card>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 13: TAB FOCOS
   ═══════════════════════════════════════════════════════════════ */

export default TabPanorama
