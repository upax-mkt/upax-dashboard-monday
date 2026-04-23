'use client'
// lib/minuta.js — generador de texto plano de la minuta
import { TODAY_STR, SQUADS, PERSONAS } from './constants'
import { WEEK, shortName, normalizeSquad } from './utils'

export function generateMinuta(wd, analysis, gddData, blockTimes) {
  const an = analysis, comps = wd?.compromisos || [];
  const dateStr = new Date(TODAY_STR).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const LINE = "─".repeat(48);
  const arrow = (cur, prev) => { if (!prev) return ""; const p = Math.abs(Math.round(((cur-prev)/prev)*100)); return cur >= prev ? `▲${p}%` : `▼${p}%`; };
  const fmtM = (v) => v >= 1000000 ? `$${(v/1000000).toFixed(1)}M` : v >= 1000 ? `$${(v/1000).toFixed(0)}K` : `$${v||0}`;
  let t = "";

  t += `WEEKLY MKT CORP · ${dateStr.toUpperCase()}\n${LINE}\n\n`;

  // 1. GENERACIÓN DE DEMANDA
  {
    const gdd = gddData || { semana: {}, anterior: {}, ytd: {}, fechas: {} };
    const s = gdd.semana || {}, a = gdd.anterior || {}, y = gdd.ytd || {}, f = gdd.fechas || {};
    const pTotal = (s.pipeline_mkt||0) + (s.pipeline_com||0);
    const hasData = s.leads || s.mqls || s.sqls || s.opps;
    t += `1. GENERACIÓN DE DEMANDA`;
    if (f.semana_desde) t += ` (${f.semana_desde}${f.semana_hasta ? " al "+f.semana_hasta : ""})`;
    t += `\n`;
    if (hasData) {
      const fmt4 = (label, cur, prev) => {
        const pct = arrow(cur, prev);
        return `   · ${label.padEnd(8)} ${String(cur.toLocaleString()).padStart(6)}${pct ? "  "+pct : ""}\n`;
      };
      t += fmt4("Leads", s.leads||0, a.leads||0);
      t += fmt4("MQLs",  s.mqls||0,  a.mqls||0);
      t += fmt4("SQLs",  s.sqls||0,  a.sqls||0);
      t += fmt4("Opps",  s.opps||0,  a.opps||0);
      if (pTotal > 0) t += `   · Pipeline  ${fmtM(pTotal)}  (Mkt ${fmtM(s.pipeline_mkt||0)} | Com ${fmtM(s.pipeline_com||0)})\n`;
      if (y.leads) t += `   · YTD: Leads ${y.leads.toLocaleString()} · MQLs ${y.mqls||0} · SQLs ${y.sqls||0} · Opps ${y.opps||0}\n`;
    } else {
      t += `   (sin datos — editar en Home > GdD)\n`;
    }
    t += `\n`;
  }
  // 2. PANORAMA OPERATIVO
  if (an) {
    const spr = an.byPhase["🚧 Sprint"]||0, rev = an.byPhase["👀 Review"]||0;
    const mod = an.byPhase["⚙️ Modificación"]||0, det = an.byPhase["🚫 Detenido"]||0;
    const ven = (an.overdue||[]).length, done = (an.doneLastWeek||[]).length;
    t += `2. PANORAMA OPERATIVO\n`;
    const actSem = (an.byPhaseWeek?.["🚧 Sprint"]||0)+(an.byPhaseWeek?.["👀 Review"]||0)+(an.byPhaseWeek?.["⚙️ Modificación"]||0);
    t += `   Esta semana: ${actSem}  |  Total activos: ${spr+rev+mod}  |  Detenidos: ${det}  |  Vencidos: ${ven}  |  Done sem.: ${done}\n`;
    SQUADS.forEach(sq => {
      const d = an.bySquad[sq.name]; if (!d) return;
      const act = (d.phases["🚧 Sprint"]||0)+(d.phases["👀 Review"]||0)+(d.phases["⚙️ Modificación"]||0);
      const det2 = d.phases["🚫 Detenido"]||0;
      const ven2 = (an.overdue||[]).filter(it => normalizeSquad(it.column_values?.color_mkz0s203) === sq.name).length;
      if (act > 0 || det2 > 0 || ven2 > 0) {
        t += `   · ${sq.name}: ${act} activos`;
        if (det2) t += `, ${det2} detenido${det2>1?"s":""}`;
        if (ven2) t += `, ${ven2} vencido${ven2>1?"s":""}`;
        t += `\n`;
      }
    });
    t += `\n`;
  }

  // 3. FOCOS POR SQUAD
  const hasEntries = SQUADS.some(sq => {
    const raw = wd?.focos?.[sq.id];
    const arr = Array.isArray(raw) ? raw : (raw?.focos||raw?.blocker||raw?.necesito ? [raw] : []);
    return arr.some(f => f.focos?.trim()||f.blocker?.trim()||f.necesito?.trim());
  });

  if (hasEntries) {
    t += `3. FOCOS POR SQUAD\n`;
    SQUADS.forEach(sq => {
      const raw = wd?.focos?.[sq.id];
      const arr = Array.isArray(raw) ? raw : (raw?.focos||raw?.blocker||raw?.necesito ? [raw] : []);
      const filled = arr.filter(f => f.focos?.trim()||f.blocker?.trim()||f.necesito?.trim());
      if (!filled.length) return;
      const presenter = wd?.presenters?.[sq.id] || sq.lead;
      t += `\n   ${sq.name.toUpperCase()} (${presenter})\n`;
      filled.forEach(f => {
        if (f.focos?.trim()) {
          const parts = f.focos.split(/\d+\)/).map(s => s.trim()).filter(Boolean);
          if (parts.length > 1) parts.forEach(l => { t += `   · ${l}\n`; });
          else t += `   · ${f.focos.trim()}\n`;
        }
        if (f.blocker?.trim()) {
          t += `   ⚠ BLOCKER: ${f.blocker.trim()}`;
          if (f.blocker_quien) t += ` → ${shortName(f.blocker_quien)}`;
          if (f.blocker_cuando) t += ` (${new Date(f.blocker_cuando+"T12:00:00").toLocaleDateString("es-MX",{day:"numeric",month:"short"})})`;
          t += `\n`;
        }
        if (f.necesito?.trim()) {
          t += `   ✋ NECESITO: ${f.necesito.trim()}`;
          if (f.necesito_quien) t += ` → ${shortName(f.necesito_quien)}`;
          if (f.necesito_cuando) t += ` (${new Date(f.necesito_cuando+"T12:00:00").toLocaleDateString("es-MX",{day:"numeric",month:"short"})})`;
          t += `\n`;
        }
      });
    });
    t += `\n`;
  }

  // 4. COMPROMISOS
  const openComps = comps.filter(c => c.que?.trim());
  if (openComps.length) {
    t += `4. COMPROMISOS\n`;
    openComps.forEach(c => {
      const fecha = c.cuando ? new Date(c.cuando+"T12:00:00").toLocaleDateString("es-MX",{day:"numeric",month:"short"}) : "sin fecha";
      const status = c.status === "done" ? "✓" : "○";
      t += `   ${status} ${c.que.trim()} · ${shortName(c.quien)||"sin asignar"} · ${fecha}\n`;
    });
    t += `\n`;
  }

  // 5. CARGA SEMANAL — todo el equipo en 2 columnas
  if (an) {
    const all = Object.entries(an.byPersonWeek)
      .filter(([name]) => PERSONAS.some(p => p.name === name && !p.sdr))
      .sort((a, b) => b[1].total - a[1].total);
    if (all.length) {
      const maxVal = all[0][1].total || 1;
      t += `5. CARGA SEMANAL (${WEEK.start.toLocaleDateString("es-MX",{day:"numeric",month:"short"})} – ${WEEK.end.toLocaleDateString("es-MX",{day:"numeric",month:"short"})})\n`;
      const half = Math.ceil(all.length / 2);
      const col1 = all.slice(0, half);
      const col2 = all.slice(half);
      const maxLen = col1.length;
      for (let i = 0; i < maxLen; i++) {
        // columna izquierda
        const [p1, d1] = col1[i] || ["", { total: 0, stopped: 0 }];
        const bar1 = p1 ? "█".repeat(Math.min(Math.round((d1.total/maxVal)*8), 8)) + (d1.total > 10 ? "▸" : " ") : "";
        const flag1 = d1.stopped > 0 ? "🚫" : "  ";
        const left = p1 ? `   ${String(i+1).padStart(2)}. ${shortName(p1).padEnd(14)} ${bar1.padEnd(10)} ${String(d1.total).padStart(2)} ${flag1}` : "";
        // columna derecha
        const [p2, d2] = col2[i] || ["", { total: 0, stopped: 0 }];
        const bar2 = p2 ? "█".repeat(Math.min(Math.round((d2.total/maxVal)*8), 8)) + (d2.total > 10 ? "▸" : " ") : "";
        const flag2 = d2 ? (d2.stopped > 0 ? "🚫" : "  ") : "";
        const right = p2 ? `  ${String(i+half+1).padStart(2)}. ${shortName(p2).padEnd(14)} ${bar2.padEnd(10)} ${String(d2.total).padStart(2)} ${flag2}` : "";
        t += `${left}${right}\n`;
      }
      t += `\n`;
    }
  }

  t += `${LINE}\nWeekly Mkt Corp · ${new Date().toLocaleTimeString("es-MX",{hour:"2-digit",minute:"2-digit"})}\n`;
  return t;
}
/* ═══════════════════════════════════════════════════════════════
   SECTION 6: CSS
   ═══════════════════════════════════════════════════════════════ */
