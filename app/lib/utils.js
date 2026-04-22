'use client'
// lib/utils.js — funciones puras de fecha, análisis y helpers
import { TODAY_STR, TODAY, PERSONAS, SQUADS, SQUAD_ALIASES, PHASES, normalizeSquad as _normalizeSquad } from './constants'

// Re-export de constants.js para compatibilidad con imports existentes
export const normalizeSquad = _normalizeSquad;

export const PERSON_NAMES = PERSONAS.map((p) => p.name);
// Cache module-level para normalizePersonName — evita ~25k comparaciones de string por análisis (P3.2)
export const _nameNormCache = new Map();
export function normalizePersonName(mondayName) {
  if (!mondayName) return mondayName;
  if (_nameNormCache.has(mondayName)) return _nameNormCache.get(mondayName);
  // resultado se calcula abajo y se cachea antes de retornar
  if (!mondayName) return mondayName;
  // Exact match
  if (PERSON_NAMES.includes(mondayName)) {
    _nameNormCache.set(mondayName, mondayName);
    return mondayName;
  }
  const lower = mondayName.toLowerCase();
  // Intento 1: todas las palabras del nombre de PERSONAS están en el nombre de Monday
  for (const pn of PERSON_NAMES) {
    const parts = pn.toLowerCase().split(" ");
    if (parts.every(p => lower.includes(p))) { _nameNormCache.set(mondayName, pn); return pn; }
  }
  // Intento 2: primer nombre + al menos un apellido coincide
  for (const pn of PERSON_NAMES) {
    const parts = pn.toLowerCase().split(" ");
    if (parts.length >= 2 && lower.includes(parts[0]) && parts.slice(1).some(p => lower.includes(p))) { _nameNormCache.set(mondayName, pn); return pn; }
  }
  // Intento 3: solo primer nombre (para nombres únicos como "Diego", "Arath")
  for (const pn of PERSON_NAMES) {
    const firstName = pn.toLowerCase().split(" ")[0];
    if (firstName.length > 4 && lower.startsWith(firstName)) {
      _nameNormCache.set(mondayName, pn);
      return pn;
    }
  }
  _nameNormCache.set(mondayName, mondayName);
  return mondayName;
}
export function isTeamMember(name) { return PERSON_NAMES.includes(normalizePersonName(name)); }

export function parseTL(t) {
  if (!t || typeof t !== "string") return { start: null, end: null };
  const p = t.split(" - ");
  return { start: p[0] ? new Date(p[0]) : null, end: p[1] ? new Date(p[1]) : null };
}
// Suma N días a un string YYYY-MM-DD sin usar timezone — puro aritmética de fecha
export function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d + n); // new Date(y, m, d) usa hora LOCAL, no UTC
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}-${String(dt.getDate()).padStart(2,"0")}`;
}
// Calcula el lunes de la semana de un string YYYY-MM-DD
export function getMondayStr(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const day = dt.getDay(); // 0=Dom, 1=Lun...
  const daysToMon = day === 0 ? 6 : day - 1;
  return addDays(dateStr, -daysToMon);
}
export function daysDiff(a, b) { return Math.round((a - b) / 86400000); }
export function isOverdue(it) {
  const ph = it.column_values?.color_mkz09na;
  if (ph === "✅ Done" || ph === "🚫 Detenido") return false;
  const tl = parseTL(it.column_values?.timerange_mkzcqv0j);
  return tl.end ? tl.end < TODAY : false;
}
export function isActive(ph) { return ["🚧 Sprint", "👀 Review", "⚙️ Modificación"].includes(ph); }

export function getWeekBounds() {
  // Semana ACTUAL (lunes al viernes de esta semana calendario)
  // Alineado con Monday.com "esta semana"
  const now = new Date(TODAY_STR);
  const day = now.getDay(); // 0=Dom, 1=Lun, 2=Mar...
  const mon = new Date(now);
  // Retroceder al lunes de esta semana
  if (day === 0) mon.setDate(now.getDate() - 6); // Domingo → lunes anterior
  else mon.setDate(now.getDate() - (day - 1));    // Lun=0, Mar=1, Mié=2...
  const fri = new Date(mon);
  fri.setDate(mon.getDate() + 4);
  return { start: mon, end: fri };
}
export const WEEK = getWeekBounds();

// PREV_WEEK: semana que acaba de terminar antes de la weekly
// Basada en el ÚLTIMO lunes (no el próximo), para capturar entregas reales
export function getPrevWeekBounds() {
  const now = new Date(TODAY_STR);
  const day = now.getDay(); // 0=Dom, 1=Lun...
  const lastMon = new Date(now);
  lastMon.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  const prevStart = new Date(lastMon);
  prevStart.setDate(lastMon.getDate() - 7);
  const prevEnd = new Date(lastMon);
  prevEnd.setDate(lastMon.getDate() - 1);
  return { start: prevStart, end: prevEnd };
}
export const PREV_WEEK = getPrevWeekBounds();

export function overlapsThisWeek(timelineStr) {
  if (!timelineStr) return false;
  const tl = parseTL(timelineStr);
  if (!tl.start || !tl.end) return false;
  return tl.start <= WEEK.end && tl.end >= WEEK.start;
}
export function pctColor(pct) { return pct >= 80 ? "var(--green)" : pct >= 50 ? "var(--yellow)" : "var(--red)"; }
export function shortName(n) { return (n || "—").split(" ").slice(0, 2).join(" "); }

export function getPersonDetail(name, items) {
  const weekTasks = [], otherTasks = [];
  const nameWords = name.toLowerCase().split(" ");
  const matchesPerson = (personStr) => {
    if (!personStr) return false;
    const lower = personStr.toLowerCase();
    return nameWords.every((w) => lower.includes(w));
  };
  items.forEach((it) => {
    const cv = it.column_values || {}, ph = cv.color_mkz09na;
    if (!isActive(ph) && ph !== "🚫 Detenido") return;
    const parentTimeline = cv.timerange_mkzcqv0j;
    const parentThisWeek = overlapsThisWeek(parentTimeline);
    (it.subitems || []).forEach((sub) => {
      const subPhase = sub.column_values?.color_mkzjvp66;
      if (!matchesPerson(sub.column_values?.person) || subPhase === "✅ Done") return;
      const subTimeline = sub.column_values?.timerange_mkzx7r55;
      const subThisWeek = subTimeline ? overlapsThisWeek(subTimeline) : false;
      const task = { name: sub.name, parentName: it.name, phase: subPhase || "🚧 Sprint" };
      if (subThisWeek) weekTasks.push(task);
      else otherTasks.push(task);
    });
    if ((it.subitems || []).length === 0 && matchesPerson(cv.person)) {
      const task = { name: it.name, parentName: null, phase: ph };
      if (parentThisWeek) weekTasks.push(task);
      else otherTasks.push(task);
    }
  });
  return { weekTasks, otherTasks, weekCount: weekTasks.length, totalCount: weekTasks.length + otherTasks.length };
}

export const PHASE_SHORT = {
  "⏳Backlog": { label: "BKL", color: "#8E8E93" },
  "🚧 Sprint": { label: "SPR", color: "#F59E0B" },
  "👀 Review": { label: "REV", color: "#06B6D4" },
  "⚙️ Modificación": { label: "MOD", color: "#A855F7" },
  "🚫 Detenido": { label: "DET", color: "#EF4444" },
};

export function downloadTextFile(text, filename) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.style.display = "none";
  document.body.appendChild(a); a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
}

export async function copyToClipboard(text) {
  // Modern API (navigator.clipboard) con fallback a execCommand
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback below
    }
  }
  // Fallback para contextos sin permisos o browsers legacy
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.cssText = "position:fixed;left:-9999px;top:-9999px;opacity:0";
  document.body.appendChild(ta); ta.focus(); ta.select();
  let ok = false;
  try { ok = document.execCommand("copy"); } catch {}
  document.body.removeChild(ta);
  return ok;
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 3: STORAGE
   ═══════════════════════════════════════════════════════════════ */

const WEEKLY_MAR23 = {
  date: "2026-03-23",
  presenters: { inbound: "Arath Escamilla", performance: "Fernando Borges", revops: "Diego Luna", portafolio: "Sergio Franco", outbound: "Leodegario" },
  focos: {
    inbound: [{ focos: "1) Campaña Diagnóstico UPAX: en producción, pendiente VoBo de UDNs. 2) Campaña 20 Años Promo Espacio: desarrollo creativo en curso. 3) Blog editorial abril: planificación de contenidos. 4) Gestión de credenciales Promo Espacio.", blocker: "Pendiente VoBo de UDNs para liberar artes de Campaña Diagnóstico", blocker_quien: "Jean Pierre Barroilhet", blocker_cuando: "2026-03-25", necesito: "1) Validar preguntas para Pedro de Zeus. 2) Alinear con Iris el Diagnóstico UPAX", necesito_quien: "Iris Múgica", necesito_cuando: "2026-03-24", ts: 1742767200000 }],
    performance: [{ focos: "1) Mockups sitio Salud (producto). 2) Landing TalentLand Zeus. 3) Campaña Aniversario. 4) Ajustes web en 2 UDNs. 5) Estrategia Círculo Rojo Paid.", blocker: "Falta Ficha Madre de César para TalentLand", blocker_quien: "César Mejía", blocker_cuando: "2026-03-25", necesito: "Parrilla de Paid Media para Campaña Diagnóstico", necesito_quien: "Andry Carvajal", necesito_cuando: "2026-03-23", ts: 1742767200000 }],
    revops: [{ focos: "1) Resultados modelo Lead Scoring. 2) Modelo Brújula Comercial. 3) Actualización CRM.", necesito: "Fecha boceto META ADS, Metas SDR Q2, Detalle FM LP Círculo Rojo, Sesión Andry posts bot WA, Visibilidad campañas, BBDD UDNs bot WA", necesito_quien: "Iris Múgica", necesito_cuando: "2026-03-26", ts: 1742767200000 }],
    portafolio: [{ focos: "1) ResearchLand: nuevo producto. 2) Zeus: RECLU. 3) Reuniones NR, HoF, Mexa. 4) UiX: credenciales. 5) PE: carpeta materiales.", blocker: "Artes de canales no aprobados, frena publicación en redes UDNs", blocker_quien: "David Porchini", blocker_cuando: "2026-03-30", necesito: "Outbound explique storytelling de secuencias", necesito_quien: "Ileana Cruz", necesito_cuando: "2026-03-25", ts: 1742767200000 }],
    outbound: [{ focos: "1) Roleplay objeciones SDRs. 2) Optimización secuencias Q2. 3) Validación matriz objeciones con UDNs.", necesito: "VoBo JP en secuencias, UTMs por UDN, Fecha vista Outbound en Looker", necesito_quien: "Jean Pierre Barroilhet", necesito_cuando: "2026-03-27", ts: 1742767200000 }],
  },
  compromisos: [{ id: 1742767200001, que: "Toda tarea en Monday debe incluir: qué se entrega, cuándo, para qué sirve y quién es responsable", quien: "Víctor Tzili", cuando: "2026-04-06", status: "pending" }],
  synced: [],
  minutaText: "📋 MINUTA WEEKLY lunes, 23 de marzo de 2026\n════════════════════════════════════════════\n\n📊 GENERACIÓN DE DEMANDA (16-22 mar)\n  Leads: 1,186 ↓24% | MQLs: 30 ↓43% | SQLs: 10 ↓17% | Opps: 22 ↑10%\n  Pipeline: (pendiente validación con César)\n  YTD: Leads 14,636 | MQLs 957 | SQLs 225 | Opps 330\n\n📊 PANORAMA OPERATIVO\nSprint: 77 | Review: 5 | Mod: 4 | Detenido: 26 | Vencidos: 8\n\n🎯 REPORTE POR SQUAD\n▸ Inbound Studio (Arath Escamilla):\n  🎯 Campaña Diagnóstico, 20 años PE, blog abril, credenciales PE\n  🚫 BLOCKER: Pendiente VoBo UDNs → Jean Pierre (25 mar)\n  🤝 NECESITO: Alinear Diagnóstico UPAX → Iris (24 mar)\n\n▸ Performance y Conversión (Fernando Borges):\n  🎯 Mockups Salud, Landing TalentLand, Campaña Aniversario, CRO 2 UDNs, Círculo Rojo Paid\n  🚫 BLOCKER: Falta Ficha Madre César para TalentLand LP → César (25 mar)\n  🤝 NECESITO: Parrilla Paid Media Diagnóstico → Andry (23 mar)\n\n▸ RevOps & Analytics (Diego Luna):\n  🎯 Lead Scoring, Brújula Comercial, CRM\n  🤝 NECESITO: META ADS, SDR Q2, FM LP, Bot WA posts, UTMs campañas, BBDD UDNs → varios (26 mar)\n\n▸ Portafolio y Ecosistema (Sergio Franco):\n  🎯 ResearchLand, Zeus RECLU, reuniones UDNs, UiX credenciales, PE materiales\n  🚫 BLOCKER: Artes no aprobados, frena redes → David (30 mar)\n  🤝 NECESITO: Storytelling secuencias → Ileana (25 mar)\n\n▸ Outbound y Pipeline (Leodegario):\n  🎯 Roleplay objeciones, secuencias Q2, matriz objeciones UDNs\n  🤝 NECESITO: VoBo JP secuencias, UTMs, vista Outbound Looker → JP/César\n\n📝 COMPROMISOS\n1. Toda tarea en Monday debe incluir qué se entrega, cuándo, para qué sirve y quién → Víctor Tzili | 2026-04-06\n",
};

const emptyWeekly = () => ({ date: TODAY_STR, presenters: {}, focos: {}, compromisos: [], synced: [] });

// ─── Storage: Next.js API route (/api/storage) ───────────────────
