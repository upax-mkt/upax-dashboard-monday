'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from "react";

/* ═══════════════════════════════════════════════════════════════
   SECTION 1: CONSTANTS
   ═══════════════════════════════════════════════════════════════ */

const BOARD_ID = 18044324200;
const GROUP_DELIVERY = "group_mm15cfz2"; // único grupo de trabajo
const GROUP_ACUERDOS = "group_mm1mhsd1"; // para crear compromisos de weekly
const MCP_URL = "https://mcp.monday.com/mcp";
const SLACK_MCP_URL = "https://mcp.slack.com/mcp";
const SLACK_GENERAL_CHANNEL = "C081Z8R4ZH9";
const COL_IDS = ["person","color_mkz0s203","color_mkz09na","timerange_mkzcqv0j","date_mm1b10rx","date_mkzchmsq","color_mkzjvp66","timerange_mkzx7r55"];
const TODAY_STR = new Date().toISOString().split("T")[0];
const TODAY = new Date(TODAY_STR);
const STORE_KEY = `weekly:${TODAY_STR}`;
const CACHE_KEY = "monday-cache";

const SQUADS = [
  { id: "inbound",     name: "Inbound Studio",          color: "#FF375F", lead: "Jean Pierre" },
  { id: "performance", name: "Performance y Conversión", color: "#30D158", lead: "Iris" },
  { id: "revops",      name: "RevOps & Analytics",       color: "#0A84FF", lead: "César" },
  { id: "portafolio",  name: "Portafolio y Ecosistema",  color: "#FF2D97", lead: "David" },
  { id: "outbound",    name: "Outbound y Pipeline",      color: "#FFD60A", lead: "Ileana" },
];

const SQUAD_ALIASES = {
  "REVOPS Y ANALITYCS": "RevOps & Analytics",
  "Portafolio y ecosistema": "Portafolio y Ecosistema",
  "PR & Brand": "Portafolio y Ecosistema",
  "RevOps": "RevOps & Analytics",
  "Mkt Digital": "Performance y Conversión",
  "Squad 1": "Inbound Studio",
  "Squad 2": "Portafolio y Ecosistema",
  "Squad 3": "Performance y Conversión",
  "Mkt Corp": "Mkt Corp",
  "Seleccionar": "Sin asignar",
};

const PHASES = {
  "⏳Backlog": "#475569", "🚧 Sprint": "#F59E0B", "👀 Review": "#06B6D4",
  "⚙️ Modificación": "#A855F7", "✅ Done": "#22C55E", "🚫 Detenido": "#EF4444",
};

const AGENDA = [
  { id: "apertura",    label: "Apertura CMO",         fixed: "Franco",          start: 0,  dur: 5,  color: "#8E8E93", tab: "home" },
  { id: "panorama",   label: "Panorama Semanal",      fixed: "Víctor",          start: 5,  dur: 10, color: "#818CF8", tab: "panorama" },
  { id: "inbound",    label: "Inbound Studio",        squad: true,              start: 15, dur: 5,  color: "#FF375F", tab: "focos", sq: "inbound" },
  { id: "performance",label: "Performance",           squad: true,              start: 20, dur: 5,  color: "#30D158", tab: "focos", sq: "performance" },
  { id: "revops",     label: "RevOps",                squad: true,              start: 25, dur: 5,  color: "#0A84FF", tab: "focos", sq: "revops" },
  { id: "portafolio", label: "Portafolio",            squad: true,              start: 30, dur: 5,  color: "#FF2D97", tab: "focos", sq: "portafolio" },
  { id: "outbound",   label: "Outbound",              squad: true,              start: 35, dur: 5,  color: "#FFD60A", tab: "focos", sq: "outbound" },
  { id: "cross",      label: "Cross-Squad",           fixed: "Líderes",         start: 40, dur: 10, color: "#A855F7", tab: "focos", sq: "cross" },
  { id: "cierre",     label: "Compromisos y Cierre",  fixed: "Víctor + Franco", start: 50, dur: 10, color: "#8E8E93", tab: "compromisos" },
];

const PERSONAS = [
  { name: "Franco Cruzat",           squad: "CMO",                    star: true },
  { name: "Víctor Tzili",            squad: "PMO",                    star: true },
  { name: "Jean Pierre Barroilhet",  squad: "Inbound Studio",         star: true },
  { name: "Paul Zárate",             squad: "Inbound Studio" },
  { name: "Andrea Jurado",           squad: "Inbound Studio" },
  { name: "Arath Escamilla",         squad: "Inbound Studio" },
  { name: "Andry Carvajal",          squad: "Inbound Studio" },
  { name: "Alejandro Maciel",        squad: "Inbound Studio" },
  { name: "Iris Múgica",             squad: "Performance y Conversión", star: true },
  { name: "Fernando Borges",         squad: "Performance y Conversión" },
  { name: "Marco Antonio Juárez",    squad: "Performance y Conversión" },
  { name: "Diana Cruz",              squad: "Performance y Conversión" },
  { name: "Santiago Arango",         squad: "Performance y Conversión" },
  { name: "César Mejía",             squad: "RevOps & Analytics",     star: true },
  { name: "Adrián González",         squad: "RevOps & Analytics" },
  { name: "Diego Luna",              squad: "RevOps & Analytics" },
  { name: "David Porchini",          squad: "Portafolio y Ecosistema", star: true },
  { name: "Cyndi Pérez",             squad: "Portafolio y Ecosistema" },
  { name: "Carolina Rojas",          squad: "Portafolio y Ecosistema" },
  { name: "Sergio Franco",           squad: "Portafolio y Ecosistema" },
  { name: "Tairi Medina",            squad: "Portafolio y Ecosistema" },
  { name: "Ileana Cruz",             squad: "Outbound y Pipeline",    star: true },
  { name: "Jennifer",                squad: "Outbound y Pipeline",    sdr: true },
  { name: "Edna",                    squad: "Outbound y Pipeline",    sdr: true },
  { name: "Neyby",                   squad: "Outbound y Pipeline",    sdr: true },
  { name: "Leodegario",              squad: "Outbound y Pipeline",    sdr: true },
  { name: "Aliosha",                 squad: "Outbound y Pipeline",    sdr: true },
  { name: "Elizabeth Gómez",         squad: "Outbound y Pipeline",    sdr: true },
];

const MONDAY_USERS = {
  "Franco Cruzat": 65476480, "Víctor Tzili": 67444758,
  "Jean Pierre Barroilhet": 68748021, "Paul Zárate": 65476499,
  "Andrea Jurado": 80225986, "Arath Escamilla": 71090387,
  "Andry Carvajal": 98248405, "Alejandro Maciel": 77343229,
  "Iris Múgica": 65476486, "Fernando Borges": 77871300,
  "Marco Antonio Juárez": 69017925, "Diana Cruz": 70199066,
  "Santiago Arango": 77820047, "César Mejía": 67757625,
  "Adrián González": 77017562, "Diego Luna": 76944156,
  "David Porchini": 65476492, "Cyndi Pérez": 67054348,
  "Carolina Rojas": 72959487, "Sergio Franco": 70061556,
  "Tairi Medina": 67627150, "Ileana Cruz": 65476115,
  "Elizabeth Gómez": 76801151,
};

/* ═══════════════════════════════════════════════════════════════
   SECTION 2: UTILITIES
   ═══════════════════════════════════════════════════════════════ */

function normalizeSquad(raw) { return SQUAD_ALIASES[raw] || raw; }

const PERSON_NAMES = PERSONAS.map((p) => p.name);
function normalizePersonName(mondayName) {
  if (!mondayName) return mondayName;
  // Exact match
  if (PERSON_NAMES.includes(mondayName)) return mondayName;
  const lower = mondayName.toLowerCase();
  // Intento 1: todas las palabras del nombre de PERSONAS están en el nombre de Monday
  for (const pn of PERSON_NAMES) {
    const parts = pn.toLowerCase().split(" ");
    if (parts.every(p => lower.includes(p))) return pn;
  }
  // Intento 2: primer nombre + al menos un apellido coincide
  for (const pn of PERSON_NAMES) {
    const parts = pn.toLowerCase().split(" ");
    if (parts.length >= 2 && lower.includes(parts[0]) && parts.slice(1).some(p => lower.includes(p))) return pn;
  }
  // Intento 3: solo primer nombre (para nombres únicos como "Diego", "Arath")
  for (const pn of PERSON_NAMES) {
    const firstName = pn.toLowerCase().split(" ")[0];
    if (firstName.length > 4 && lower.startsWith(firstName)) return pn;
  }
  return mondayName;
}
function isTeamMember(name) { return PERSON_NAMES.includes(normalizePersonName(name)); }

function parseTL(t) {
  if (!t || typeof t !== "string") return { start: null, end: null };
  const p = t.split(" - ");
  return { start: p[0] ? new Date(p[0]) : null, end: p[1] ? new Date(p[1]) : null };
}
function daysDiff(a, b) { return Math.round((a - b) / 86400000); }
function isOverdue(it) {
  const ph = it.column_values?.color_mkz09na;
  if (ph === "✅ Done" || ph === "🚫 Detenido") return false;
  const tl = parseTL(it.column_values?.timerange_mkzcqv0j);
  return tl.end ? tl.end < TODAY : false;
}
function isActive(ph) { return ["🚧 Sprint", "👀 Review", "⚙️ Modificación"].includes(ph); }

function getWeekBounds() {
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
const WEEK = getWeekBounds();

// PREV_WEEK: semana que acaba de terminar antes de la weekly
// Basada en el ÚLTIMO lunes (no el próximo), para capturar entregas reales
function getPrevWeekBounds() {
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
const PREV_WEEK = getPrevWeekBounds();

function overlapsThisWeek(timelineStr) {
  if (!timelineStr) return false;
  const tl = parseTL(timelineStr);
  if (!tl.start || !tl.end) return false;
  return tl.start <= WEEK.end && tl.end >= WEEK.start;
}
function pctColor(pct) { return pct >= 80 ? "var(--green)" : pct >= 50 ? "var(--yellow)" : "var(--red)"; }
function shortName(n) { return (n || "—").split(" ").slice(0, 2).join(" "); }

function getPersonDetail(name, items) {
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

const PHASE_SHORT = {
  "⏳Backlog": { label: "BKL", color: "#8E8E93" },
  "🚧 Sprint": { label: "SPR", color: "#F59E0B" },
  "👀 Review": { label: "REV", color: "#06B6D4" },
  "⚙️ Modificación": { label: "MOD", color: "#A855F7" },
  "🚫 Detenido": { label: "DET", color: "#EF4444" },
};

function downloadTextFile(text, filename) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.style.display = "none";
  document.body.appendChild(a); a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
}

function copyToClipboard(text) {
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
  minutaText: "📋 MINUTA WEEKLY lunes, 23 de marzo de 2026\n════════════════════════════════════════════\n\n📊 GENERACIÓN DE DEMANDA (16-22 mar)\n  Leads: 1,186 ↓24% | MQLs: 30 ↓43% | SQLs: 10 ↓17% | Opps: 22 ↑10%\n  Pipeline: $159.3M (Mkt $58.9M | Com $100.4M)\n  YTD: Leads 14,636 | MQLs 957 | SQLs 225 | Opps 330\n\n📊 PANORAMA OPERATIVO\nSprint: 77 | Review: 5 | Mod: 4 | Detenido: 26 | Vencidos: 8\n\n🎯 REPORTE POR SQUAD\n▸ Inbound Studio (Arath Escamilla):\n  🎯 Campaña Diagnóstico, 20 años PE, blog abril, credenciales PE\n  🚫 BLOCKER: Pendiente VoBo UDNs → Jean Pierre (25 mar)\n  🤝 NECESITO: Alinear Diagnóstico UPAX → Iris (24 mar)\n\n▸ Performance y Conversión (Fernando Borges):\n  🎯 Mockups Salud, Landing TalentLand, Campaña Aniversario, CRO 2 UDNs, Círculo Rojo Paid\n  🚫 BLOCKER: Falta Ficha Madre César para TalentLand LP → César (25 mar)\n  🤝 NECESITO: Parrilla Paid Media Diagnóstico → Andry (23 mar)\n\n▸ RevOps & Analytics (Diego Luna):\n  🎯 Lead Scoring, Brújula Comercial, CRM\n  🤝 NECESITO: META ADS, SDR Q2, FM LP, Bot WA posts, UTMs campañas, BBDD UDNs → varios (26 mar)\n\n▸ Portafolio y Ecosistema (Sergio Franco):\n  🎯 ResearchLand, Zeus RECLU, reuniones UDNs, UiX credenciales, PE materiales\n  🚫 BLOCKER: Artes no aprobados, frena redes → David (30 mar)\n  🤝 NECESITO: Storytelling secuencias → Ileana (25 mar)\n\n▸ Outbound y Pipeline (Leodegario):\n  🎯 Roleplay objeciones, secuencias Q2, matriz objeciones UDNs\n  🤝 NECESITO: VoBo JP secuencias, UTMs, vista Outbound Looker → JP/César\n\n📝 COMPROMISOS\n1. Toda tarea en Monday debe incluir qué se entrega, cuándo, para qué sirve y quién → Víctor Tzili | 2026-04-06\n",
};

const emptyWeekly = () => ({ date: TODAY_STR, presenters: {}, focos: {}, compromisos: [], synced: [] });

// ─── Storage: Next.js API route (/api/storage) ───────────────────
async function storeGet(key) {
  try {
    const r = await fetch(`/api/storage?action=get&key=${encodeURIComponent(key)}`)
    const d = await r.json()
    if (!d.value) return null
    return typeof d.value === 'string' ? JSON.parse(d.value) : d.value
  } catch { return null }
}
async function storeSet(key, val) {
  try {
    await fetch('/api/storage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'set', key, value: JSON.stringify(val) }),
    })
  } catch {}
}
async function storeDel(key) {
  try {
    await fetch('/api/storage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', key }),
    })
  } catch {}
}
async function storeList(prefix) {
  try {
    const r = await fetch(`/api/storage?action=list&prefix=${encodeURIComponent(prefix)}`)
    const d = await r.json()
    if (d.keys?.length > 0) return d.keys
  } catch {}
  // Fallback: scan last 8 Mondays
  const base = new Date(TODAY_STR)
  const candidates = Array.from({ length: 8 }, (_, i) => {
    const d = new Date(base); d.setDate(base.getDate() - i * 7)
    return `weekly:${d.toISOString().split("T")[0]}`
  })
  const results = await Promise.all(candidates.map(async (k) => {
    const v = await storeGet(k); return v ? k : null
  }))
  return results.filter(Boolean)
}
async function storeGetRaw(key) {
  try {
    const r = await fetch(`/api/storage?action=get&key=${encodeURIComponent(key)}`)
    const d = await r.json()
    return d.value ? (typeof d.value === 'string' ? d.value : JSON.stringify(d.value)) : null
  } catch { return null }
}
async function storeSetRaw(key, val) {
  try {
    await fetch('/api/storage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'set', key, value: val }),
    })
  } catch {}
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 4: DATA LAYER — Next.js API routes
   Reemplaza MCP calls por fetch directo a rutas propias
   ═══════════════════════════════════════════════════════════════ */

async function fetchAllItems() {
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

async function createMondayItem(name, dateStr, personName) {
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

async function sendToSlack(text) {
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

function generateMinuta(wd, analysis, gddData, blockTimes) {
  const an = analysis, comps = wd?.compromisos || [];
  const dateStr = new Date(TODAY_STR).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const LINE = "─".repeat(48);
  const arrow = (cur, prev) => { if (!prev) return ""; const p = Math.abs(Math.round(((cur-prev)/prev)*100)); return cur >= prev ? `▲${p}%` : `▼${p}%`; };
  const fmtM = (v) => v >= 1000000 ? `$${(v/1000000).toFixed(1)}M` : v >= 1000 ? `$${(v/1000).toFixed(0)}K` : `$${v||0}`;
  let t = "";

  t += `WEEKLY MKT CORP · ${dateStr.toUpperCase()}\n${LINE}\n\n`;

  // 1. GENERACIÓN DE DEMANDA
  {
    const gdd = gddData || { semana: { leads:1186,mqls:30,sqls:10,opps:22,pipeline_mkt:58938625,pipeline_com:100372995 }, anterior: { leads:1554,mqls:53,sqls:12,opps:20 }, ytd: { leads:14636,mqls:957,sqls:225,opps:330 }, fechas: { semana_desde:"16 mar",semana_hasta:"22 mar" } };
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

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
*{box-sizing:border-box;margin:0}
:root{
  --bg:#FAFAFA;--bg2:#FFFFFF;--bg3:#F2F2F7;--bg4:#E5E5EA;
  --tx:#1D1D1F;--tx2:#3A3A3C;--tx3:#6E6E73;--border:#D1D1D6;
  --red:#FF3B30;--green:#34C759;--yellow:#FF9F0A;--blue:#007AFF;--purple:#AF52DE;--cyan:#5AC8FA;
  --shadow:0 1px 3px rgba(0,0,0,.06),0 2px 8px rgba(0,0,0,.04);
  --mono:'JetBrains Mono',monospace;--sans:'Inter',-apple-system,sans-serif;
  --r:14px;--r-sm:10px;--r-lg:18px;
}
body{background:var(--bg);font-family:var(--sans);color:var(--tx);-webkit-font-smoothing:antialiased;font-size:14px;line-height:1.5}
@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
@keyframes liveDot{0%,100%{transform:scale(1)}50%{transform:scale(1.8);opacity:.4}}
@keyframes glowPulse{0%,100%{box-shadow:0 0 0 0 rgba(52,199,89,.35)}50%{box-shadow:0 0 0 14px rgba(52,199,89,0)}}
.fade{animation:fadeIn .3s ease both}
input[type=range]{-webkit-appearance:none;height:6px;border-radius:3px;background:var(--bg4);outline:none;cursor:pointer;width:100%}
input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:20px;height:20px;border-radius:50%;background:#fff;border:2px solid var(--blue);box-shadow:0 1px 4px rgba(0,0,0,.15);cursor:pointer}
select{-webkit-appearance:auto}
::-webkit-scrollbar{width:5px}
::-webkit-scrollbar-thumb{background:var(--bg4);border-radius:3px}
::selection{background:rgba(0,122,255,.15)}
.presenter-mode [style*="fontSize: 11"]{font-size:14px !important}
.presenter-mode [style*="fontSize: 12"]{font-size:15px !important}
.presenter-mode [style*="fontSize: 13"]{font-size:16px !important}
.sticky-nav{position:sticky;top:0;z-index:90;background:var(--bg);border-bottom:1px solid var(--bg4);padding:0 20px;margin:0 -20px;}

@media print{body>div>*:not(#print-root){display:none!important}#print-root{display:block!important;position:static!important;background:#fff!important}#print-bar{display:none!important}}
@keyframes spin{to{transform:rotate(360deg)}}
@media(max-width:640px){
  .sticky-nav button{padding:8px 10px;font-size:11px}
  .sticky-nav{overflow-x:auto;-webkit-overflow-scrolling:touch}
  .mobile-stack{flex-direction:column!important}
  .mobile-hide{display:none!important}
  .mobile-full{width:100%!important;min-width:0!important}
  .kpi-grid-mobile{grid-template-columns:repeat(2,1fr)!important}
}
@media(max-width:480px){
  .mobile-xs-hide{display:none!important}
}
button:focus-visible{outline:2px solid var(--blue);outline-offset:2px}
select:focus-visible{outline:2px solid var(--blue);outline-offset:2px}
input:focus-visible{outline:2px solid var(--blue);outline-offset:2px}
textarea:focus-visible{outline:2px solid var(--blue);outline-offset:2px}`;

/* ═══════════════════════════════════════════════════════════════
   SECTION 7: SHARED UI COMPONENTS
   ═══════════════════════════════════════════════════════════════ */

function Bar({ segs, h = 20 }) {
  const t = segs.reduce((s, x) => s + x.v, 0); if (!t) return null;
  return (
    <div style={{ display: "flex", borderRadius: h / 2, overflow: "hidden", height: h, background: "var(--bg4)" }}>
      {segs.filter((x) => x.v > 0).map((x, i) => (
        <div key={i} title={`${x.l}: ${x.v}`} style={{ width: `${(x.v / t) * 100}%`, background: x.c, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, fontFamily: "var(--mono)", color: "#fff", minWidth: 16, transition: "width .4s ease" }}>
          {x.v > 2 ? x.v : ""}
        </div>
      ))}
    </div>
  );
}

function Card({ children, style = {} }) {
  return <div style={{ background: "var(--bg2)", borderRadius: "var(--r)", boxShadow: "var(--shadow)", padding: "18px 20px", ...style }}>{children}</div>;
}

function Chip({ label, active, color, onClick }) {
  return (
    <button onClick={onClick} style={{ background: active ? color : "var(--bg2)", color: active ? "#fff" : "var(--tx2)", border: active ? "none" : "1px solid var(--bg4)", borderRadius: 20, padding: "6px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "var(--sans)", transition: "all .2s", boxShadow: active ? `0 2px 8px ${color}40` : "var(--shadow)" }}>
      {label}
    </button>
  );
}

function Alerta({ icon, text, color = "var(--yellow)" }) {
  return (
    <div style={{ background: "var(--bg2)", borderRadius: "var(--r-sm)", borderLeft: `4px solid ${color}`, boxShadow: "var(--shadow)", padding: "12px 16px", fontSize: 13, color: "var(--tx2)", marginBottom: 8, fontWeight: 500 }}>
      <span style={{ color }}>{icon}</span> {text}
    </div>
  );
}

function PersonSelect({ value, onChange, style = {} }) {
  const groups = [...new Set(PERSONAS.map((p) => p.squad))];
  return (
    <select value={value || ""} onChange={onChange} style={{ background: "var(--bg2)", border: "1px solid var(--bg4)", borderRadius: 8, padding: "5px 8px", fontSize: 13, fontFamily: "var(--sans)", color: value ? "var(--tx)" : "var(--tx3)", outline: "none", cursor: "pointer", ...style }}>
      <option value="">Seleccionar...</option>
      {groups.map((g) => (
        <optgroup key={g} label={g}>
          {PERSONAS.filter((p) => p.squad === g).map((p) => <option key={p.name} value={p.name}>{p.name}{p.star ? " ★" : ""}</option>)}
        </optgroup>
      ))}
    </select>
  );
}

function CopyModal({ text, onClose }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) { ref.current.focus(); ref.current.select(); } }, []);
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--bg2)", borderRadius: "var(--r-lg)", boxShadow: "0 24px 48px rgba(0,0,0,.15)", padding: 28, width: "90%", maxWidth: 620 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <span style={{ fontSize: 17, fontWeight: 700 }}>Copiar minuta</span>
          <button onClick={onClose} style={{ background: "var(--bg3)", border: "none", width: 30, height: 30, borderRadius: 15, fontSize: 14, cursor: "pointer", color: "var(--tx3)" }}>✕</button>
        </div>
        <textarea ref={ref} readOnly value={text} style={{ width: "100%", height: 320, background: "var(--bg3)", color: "var(--tx)", border: "none", borderRadius: "var(--r)", padding: 16, fontSize: 12, fontFamily: "var(--mono)", resize: "vertical", outline: "none", lineHeight: 1.7 }} />
        <button onClick={() => { if (ref.current) { ref.current.select(); document.execCommand("copy"); } }} style={{ marginTop: 12, background: "var(--blue)", color: "#fff", border: "none", borderRadius: "var(--r-sm)", padding: "12px 28px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
          Copiar al portapapeles
        </button>
      </div>
    </div>
  );
}

function PersonDetailView({ detail }) {
  const [showAllWeek, setShowAllWeek] = useState(false);
  if (!detail) return null;
  const MAX = 8;
  const weekVisible = showAllWeek ? detail.weekTasks : detail.weekTasks.slice(0, MAX);
  const sortTasks = (tasks) => [...tasks].sort((a, b) => {
    const alertA = (a.phase === "⏳Backlog" || a.phase === "🚫 Detenido") ? 0 : 1;
    const alertB = (b.phase === "⏳Backlog" || b.phase === "🚫 Detenido") ? 0 : 1;
    return alertA - alertB;
  });
  return (
    <div style={{ padding: "4px 8px 8px 24px", fontSize: 12, maxHeight: 340, overflowY: "auto" }}>
      {detail.weekTasks.length > 0 && (
        <div style={{ marginBottom: 6 }}>
          <div style={{ fontWeight: 700, color: "var(--blue)", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4, display: "flex", gap: 6, alignItems: "center" }}>
            Esta semana <span style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{detail.weekTasks.length}</span>
          </div>
          {sortTasks(weekVisible).map((task, i) => {
            const ph = PHASE_SHORT[task.phase] || { label: "SPR", color: "#F59E0B" };
            const isAlert = task.phase === "⏳Backlog" || task.phase === "🚫 Detenido";
            return (
              <div key={i} style={{ display: "flex", gap: 4, alignItems: "center", padding: "3px 6px", borderRadius: 6, background: isAlert ? "rgba(239,68,68,.06)" : "rgba(0,122,255,.04)", borderLeft: `3px solid ${isAlert ? "var(--red)" : "var(--blue)"}`, marginBottom: 2 }}>
                <span style={{ fontFamily: "var(--mono)", fontSize: 8, fontWeight: 700, color: "#fff", background: ph.color, borderRadius: 3, padding: "1px 4px", flexShrink: 0, minWidth: 24, textAlign: "center" }}>{ph.label}</span>
                <span style={{ fontWeight: 500, color: isAlert ? "var(--red)" : "var(--tx)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 11 }}>{task.name}</span>
              </div>
            );
          })}
          {detail.weekTasks.length > MAX && !showAllWeek && <div onClick={() => setShowAllWeek(true)} style={{ fontSize: 10, color: "var(--blue)", cursor: "pointer", padding: "3px 6px", fontWeight: 600 }}>+{detail.weekTasks.length - MAX} más →</div>}
        </div>
      )}
      {detail.otherTasks.length > 0 && (
        <div>
          <div style={{ fontWeight: 600, color: "var(--tx3)", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
            Otras activas <span style={{ fontFamily: "var(--mono)", fontSize: 11 }}>{detail.otherTasks.length}</span>
          </div>
          {detail.otherTasks.slice(0, 5).map((task, i) => (
            <div key={i} style={{ fontSize: 11, color: "var(--tx3)", padding: "2px 6px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", opacity: 0.6 }}>{task.name}</div>
          ))}
          {detail.otherTasks.length > 5 && <div style={{ fontSize: 10, color: "var(--tx3)", paddingLeft: 6 }}>+{detail.otherTasks.length - 5} más</div>}
        </div>
      )}
      {detail.weekTasks.length === 0 && detail.otherTasks.length === 0 && <div style={{ fontSize: 11, color: "var(--tx3)", padding: 4 }}>Sin tareas activas</div>}
    </div>
  );
}

function NumInput({ initial, onCommit, style }) {
  const [val, setVal] = useState(initial != null ? String(initial) : "");
  useEffect(() => { setVal(initial != null ? String(initial) : ""); }, [initial]);
  return (
    <input type="number" value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={() => onCommit(val === "" ? 0 : parseFloat(val))}
      style={{ width: 70, background: "var(--bg2)", border: "1px solid var(--bg4)", borderRadius: 6, padding: "6px 8px", fontSize: 14, fontFamily: "var(--mono)", fontWeight: 700, color: "var(--tx)", outline: "none", textAlign: "center", ...(style || {}) }}
    />
  );
}

// Stable component — outside TabFocos so React doesn't recreate it on every render
function SquadInputSection({ label, icon, field, placeholder, rows, draft, updateDraft, showMeta }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <span style={{ fontSize: 13 }}>{icon}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--tx2)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
      </div>
      <textarea
        value={draft[field] || ""}
        onChange={(e) => updateDraft(field, e.target.value)}
        placeholder={placeholder}
        rows={rows || 2}
        style={{ width: "100%", background: "var(--bg)", border: "1.5px solid var(--bg4)", borderRadius: 8, padding: "8px 10px", fontSize: 13, fontFamily: "var(--sans)", color: "var(--tx)", outline: "none", resize: "vertical", lineHeight: 1.5, boxSizing: "border-box" }}
        onFocus={(e) => { e.target.style.borderColor = "var(--blue)"; }}
        onBlur={(e) => { e.target.style.borderColor = "var(--bg4)"; }}
      />
      {showMeta && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
          <PersonSelect value={draft[field + "_quien"] || ""} onChange={(e) => updateDraft(field + "_quien", e.target.value)} style={{ fontSize: 11, padding: "3px 6px" }} />
          <input type="date" value={draft[field + "_cuando"] || ""} onChange={(e) => updateDraft(field + "_cuando", e.target.value)} style={{ background: "var(--bg)", border: "1px solid var(--bg4)", borderRadius: 6, padding: "3px 6px", fontSize: 10, color: "var(--tx)", outline: "none" }} />
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 8: TIMER ZONE
   FIX: advanceBlock is now defined in App and passed via props
   FIX: currentBlockIdx syncs with elapsed time
   ═══════════════════════════════════════════════════════════════ */

function TimerZone({ elapsed, running, onStart, onPause, onNext, onPrev, onFinish, block, wd, blockTimes, currentIdx }) {
  const mm = Math.floor(elapsed / 60), ss = elapsed % 60;
  const eMin = elapsed / 60, overtime = eMin >= 60;
  const rem = Math.max(0, block.dur - (eMin - block.start));
  const urgent = rem <= 1 && running;
  const pr = wd.presenters || {};
  const prevB = currentIdx > 0 ? AGENDA[currentIdx - 1] : null;
  const nextB = currentIdx < AGENDA.length - 1 ? AGENDA[currentIdx + 1] : null;

  const btn = (label, onClick, bg = "var(--bg2)", fg = "var(--tx3)", disabled = false, title = "") => (
    <button onClick={onClick} disabled={disabled} title={title} style={{ background: bg, color: fg, border: bg === "var(--bg2)" ? "1px solid var(--bg4)" : "none", borderRadius: "var(--r-sm)", padding: "5px 10px", fontSize: 13, fontWeight: 600, cursor: disabled ? "default" : "pointer", fontFamily: "var(--sans)", lineHeight: 1, opacity: disabled ? 0.25 : 1, transition: "all .2s" }}>
      {label}
    </button>
  );

  return (
    <div style={{ background: "var(--bg2)", borderBottom: "1px solid var(--bg4)", boxShadow: "0 2px 12px rgba(0,0,0,.06)", padding: "12px 20px", position: "sticky", top: 0, zIndex: 100 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", maxWidth: 920, margin: "0 auto" }}>
        <span style={{ fontFamily: "var(--mono)", fontSize: 28, fontWeight: 700, color: overtime ? "var(--red)" : "var(--tx)", letterSpacing: "-0.05em", lineHeight: 1 }}>
          {String(mm).padStart(2, "0")}<span style={{ animation: running ? "pulse 1s ease infinite" : "none", color: overtime ? "var(--red)" : "var(--tx3)" }}>:</span>{String(ss).padStart(2, "0")}
        </span>
        <div style={{ display: "flex", gap: 3 }}>
          {btn("⏮", onPrev, undefined, undefined, !prevB, prevB ? `← ${prevB.label}` : "")}
          {running ? btn("⏸", onPause, "var(--yellow)", "#fff") : btn("▶", onStart, "var(--green)", "#fff")}
          {btn("⏭", onNext, undefined, undefined, !nextB, nextB ? `${nextB.label} →` : "")}
          {btn("⏹", onFinish, "var(--red)", "#fff")}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, background: urgent ? "rgba(255,69,58,.1)" : "var(--bg)", border: `0.3px solid ${urgent ? "rgba(255,69,58,.3)" : "var(--border)"}`, padding: "7px 14px", minWidth: 180, animation: urgent ? "pulse 1s ease infinite" : "none" }}>
          {running && <div style={{ width: 6, height: 6, borderRadius: "50%", background: urgent ? "var(--red)" : block.color, animation: "liveDot 1.2s ease infinite", flexShrink: 0 }} />}
          <span style={{ fontSize: 13, fontWeight: 700, color: urgent ? "var(--red)" : block.color }}>{block.label}</span>
          <span style={{ fontSize: 11, color: urgent ? "var(--red)" : "var(--tx3)" }}>{block.squad ? (pr[block.id] || "Sin asignar") : block.fixed}</span>
          <span style={{ marginLeft: "auto", fontFamily: "var(--mono)", fontSize: 13, fontWeight: 600, color: urgent ? "var(--red)" : "var(--tx2)" }}>{Math.ceil(rem)}m</span>
        </div>
        <div style={{ display: "flex", borderRadius: "var(--r-sm)", overflow: "hidden", height: 6, width: 140, flexShrink: 0 }}>
          {AGENDA.map((b, i) => (
            <div key={b.id} title={`${b.label}${blockTimes?.[b.id] ? ": " + Math.floor(blockTimes[b.id] / 60) + ":" + String(blockTimes[b.id] % 60).padStart(2, "0") : ""}`} style={{ width: `${(b.dur / 60) * 100}%`, background: i === currentIdx ? b.color : i < currentIdx ? `${b.color}60` : `${b.color}15`, transition: "all .3s", borderRight: i < AGENDA.length - 1 ? "1px solid var(--bg)" : "none" }} />
          ))}
        </div>
      </div>
      <div style={{ maxWidth: 920, margin: "6px auto 0", height: 2, borderRadius: "var(--r-sm)", background: "var(--bg4)" }}>
        <div style={{ height: "100%", borderRadius: "var(--r-sm)", background: overtime ? "var(--red)" : block.color, width: `${Math.min(100, (eMin / 60) * 100)}%`, transition: "width 1s linear" }} />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 9: TAB HOME
   ═══════════════════════════════════════════════════════════════ */

function TabHome({ analysis: an, items, elapsed, onStart, onViewAlerts }) {
  const [alertGroupsExpanded, setAlertGroupsExpanded] = React.useState({});
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
        // 1. Override manual del usuario (guardado desde el editor del dashboard)
        const manual = await storeGet(GDD_KEY);
        if (manual?._manual) { setGddData(manual); return; }

        // 2. Fetch automático desde Google Sheets vía /api/gdd
        const res = await fetch("/api/gdd", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (!data.error && (data.semana?.leads > 0 || data.semana?.mqls > 0 || data.semana?.pipeline_mkt > 0)) {
            setGddData(data);
            return;
          }
        }

        // 3. Si hay datos manuales en storage, usar esos
        if (manual) { setGddData(manual); return; }

        // 4. Sin datos de API — usar datos de la última minuta guardada como referencia
        const lastMinuta = await storeGet(`weekly:${TODAY_STR}`) || WEEKLY_MAR23;
        if (lastMinuta?.gdd) {
          setGddData({ ...lastMinuta.gdd, source: "minuta" });
        } else {
          setGddData(GDD_EMPTY);
        }
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

  // CargaRow — diseño responsive que funciona bien en mobile y desktop
  const CargaRow = ({ person, d, rank, maxVal, onClick, isExpanded }) => {
    const pct = maxVal > 0 ? d.total / maxVal : 0;
    const barColor = d.total > 10 ? "var(--red)" : d.total > 6 ? "var(--yellow)" : "var(--green)";
    const sq = PERSONAS.find((p) => p.name === person);
    const squadData = SQUADS.find((s) => s.name === sq?.squad);
    const squadColor = squadData?.color || "var(--tx3)";
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
          {/* Barra de progreso */}
          <div style={{ width: 60, height: 4, background: "var(--bg4)", borderRadius: 3, overflow: "hidden", flexShrink: 0 }}>
            <div style={{ width: Math.min(pct * 100, 100) + "%", height: "100%", background: barColor, borderRadius: 3, transition: "width .4s ease" }} />
          </div>
          {/* Número */}
          <span style={{ fontFamily: "var(--mono)", fontSize: 14, fontWeight: 800, color: barColor, minWidth: 24, textAlign: "right", flexShrink: 0 }}>{d.total}</span>
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
  };

  return (
    <div className="fade">
      {elapsed === 0 && (
        <div style={{ textAlign: "center", padding: "32px 0 36px" }}>
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
                📊 Generación de Demanda{gddData?.source === "sheets" ? <span style={{ fontSize: 9, color: "var(--green)", marginLeft: 6, fontWeight: 700 }}>● LIVE</span> : gddData?.source === "empty" ? <span style={{ fontSize: 9, color: "var(--yellow)", marginLeft: 6 }}>sin datos</span> : gddData?.source === "fallback" ? <span style={{ fontSize: 9, color: "var(--red)", marginLeft: 6 }}>⚠ sin conexión</span> : null}
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
          // Dividir en 2 columnas para mostrar todo el equipo compacto
          const half = Math.ceil(filtered.length / 2);
          const col1 = filtered.slice(0, half);
          const col2 = filtered.slice(half);
          const Row = ([p, d], i, offset) => {
            const pct = maxVal > 0 ? d.total / maxVal : 0;
            const barColor = d.total > 10 ? "var(--red)" : d.total > 6 ? "var(--yellow)" : "var(--green)";
            const sq = PERSONAS.find((x) => x.name === p);
            const sqColor = SQUADS.find((s) => s.name === sq?.squad)?.color || "var(--bg4)";
            return (
              <div key={p} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 0", borderBottom: i < (offset === 0 ? col1.length : col2.length) - 1 ? "1px solid var(--bg3)" : "none" }}>
                <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--tx3)", minWidth: 14, textAlign: "right" }}>{i + 1 + (offset === 1 ? half : 0)}</span>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: sqColor, flexShrink: 0 }} />
                <span style={{ fontSize: 11, fontWeight: 500, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: d.total > 10 ? "var(--red)" : "var(--tx)" }}>{shortName(p)}</span>
                {d.stopped > 0 && <span style={{ fontSize: 9, color: "var(--red)", fontWeight: 700 }}>{d.stopped}🚫</span>}
                <div style={{ width: 48, height: 4, background: "var(--bg4)", borderRadius: 2, overflow: "hidden", flexShrink: 0 }}>
                  <div style={{ width: (pct * 100) + "%", height: "100%", background: barColor, borderRadius: 2 }} />
                </div>
                <span style={{ fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700, color: barColor, minWidth: 18, textAlign: "right" }}>{d.total}</span>
              </div>
            );
          };
          return (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 20px" }}>
              <div>{col1.map((item, i) => Row(item, i, 0))}</div>
              <div>{col2.map((item, i) => Row(item, i, 1))}</div>
            </div>
          );
        })()}
        {(an.noCrono || []).length > 0 && <div style={{ marginTop: 8, padding: "5px 10px", borderRadius: 6, background: "rgba(245,158,11,.06)", fontSize: 10, color: "var(--yellow)" }}>⚠️ {(an.noCrono || []).length} en Sprint sin Fecha</div>}
      </Card>

      {/* Alertas compactas */}
      {(() => {
        const setAlertGroupsState = () => {}; // handled via alertGroupsExpanded
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

function TabAgenda({ wd, setWd, save, currentIdx, blockTimes, onJumpToBlock }) {
  const [edit, setEdit] = useState(false);
  const pr = wd.presenters || {};
  const missing = AGENDA.filter((b) => b.squad && !pr[b.id]?.trim());
  const setPr = (id, v) => { const n = { ...wd, presenters: { ...wd.presenters, [id]: v } }; setWd(n); save(n); };

  return (
    <div className="fade">
      {missing.length > 0 && !edit && <Alerta icon="⚠️" text={`Faltan presentadores: ${missing.map((b) => b.label).join(", ")}`} />}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>Agenda</h2>
          <div style={{ fontSize: 11, color: "var(--tx3)", marginTop: 2 }}>
            Bloque {currentIdx + 1} de {AGENDA.length} · {AGENDA[currentIdx]?.label}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {currentIdx < AGENDA.length - 1 && (
            <button onClick={() => onJumpToBlock(currentIdx + 1)} style={{ background: "var(--green)", color: "#fff", border: "none", borderRadius: "var(--r-sm)", padding: "5px 14px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
              ✓ Siguiente →
            </button>
          )}
          <button onClick={() => setEdit(!edit)} style={{ background: edit ? "var(--purple)" : "var(--bg3)", color: edit ? "#fff" : "var(--tx2)", border: edit ? "none" : "1px solid var(--border)", borderRadius: "var(--r-sm)", padding: "5px 14px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>✏ {edit ? "Listo" : "Presentadores"}</button>
        </div>
      </div>
      {AGENDA.map((b, idx) => {
        const isCur = idx === currentIdx;
        const isPast = idx < currentIdx;
        const sq = SQUADS.find((s) => s.id === b.id);
        return (
          <div key={b.id} onClick={() => !edit && onJumpToBlock(idx)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: "var(--r-sm)", marginBottom: 3, background: isCur ? `${b.color}0D` : (b.squad && !pr[b.id]?.trim()) ? "rgba(255,59,48,.04)" : "transparent", border: isCur ? `1px solid ${b.color}25` : "1px solid transparent", cursor: edit ? "default" : "pointer", opacity: isPast && !edit ? 0.35 : 1,
              transition: "all .2s" }}>
            <span style={{ fontFamily: "var(--mono)", fontWeight: 700, color: isCur ? b.color : `${b.color}80`, minWidth: 38, fontSize: 11 }}>{String(b.start).padStart(2, "0")}:00</span>
            <div style={{ width: 3, height: 22, borderRadius: "var(--r-sm)", background: isCur ? b.color : isPast ? `${b.color}40` : "var(--bg4)" }} />
            <span style={{ minWidth: 120, fontWeight: isCur ? 700 : 500, fontSize: 13, color: isCur ? "var(--tx)" : "var(--tx2)" }}>{b.label}</span>
            {edit && b.squad
              ? <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6 }}><PersonSelect value={pr[b.id] || ""} onChange={(e) => setPr(b.id, e.target.value)} style={{ flex: 1 }} /><span style={{ fontSize: 10, color: "var(--tx3)" }}>Lead: {sq?.lead}</span></div>
              : <span style={{ flex: 1, fontSize: 12, color: "var(--tx3)" }}>{b.squad ? (pr[b.id] ? <><span style={{ color: b.color, fontWeight: 600 }}>{pr[b.id]}</span> · {sq?.lead}</> : <span style={{ color: "var(--red)" }}>Sin asignar · {sq?.lead}</span>) : b.fixed}</span>}
            <span style={{ fontFamily: "var(--mono)", color: "var(--tx3)", fontSize: 11 }}>
              {blockTimes?.[b.id] ? <span style={{ color: blockTimes[b.id] > b.dur * 60 ? "var(--red)" : "var(--green)" }}>{Math.floor(blockTimes[b.id] / 60)}:{String(blockTimes[b.id] % 60).padStart(2, "0")}</span> : `${b.dur}'`}
            </span>
            {isPast && !edit && <span style={{ background: "var(--green)", color: "#fff", borderRadius: "50%", width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>✓</span>}
            {isCur && !edit && <span style={{ background: b.color, color: "#fff", borderRadius: 4, padding: "1px 6px", fontSize: 9, fontWeight: 700, flexShrink: 0 }}>EN CURSO</span>}
          </div>
        );
      })}
      <div style={{ marginTop: 12, padding: 8, borderRadius: "var(--r-sm)", background: "var(--bg2)", fontSize: 11, color: "var(--tx3)", textAlign: "center" }}>+2 min → "lo sacamos offline" · Sin update Monday = sin voz · Compromiso = Qué + Quién + Cuándo</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 11: TAB PANORAMA
   ═══════════════════════════════════════════════════════════════ */

function TabPanorama({ analysis: an, items }) {
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
   SECTION 12: TAB MINUTAS
   ═══════════════════════════════════════════════════════════════ */

function TabMinutas() {
  const [keys, setKeys] = useState([]);
  const [selKey, setSelKey] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);

  useEffect(() => {
    (async () => {
      const allKeys = await storeList("weekly:");
      const sorted = allKeys.filter((k) => k <= STORE_KEY).sort().reverse();
      // Inject MAR23 if not already in storage
      const mar23Key = "weekly:2026-03-23";
      const fullList = sorted.includes(mar23Key) ? sorted : [...sorted.filter((k) => k > mar23Key), mar23Key, ...sorted.filter((k) => k <= mar23Key && k !== mar23Key)];
      setKeys(fullList);
      const firstKey = fullList[0] || null;
      if (firstKey) {
        setSelKey(firstKey);
        const d = await storeGet(firstKey);
        setData(d || (firstKey === mar23Key ? WEEKLY_MAR23 : null));
      }
      setLoading(false);
    })();
  }, []);

  async function select(k) {
    setSelKey(k);
    const d = await storeGet(k);
    setData(d || (k === "weekly:2026-03-23" ? WEEKLY_MAR23 : null));
    setEditing(null);
  }
  async function remove(k) { await storeDel(k); setKeys((prev) => prev.filter((x) => x !== k)); if (selKey === k) { setSelKey(null); setData(null); } setConfirmDel(null); }
  async function saveText(text) { const upd = { ...data, minutaText: text }; await storeSet(selKey, upd); setData(upd); setEditing(null); }

  function getMinutaText() {
    if (data?.minutaText) return data.minutaText;
    if (!data) return "";
    let t = `📋 MINUTA WEEKLY ${data.date || "?"}\n${"═".repeat(40)}\n\n`;
    SQUADS.forEach((sq) => {
      const raw = data.focos?.[sq.id];
      const arr = Array.isArray(raw) ? raw : (raw?.focos || raw?.blocker ? [raw] : []);
      if (!arr.length) return;
      t += `▸ ${sq.name}:\n`;
      arr.forEach((f) => {
        if (f.focos?.trim()) t += `  🎯 ${f.focos}\n`;
        if (f.blocker?.trim()) t += `  🚫 ${f.blocker}\n`;
        if (f.necesito?.trim()) t += `  🤝 ${f.necesito}\n`;
      });
      t += "\n";
    });
    if (data.compromisos?.length) { t += `📝 COMPROMISOS\n`; data.compromisos.forEach((c, i) => { t += `${i + 1}. ${c.que || "—"} → ${c.quien || "—"}\n`; }); }
    return t;
  }

  const dateFmt = (k) => new Date(k.replace("weekly:", "")).toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" });
  if (loading) return <div style={{ textAlign: "center", padding: 40, color: "var(--tx3)" }}>Cargando minutas...</div>;
  if (!keys.length) return <Alerta icon="ℹ️" text="No hay minutas aún." color="var(--blue)" />;

  return (
    <div className="fade">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700 }}>Minutas</h2>
        {selKey && data && (
          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={() => downloadTextFile(getMinutaText(), `minuta_${selKey.replace("weekly:", "")}.txt`)} style={{ background: "var(--green)", color: "#fff", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>⬇ Descargar</button>
            <button onClick={() => copyToClipboard(getMinutaText())} style={{ background: "var(--blue)", color: "#fff", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>📋 Copiar</button>
            <button onClick={() => setEditing(editing !== null ? null : getMinutaText())} style={{ background: "var(--bg3)", color: "var(--tx2)", border: "1px solid var(--bg4)", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{editing !== null ? "Cancelar" : "✏️ Editar"}</button>
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 4, marginBottom: 14, flexWrap: "wrap" }}>
        {keys.map((k) => {
          const isCur = k === STORE_KEY, isSel = k === selKey;
          return (
            <div key={k} style={{ display: "flex", alignItems: "center" }}>
              <button onClick={() => select(k)} style={{ background: isSel ? "var(--blue)" : "var(--bg2)", color: isSel ? "#fff" : "var(--tx2)", border: isSel ? "none" : "1px solid var(--bg4)", borderRadius: !isCur ? "8px 0 0 8px" : 8, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{dateFmt(k)} {isCur && "(hoy)"}</button>
              {!isCur && <button onClick={() => setConfirmDel(k)} style={{ background: isSel ? "var(--blue)" : "var(--bg2)", color: isSel ? "#fff" : "var(--tx3)", border: isSel ? "none" : "1px solid var(--bg4)", borderLeft: "none", borderRadius: "0 8px 8px 0", padding: "5px 6px", fontSize: 10, cursor: "pointer" }}>✕</button>}
            </div>
          );
        })}
      </div>

      {confirmDel && (
        <Card style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 13, flex: 1 }}>¿Eliminar minuta del {dateFmt(confirmDel)}?</span>
          <button onClick={() => remove(confirmDel)} style={{ background: "var(--red)", color: "#fff", border: "none", borderRadius: 8, padding: "5px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Eliminar</button>
          <button onClick={() => setConfirmDel(null)} style={{ background: "var(--bg3)", color: "var(--tx2)", border: "none", borderRadius: 8, padding: "5px 14px", fontSize: 12, cursor: "pointer" }}>Cancelar</button>
        </Card>
      )}

      {!data ? <Alerta icon="📭" text="Selecciona una weekly." color="var(--tx3)" />
        : editing !== null ? (
          <div>
            <textarea value={editing} onChange={(e) => setEditing(e.target.value)} style={{ width: "100%", minHeight: 250, background: "var(--bg3)", color: "var(--tx)", border: "2px solid var(--blue)", borderRadius: "var(--r)", padding: 14, fontSize: 13, fontFamily: "var(--mono)", resize: "vertical", outline: "none", lineHeight: 1.7 }} />
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              <button onClick={() => saveText(editing)} style={{ background: "var(--green)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>💾 Guardar</button>
              <button onClick={() => { saveText(editing); copyToClipboard(editing); }} style={{ background: "var(--blue)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>💾 Guardar + Copiar</button>
            </div>
          </div>
        ) : (
          <div>
            {data.minutaText && <div style={{ background: "var(--bg3)", borderRadius: "var(--r)", padding: 14, fontSize: 13, fontFamily: "var(--mono)", lineHeight: 1.7, color: "var(--tx2)", whiteSpace: "pre-wrap", marginBottom: 10, maxHeight: 300, overflowY: "auto" }}>{data.minutaText}</div>}
            {SQUADS.map((sq) => {
              const raw = data.focos?.[sq.id];
              const arr = Array.isArray(raw) ? raw : (raw?.focos || raw?.blocker ? [raw] : []);
              if (!arr.length) return null;
              return (
                <Card key={sq.id} style={{ marginBottom: 8, borderLeft: `3px solid ${sq.color}` }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: sq.color, marginBottom: 6 }}>{sq.name}</div>
                  {arr.map((f, fi) => (
                    <div key={fi}>
                      {f.focos?.trim() && <div style={{ fontSize: 13, color: "var(--tx2)", padding: "2px 0" }}>🎯 {f.focos}</div>}
                      {f.blocker?.trim() && <div style={{ fontSize: 13, color: "var(--red)", padding: "2px 0" }}>🚫 {f.blocker}</div>}
                      {f.necesito?.trim() && <div style={{ fontSize: 13, color: "var(--yellow)", padding: "2px 0" }}>🤝 {f.necesito}</div>}
                    </div>
                  ))}
                </Card>
              );
            })}
          </div>
        )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 13: TAB FOCOS
   ═══════════════════════════════════════════════════════════════ */

function TabFocos({ items, wd, setWd, save, activeSquad, setActiveSquad }) {
  const focos = wd.focos || {};
  const isCross = activeSquad === "cross";
  const sq = isCross ? null : SQUADS.find((s) => s.id === activeSquad);

  const allBlockers = [], allNecesitos = [];
  SQUADS.forEach((s) => {
    const arr = Array.isArray(focos[s.id]) ? focos[s.id] : (focos[s.id]?.focos || focos[s.id]?.blocker ? [focos[s.id]] : []);
    arr.forEach((f) => {
      if (f.blocker?.trim()) allBlockers.push({ text: f.blocker, quien: f.blocker_quien, cuando: f.blocker_cuando, sq: s });
      if (f.necesito?.trim()) allNecesitos.push({ text: f.necesito, quien: f.necesito_quien, cuando: f.necesito_cuando, sq: s });
    });
  });
  const crossCount = allBlockers.length + allNecesitos.length;

  const sqItems = sq ? items.filter((i) => normalizeSquad(i.column_values?.color_mkz0s203) === sq.name && isActive(i.column_values?.color_mkz09na)) : [];
  const entries = Array.isArray(focos[activeSquad]) ? focos[activeSquad] : (focos[activeSquad]?.focos || focos[activeSquad]?.blocker || focos[activeSquad]?.necesito ? [focos[activeSquad]] : []);
  const [showForm, setShowForm] = useState(!entries.length); // mostrar form si no hay entries

  const [draft, setDraft] = useState({});
  const [saved, setSaved] = useState(false);
  const [editIdx, setEditIdx] = useState(null);

  useEffect(() => { setDraft({}); setSaved(false); setEditIdx(null); }, [activeSquad]);

  const updateDraft = useCallback((field, val) => setDraft((prev) => ({ ...prev, [field]: val })), []);
  const hasDraft = !!(draft.focos?.trim() || draft.blocker?.trim() || draft.necesito?.trim());

  const saveDraft = () => {
    if (!hasDraft) return;
    let newEntries;
    if (editIdx !== null) { newEntries = [...entries]; newEntries[editIdx] = { ...draft, ts: Date.now() }; setEditIdx(null); }
    else newEntries = [...entries, { ...draft, ts: Date.now() }];
    const n = { ...wd, focos: { ...wd.focos, [activeSquad]: newEntries } };
    setWd(n); save(n); setDraft({}); setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };
  const deleteEntry = (idx) => { const n = { ...wd, focos: { ...wd.focos, [activeSquad]: entries.filter((_, i) => i !== idx) } }; setWd(n); save(n); };
  const editEntry = (idx) => { setDraft(entries[idx]); setEditIdx(idx); };

  const draftRef = useRef(updateDraft);
  draftRef.current = updateDraft;
  const stableDraft = useMemo(() => draft, [JSON.stringify(draft)]);

  return (
    <div className="fade">
      <div style={{ display: "flex", gap: 4, marginBottom: 14, flexWrap: "wrap" }}>
        {SQUADS.map((s) => {
          const arr = Array.isArray(focos[s.id]) ? focos[s.id] : (focos[s.id]?.focos || focos[s.id]?.blocker ? [focos[s.id]] : []);
          const hasFoco = arr.some((f) => f.focos?.trim()), hasBlocker = arr.some((f) => f.blocker?.trim());
          return (
            <div key={s.id} style={{ position: "relative" }}>
              <Chip label={s.name} active={activeSquad === s.id} color={s.color} onClick={() => setActiveSquad(s.id)} />
              {hasFoco && <span style={{ position: "absolute", top: -4, right: hasBlocker ? 14 : -4, width: 8, height: 8, borderRadius: "50%", background: "var(--green)" }} />}
              {hasBlocker && <span style={{ position: "absolute", top: -4, right: -4, width: 8, height: 8, borderRadius: "50%", background: "var(--red)" }} />}
            </div>
          );
        })}
        <div style={{ position: "relative" }}>
          <Chip label="Cross-Squad" active={isCross} color="var(--purple)" onClick={() => setActiveSquad("cross")} />
          {crossCount > 0 && <span style={{ position: "absolute", top: -4, right: -4, background: "var(--red)", color: "#fff", fontSize: 8, fontWeight: 700, borderRadius: 10, padding: "1px 5px" }}>{crossCount}</span>}
        </div>
      </div>

      {isCross ? (
        <Card style={{ borderTop: "3px solid var(--purple)" }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Cross-Squad — Resumen</div>
          {(() => {
            const hasAny = SQUADS.some((s) => { const arr = Array.isArray(focos[s.id]) ? focos[s.id] : (focos[s.id]?.focos || focos[s.id]?.blocker ? [focos[s.id]] : []); return arr.some((f) => f.focos?.trim() || f.blocker?.trim() || f.necesito?.trim()); });
            if (!hasAny) return <div style={{ textAlign: "center", padding: "16px 0", color: "var(--tx3)", fontSize: 12 }}>Aún no hay registros. Se llenan desde cada squad.</div>;
            return SQUADS.map((s) => {
              const arr = Array.isArray(focos[s.id]) ? focos[s.id] : (focos[s.id]?.focos || focos[s.id]?.blocker ? [focos[s.id]] : []);
              const filled = arr.filter((f) => f.focos?.trim() || f.blocker?.trim() || f.necesito?.trim());
              if (!filled.length) return null;
              return (
                <div key={s.id} style={{ marginBottom: 10, padding: "8px 10px", borderRadius: 8, borderLeft: `3px solid ${s.color}`, background: "var(--bg)" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: s.color, marginBottom: 4 }}>{s.name}</div>
                  {filled.map((f, fi) => (
                    <div key={fi} style={{ marginBottom: fi < filled.length - 1 ? 6 : 0 }}>
                      {f.focos?.trim() && <div style={{ fontSize: 12, color: "var(--tx)", marginBottom: 1 }}>🎯 {f.focos}</div>}
                      {f.blocker?.trim() && <div style={{ fontSize: 12, color: "var(--red)", marginBottom: 1 }}>🚫 {f.blocker}{f.blocker_quien ? ` → ${shortName(f.blocker_quien)}` : ""}{f.blocker_cuando ? ` · ${new Date(f.blocker_cuando + "T12:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short" })}` : ""}</div>}
                      {f.necesito?.trim() && <div style={{ fontSize: 12, color: "var(--yellow)", marginBottom: 1 }}>🤝 {f.necesito}{f.necesito_quien ? ` → ${shortName(f.necesito_quien)}` : ""}{f.necesito_cuando ? ` · ${new Date(f.necesito_cuando + "T12:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short" })}` : ""}</div>}
                    </div>
                  ))}
                </div>
              );
            });
          })()}
        </Card>
      ) : (
        <>
          <Card style={{ borderTop: `3px solid ${sq?.color}`, padding: "16px 20px", marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div><span style={{ fontSize: 15, fontWeight: 700 }}>{sq?.name}</span><span style={{ fontSize: 12, color: "var(--tx3)", marginLeft: 8 }}>{sq?.lead}</span></div>
              <span style={{ fontSize: 11, color: "var(--tx3)" }}>{entries.length} registro{entries.length !== 1 ? "s" : ""}</span>
            </div>
            {entries.map((entry, idx) => (
              <div key={idx} style={{ padding: "10px 12px", marginBottom: 6, borderRadius: 8, background: "var(--bg)", border: "1px solid var(--bg4)" }}>
                {entry.focos?.trim() && <div style={{ fontSize: 13, color: "var(--tx)", marginBottom: 2 }}>🎯 {entry.focos}</div>}
                {entry.blocker?.trim() && <div style={{ fontSize: 13, color: "var(--red)", marginBottom: 2 }}>🚫 {entry.blocker}{entry.blocker_quien ? ` → ${shortName(entry.blocker_quien)}` : ""}{entry.blocker_cuando ? ` · ${new Date(entry.blocker_cuando + "T12:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short" })}` : ""}</div>}
                {entry.necesito?.trim() && <div style={{ fontSize: 13, color: "var(--yellow)", marginBottom: 2 }}>🤝 {entry.necesito}{entry.necesito_quien ? ` → ${shortName(entry.necesito_quien)}` : ""}{entry.necesito_cuando ? ` · ${new Date(entry.necesito_cuando + "T12:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short" })}` : ""}</div>}
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <span onClick={() => editEntry(idx)} style={{ fontSize: 10, color: "var(--blue)", cursor: "pointer" }}>Editar</span>
                  <span onClick={() => deleteEntry(idx)} style={{ fontSize: 10, color: "var(--tx3)", cursor: "pointer" }}>Borrar</span>
                </div>
              </div>
            ))}
            <div style={{ padding: entries.length > 0 ? "10px 0 0" : 0, borderTop: entries.length > 0 ? "1px dashed var(--bg4)" : "none" }}>
              <SquadInputSection label="Focos" icon="🎯" field="focos" placeholder="Top 3: campaña X, proyecto Y, entregable Z..." rows={3} draft={draft} updateDraft={updateDraft} />
              <SquadInputSection label="Blocker" icon="🚫" field="blocker" placeholder="¿Algo detenido?" rows={1} draft={draft} updateDraft={updateDraft} showMeta />
              <SquadInputSection label="Necesito" icon="🤝" field="necesito" placeholder="¿Qué necesitas de otro squad?" rows={1} draft={draft} updateDraft={updateDraft} showMeta />
              <div style={{ display: "flex", gap: 6, alignItems: "center", justifyContent: "flex-end" }}>
                {saved && <span style={{ fontSize: 11, color: "var(--green)", fontWeight: 600 }}>✓ Guardado</span>}
                {editIdx !== null && <span onClick={() => { setDraft({}); setEditIdx(null); }} style={{ fontSize: 11, color: "var(--tx3)", cursor: "pointer" }}>Cancelar</span>}
                <button onClick={saveDraft} disabled={!hasDraft} style={{ background: hasDraft ? "var(--tx)" : "var(--bg4)", color: hasDraft ? "var(--bg)" : "var(--tx3)", border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 12, fontWeight: 700, cursor: hasDraft ? "pointer" : "default" }}>
                  {editIdx !== null ? "Actualizar" : "Guardar"}
                </button>
              </div>
            </div>
          </Card>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--tx3)", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Items activos · {sqItems.length}</div>
          <div style={{ maxHeight: 340, overflowY: "auto" }}>
            {sqItems.map((it) => {
              const tl = parseTL(it.column_values?.timerange_mkzcqv0j), od = isOverdue(it), tw = overlapsThisWeek(it.column_values?.timerange_mkzcqv0j);
              const subs = it.subitems || [], subsDone = subs.filter((s) => s.column_values?.color_mkzjvp66 === "✅ Done").length;
              return (
                <div key={it.id} style={{ display: "flex", gap: 5, alignItems: "center", padding: "5px 8px", borderBottom: "1px solid var(--bg3)", fontSize: 12, background: od ? "rgba(255,59,48,.06)" : tw ? "rgba(0,122,255,.04)" : "transparent", borderLeft: tw ? "3px solid var(--blue)" : od ? "3px solid var(--red)" : "3px solid transparent" }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: PHASES[it.column_values?.color_mkz09na] || "#555", flexShrink: 0 }} />
                  <span style={{ flex: 1, color: "var(--tx2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</span>
                  {subs.length > 0 && <div style={{ display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}><div style={{ width: 32, height: 4, borderRadius: 2, background: "var(--bg4)", overflow: "hidden" }}><div style={{ width: `${(subsDone / subs.length) * 100}%`, height: "100%", background: subsDone === subs.length ? "var(--green)" : "var(--blue)", borderRadius: 2 }} /></div><span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--tx3)" }}>{subsDone}/{subs.length}</span></div>}
                  {od && <span style={{ fontFamily: "var(--mono)", color: "var(--red)", fontWeight: 700, fontSize: 10 }}>-{tl.end ? daysDiff(TODAY, tl.end) : "?"}d</span>}
                  <span style={{ color: "var(--tx3)", fontSize: 10 }}>{shortName(it.column_values?.person)}</span>
                  {tl.end && <span style={{ fontFamily: "var(--mono)", color: od ? "var(--red)" : "var(--tx3)", fontWeight: od ? 700 : 400, fontSize: 10 }}>{tl.end.toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}</span>}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 14: TAB COMPROMISOS
   ═══════════════════════════════════════════════════════════════ */

function TabCompromisos({ wd, setWd, save, analysis, onCopy, gddData }) {
  const comps = wd.compromisos || [], synced = wd.synced || [];
  const [syncing, setSyncing] = useState(null);
  const [prevComps, setPrevComps] = useState([]);
  const [loadingPrev, setLoadingPrev] = useState(true);
  const setComps = (c) => { const n = { ...wd, compromisos: c }; setWd(n); save(n); };

  useEffect(() => {
    (async () => {
      try {
        const allKeys = await storeList("weekly:");
        const prevKeys = allKeys.filter((k) => k < STORE_KEY).sort().reverse();
        const historical = [];
        for (const key of prevKeys.slice(0, 8)) {
          let data = await storeGet(key);
          if (!data && key === "weekly:2026-03-23") data = WEEKLY_MAR23;
          if (!data?.compromisos?.length) continue;
          data.compromisos.forEach((c) => {
            if (c.que?.trim()) historical.push({ ...c, weekDate: key.replace("weekly:", ""), weekKey: key, pct: c.pct || (c.status === "done" ? 100 : 0) });
          });
        }
        setPrevComps(historical);
      } catch {}
      setLoadingPrev(false);
    })();
  }, []);

  async function updatePrevPct(weekKey, compQue, newPct) {
    let data = await storeGet(weekKey);
    if (!data && weekKey === "weekly:2026-03-23") data = { ...WEEKLY_MAR23 };
    if (!data?.compromisos) return;
    const idx = data.compromisos.findIndex((c) => c.que === compQue);
    if (idx < 0) return;
    data.compromisos[idx].pct = newPct;
    if (newPct >= 100) data.compromisos[idx].status = "done";
    await storeSet(weekKey, data);
    setPrevComps((prev) => prev.map((c) => c.weekKey === weekKey && c.que === compQue ? { ...c, pct: newPct, status: newPct >= 100 ? "done" : c.status } : c));
  }

  async function syncToMonday(i) {
    const c = comps[i]; if (!c.que) return;
    setSyncing(i);
    const ok = await createMondayItem(`WEEKLY ${TODAY_STR} | ${c.que}`, c.cuando || null, c.quien || null);
    if (ok) { const n = { ...wd, synced: [...synced, i] }; setWd(n); save(n); }
    setSyncing(null);
  }

  async function syncAllToMonday() {
    for (let i = 0; i < comps.length; i++) {
      if (synced.includes(i) || !comps[i].que?.trim() || !comps[i].quien) continue;
      setSyncing(i);
      const ok = await createMondayItem(`WEEKLY ${TODAY_STR} | ${comps[i].que}`, comps[i].cuando || null, comps[i].quien || null);
      if (ok) { const n = { ...wd, synced: [...(wd.synced || []), i] }; setWd(n); save(n); }
    }
    setSyncing(null);
  }

  const unsyncedCount = comps.filter((c, i) => !synced.includes(i) && c.que?.trim() && c.quien).length;
  const openPrev = prevComps.filter((c) => (c.pct || 0) < 100);
  const donePrev = prevComps.filter((c) => (c.pct || 0) >= 100);
  const dateFmt = (d) => new Date(d).toLocaleDateString("es-MX", { day: "numeric", month: "short" });

  return (
    <div className="fade">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700 }}>Compromisos</h2>
        <div style={{ display: "flex", gap: 4 }}>
          {unsyncedCount > 0 && <button onClick={syncAllToMonday} disabled={syncing !== null} style={{ background: "var(--blue)", color: "#fff", border: "none", borderRadius: "var(--r-sm)", padding: "5px 12px", fontSize: 11, fontWeight: 700, cursor: syncing !== null ? "default" : "pointer", fontFamily: "var(--mono)", textTransform: "uppercase", opacity: syncing !== null ? 0.5 : 1 }}>{syncing !== null ? `SYNC ${syncing + 1}/${comps.length}...` : `↑ SYNC ${unsyncedCount} → MONDAY`}</button>}
          <button onClick={() => onCopy(generateMinuta(wd, analysis, gddData))} style={{ background: "var(--bg2)", color: "var(--tx2)", border: "1px solid var(--bg4)", borderRadius: "var(--r-sm)", padding: "5px 12px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>📤 Minuta</button>
          <button onClick={() => setComps([...comps, { id: Date.now(), que: "", quien: "", cuando: "", status: "pending" }])} style={{ background: "var(--tx)", color: "var(--bg)", border: "none", borderRadius: "var(--r-sm)", padding: "5px 14px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "var(--mono)", textTransform: "uppercase" }}>+ AGREGAR</button>
        </div>
      </div>
      <div style={{ fontSize: 11, color: "var(--tx3)", marginBottom: 12, fontFamily: "var(--mono)" }}>→ Monday: grupo "Acuerdos Weeklys" · Qué + Quién + Cuándo</div>

      {!comps.length
        ? <Card style={{ textAlign: "center", padding: 36, border: "2px dashed var(--border)" }}><div style={{ fontSize: 32, marginBottom: 8 }}>📝</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--tx2)", marginBottom: 6 }}>Sin compromisos aún</div>
          <div style={{ fontSize: 12, color: "var(--tx3)", marginBottom: 16 }}>Cada compromiso: Qué + Quién + Cuándo</div>
          <button onClick={() => setComps([...comps, { id: Date.now(), que: "", quien: "", cuando: "", status: "pending" }])} style={{ background: "var(--tx)", color: "var(--bg)", border: "none", borderRadius: "var(--r-sm)", padding: "8px 20px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>+ Agregar compromiso</button>
        </Card>
        : <Card>
          <div style={{ display: "grid", gridTemplateColumns: "26px 1fr 130px 110px 50px 50px", gap: 4, padding: "4px 0 6px", fontSize: 10, fontWeight: 700, color: "var(--tx3)", textTransform: "uppercase", letterSpacing: 1, borderBottom: "1px solid var(--border)" }}><span /><span>Qué</span><span>Quién</span><span>Cuándo</span><span>%</span><span>Mon</span></div>
          {comps.map((c, i) => (
            <div key={c.id || i} style={{ display: "grid", gridTemplateColumns: "26px 1fr 130px 110px 50px 50px", gap: 4, padding: "7px 0", alignItems: "center", borderBottom: "1px solid var(--border)" }}>
              <button onClick={() => { const ns = c.status === "done" ? "pending" : "done"; setComps(comps.map((x, j) => j === i ? { ...x, status: ns, pct: ns === "done" ? 100 : (x.pct || 0) } : x)); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, padding: 0 }}>{c.status === "done" ? "✅" : "⬜"}</button>
              <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
                <input value={c.que} onChange={(e) => setComps(comps.map((x, j) => j === i ? { ...x, que: e.target.value } : x))} placeholder="Compromiso..." style={{ flex: 1, background: "transparent", border: "none", fontSize: 12, fontFamily: "var(--sans)", color: c.status === "done" ? "var(--tx3)" : "var(--tx)", outline: "none", textDecoration: c.status === "done" ? "line-through" : "none" }} />
                <button onClick={() => setComps(comps.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--border)", fontSize: 11 }}>✕</button>
              </div>
              <PersonSelect value={c.quien} onChange={(e) => setComps(comps.map((x, j) => j === i ? { ...x, quien: e.target.value } : x))} />
              <input type="date" value={c.cuando} onChange={(e) => setComps(comps.map((x, j) => j === i ? { ...x, cuando: e.target.value } : x))} style={{ background: "var(--bg2)", border: "1px solid var(--bg4)", borderRadius: "var(--r-sm)", padding: "3px 4px", fontSize: 10, color: "var(--tx)", outline: "none" }} />
              <div style={{ textAlign: "center" }}>
                <span style={{ fontFamily: "var(--mono)", fontSize: 11, fontWeight: 600, color: (c.pct || 0) >= 100 ? "var(--green)" : (c.pct || 0) >= 50 ? "var(--yellow)" : "var(--tx3)", cursor: "pointer" }} onClick={() => { const next = Math.min(100, (c.pct || 0) + 25); setComps(comps.map((x, j) => j === i ? { ...x, pct: next, status: next >= 100 ? "done" : x.status } : x)); }}>{c.pct || 0}%</span>
              </div>
              <div style={{ textAlign: "center" }}>
                {synced.includes(i) ? <span style={{ fontSize: 10, color: "var(--green)", fontWeight: 700 }}>✓</span>
                  : <button onClick={() => syncToMonday(i)} disabled={!c.que || !c.quien || syncing === i} style={{ background: "var(--bg2)", color: "var(--blue)", border: "1px solid var(--bg4)", borderRadius: "var(--r-sm)", padding: "2px 6px", fontSize: 10, fontWeight: 600, cursor: "pointer", opacity: (!c.que?.trim() || !c.quien) ? 0.3 : 1 }}>{syncing === i ? "..." : "→"}</button>}
              </div>
            </div>
          ))}
        </Card>}

      <Card style={{ marginTop: 12, marginBottom: 4 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--tx3)", marginBottom: 6 }}>📝 Notas de cierre</div>
        <textarea value={wd.notasCierre || ""} onChange={(e) => { const n = { ...wd, notasCierre: e.target.value }; setWd(n); save(n); }} placeholder="Temas offline, decisiones tomadas, seguimientos..." style={{ width: "100%", minHeight: 60, background: "var(--bg3)", border: "none", borderRadius: "var(--r-sm)", padding: 10, fontSize: 12, fontFamily: "var(--sans)", color: "var(--tx)", outline: "none", resize: "vertical" }} />
      </Card>

      {!loadingPrev && openPrev.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
            📋 Compromisos Anteriores Abiertos <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--red)", fontWeight: 700 }}>{openPrev.length}</span>
          </div>
          <Card>
            {openPrev.map((c, i) => (
              <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", padding: "8px 0", borderBottom: i < openPrev.length - 1 ? "1px solid var(--bg3)" : "none" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: "var(--tx)", fontWeight: 500 }}>{c.que}</div>
                  <div style={{ fontSize: 10, color: "var(--tx3)", marginTop: 2, display: "flex", gap: 8 }}>
                    <span>👤 {shortName(c.quien)}</span>
                    <span>📅 {dateFmt(c.weekDate)}</span>
                    {c.cuando && <span>⏰ {dateFmt(c.cuando)}</span>}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 14, fontWeight: 700, color: pctColor(c.pct || 0), minWidth: 36, textAlign: "right" }}>{c.pct || 0}%</span>
                  <input type="range" min="0" max="100" step="10" value={c.pct || 0} onChange={(e) => updatePrevPct(c.weekKey, c.que, parseInt(e.target.value))} style={{ width: 80, accentColor: pctColor(c.pct || 0) }} />
                </div>
              </div>
            ))}
          </Card>
        </div>
      )}

      {!loadingPrev && donePrev.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--tx3)", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
            ✅ Completados anteriores <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--green)" }}>{donePrev.length}</span>
          </div>
          <div style={{ maxHeight: 150, overflowY: "auto" }}>
            {donePrev.map((c, i) => (
              <div key={i} style={{ display: "flex", gap: 6, alignItems: "center", padding: "3px 0", fontSize: 12, opacity: 0.5 }}>
                <span>✅</span>
                <span style={{ flex: 1, color: "var(--tx3)", textDecoration: "line-through" }}>{c.que}</span>
                <span style={{ fontSize: 10, color: "var(--tx3)" }}>{shortName(c.quien)}</span>
                <span style={{ fontSize: 10, color: "var(--tx3)" }}>{dateFmt(c.weekDate)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 15: MAIN APP
   FIX: advanceBlock defined here and passed as props
   FIX: currentBlockIdx syncs properly with timer
   FIX: error state shows message instead of blank
   ═══════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════
   MINUTAS MODAL — 2 niveles
   Nivel 1: lista de todas las minutas guardadas
   Nivel 2: preview de la minuta seleccionada (Editar / Copiar / PDF)
   ═══════════════════════════════════════════════════════════════ */

function downloadMinutaTxt(text, dateStr) {
  try {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "minuta-weekly-" + dateStr + ".txt";
    a.style.display = "none"; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 2000);
  } catch {}
}

/* ═══════════════════════════════════════════════════════════════
   TAB MINUTAS INLINE
   Lista inline de todas las minutas. Click en una → lightbox de detalle.
   ═══════════════════════════════════════════════════════════════ */

function TabMinutasInline({ wd, analysis, gddData, blockTimes, onOpenMinuta }) {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmDel, setConfirmDel] = useState(null);
  const [copied, setCopied] = useState(null);

  useEffect(() => {
    (async () => {
      const allKeys = await storeList("weekly:");
      const mar23 = "weekly:2026-03-23";
      const merged = [...new Set([STORE_KEY, ...allKeys, mar23])].sort().reverse();
      setKeys(merged);
      setLoading(false);
    })();
  }, []);

  async function openMinuta(k) {
    let d = await storeGet(k);
    if (!d && k === "weekly:2026-03-23") d = WEEKLY_MAR23;
    document.body.style.overflow = "hidden";
    onOpenMinuta(k, d);
  }

  async function copyMinuta(k, e) {
    e.stopPropagation();
    let d = await storeGet(k);
    if (!d && k === "weekly:2026-03-23") d = WEEKLY_MAR23;
    const text = d?.minutaText || generateMinuta(d, null, gddData, blockTimes);
    copyToClipboard(text);
    setCopied(k);
    setTimeout(() => setCopied(null), 2000);
  }

  async function deleteMinuta(k, e) {
    e.stopPropagation();
    setConfirmDel(k);
  }

  async function confirmDelete(k) {
    await storeDel(k);
    setKeys(prev => prev.filter(x => x !== k));
    setConfirmDel(null);
  }

  const dateFmt = (k) => new Date(k.replace("weekly:", "")).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const isFixed = (k) => k === "weekly:2026-03-23"; // minutas fijas no se pueden eliminar

  return (
    <div className="fade">
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Minutas</h2>
      {confirmDel && (
        <div style={{ background: "rgba(255,59,48,.08)", border: "1px solid rgba(255,59,48,.2)", borderRadius: "var(--r-sm)", padding: "12px 16px", marginBottom: 12, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ flex: 1, fontSize: 13, color: "var(--tx2)" }}>¿Eliminar minuta del {dateFmt(confirmDel)}?</span>
          <button onClick={() => confirmDelete(confirmDel)} style={{ background: "var(--red)", color: "#fff", border: "none", borderRadius: 8, padding: "5px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Eliminar</button>
          <button onClick={() => setConfirmDel(null)} style={{ background: "var(--bg3)", color: "var(--tx2)", border: "none", borderRadius: 8, padding: "5px 14px", fontSize: 12, cursor: "pointer" }}>Cancelar</button>
        </div>
      )}
      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "var(--tx3)" }}>Cargando...</div>
      ) : keys.length === 0 ? (
        <Alerta icon="ℹ️" text="No hay minutas aún. Se generan al terminar una weekly." color="var(--blue)" />
      ) : keys.map((k) => {
        const isToday = k === STORE_KEY;
        return (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: "var(--r)", marginBottom: 8, background: "var(--bg2)", border: "1px solid " + (isToday ? "var(--blue)" : "var(--bg4)"), boxShadow: isToday ? "0 0 0 1px var(--blue)" : "var(--shadow)" }}>
            {/* Icono + título — clic abre detalle */}
            <div onClick={() => openMinuta(k)} style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, cursor: "pointer", minWidth: 0 }}>
              <div style={{ width: 40, height: 40, borderRadius: "var(--r-sm)", background: isToday ? "var(--blue)" : "var(--bg3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
                {isToday ? "📝" : "📋"}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--tx)", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  {dateFmt(k)}
                  {isToday && <span style={{ fontSize: 10, background: "var(--blue)", color: "#fff", borderRadius: 4, padding: "2px 6px", fontWeight: 700 }}>HOY</span>}
                </div>
                <div style={{ fontSize: 11, color: "var(--tx3)", marginTop: 2 }}>Weekly Mkt Corp · click para ver</div>
              </div>
            </div>
            {/* Acciones */}
            <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
              <button onClick={(e) => copyMinuta(k, e)} style={{ background: copied === k ? "var(--green)" : "var(--bg3)", color: copied === k ? "#fff" : "var(--tx2)", border: "1px solid var(--bg4)", borderRadius: "var(--r-sm)", padding: "4px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                {copied === k ? "✓" : "📋"}
              </button>
              <button onClick={() => openMinuta(k)} style={{ background: "var(--bg3)", color: "var(--tx2)", border: "1px solid var(--bg4)", borderRadius: "var(--r-sm)", padding: "4px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                ✏️
              </button>
              {!isFixed(k) && (
                <button onClick={(e) => deleteMinuta(k, e)} style={{ background: "var(--bg3)", color: "var(--red)", border: "1px solid var(--bg4)", borderRadius: "var(--r-sm)", padding: "4px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                  🗑
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}


function parseWhoWhen(text) {
  // Parse "→ Name (date)" into parts for bold rendering
  const idx = text.indexOf("→");
  if (idx === -1) return [{ t: text, bold: false }];
  const before = text.slice(0, idx + 1);
  const after = text.slice(idx + 1).trim();
  const parenStart = after.lastIndexOf("(");
  const parenEnd = after.lastIndexOf(")");
  if (parenStart > -1 && parenEnd > parenStart) {
    const who = after.slice(0, parenStart).trim();
    const when = after.slice(parenStart + 1, parenEnd);
    return [
      { t: before + " ", bold: false },
      { t: who, bold: true },
      { t: " (", bold: false },
      { t: when, bold: true, accent: true },
      { t: ")", bold: false },
    ];
  }
  return [{ t: text, bold: false }];
}

function BoldText({ parts, accentColor }) {
  return (
    <span>
      {parts.map((p, i) => (
        p.bold
          ? <strong key={i} style={{ color: p.accent ? accentColor : "inherit" }}>{p.t}</strong>
          : <span key={i}>{p.t}</span>
      ))}
    </span>
  );
}

// Renderer visual estructurado — usa datos directos, no texto plano
function renderMinutaVisual(text, wd2, an, gdd2) {
  const an2 = an; // alias para compatibilidad interna

  const SectionWrap = ({ num, title, sub, color, children }) => (
    <div style={{ marginBottom: 20, borderRadius: "var(--r)", overflow: "hidden", border: "1px solid var(--bg4)" }}>
      <div style={{ background: color + "15", borderLeft: "4px solid " + color, padding: "10px 16px", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontFamily: "var(--mono)", fontSize: 10, fontWeight: 800, color, background: color + "22", borderRadius: 5, padding: "2px 7px", flexShrink: 0 }}>{num}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--tx)" }}>{title}</span>
        {sub && <span style={{ fontSize: 11, color: "var(--tx3)", marginLeft: 6 }}>{sub}</span>}
      </div>
      <div style={{ background: "var(--bg2)" }}>{children}</div>
    </div>
  );

  // Helper: fila de alerta (vencidos / detenidos / sin fecha / sin responsable)
  const AlertRow = ({ label, items, color, renderItem }) => items.length === 0 ? null : (
    <div style={{ padding: "10px 16px", borderTop: "1px solid var(--bg4)" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
        {label} <span style={{ fontFamily: "var(--mono)", fontSize: 12 }}>({items.length})</span>
      </div>
      {items.slice(0, 4).map((it, i) => (
        <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", padding: "3px 0", fontSize: 11, borderBottom: i < Math.min(items.length, 4) - 1 ? "1px solid var(--bg3)" : "none" }}>
          {renderItem(it)}
        </div>
      ))}
      {items.length > 4 && <div style={{ fontSize: 10, color: "var(--tx3)", marginTop: 3 }}>+{items.length - 4} más</div>}
    </div>
  );

  const gddFallback = { semana:{leads:1186,mqls:30,sqls:10,opps:22,pipeline_mkt:58938625,pipeline_com:100372995}, anterior:{leads:1554,mqls:53,sqls:12,opps:20}, ytd:{leads:14636,mqls:957,sqls:225,opps:330}, fechas:{semana_desde:"16 mar",semana_hasta:"22 mar"} };
  const gdd = gdd2 || gddFallback;
  const s = gdd.semana || {}, a = gdd.anterior || {}, y = gdd.ytd || {}, f = gdd.fechas || {};
  const pctChg = (cur, prev) => (!prev) ? null : Math.round(((cur-prev)/prev)*100);
  const fmtM = (v) => v >= 1000000 ? "$"+(v/1000000).toFixed(1)+"M" : v >= 1000 ? "$"+(v/1000).toFixed(0)+"K" : "$"+(v||0);

  // ── ENCABEZADO ────────────────────────────────────────────────
  const dateLabel = text ? text.split("\n")[0].replace("WEEKLY MKT CORP · ", "") : "";
  const header = (
    <div style={{ marginBottom: 24, paddingBottom: 16, borderBottom: "2px solid var(--bg4)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <span style={{ fontSize: 28 }}>⚡</span>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--tx3)", textTransform: "uppercase", letterSpacing: "0.15em" }}>Weekly Mkt Corp · Upax</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "var(--tx)", letterSpacing: "-0.03em", lineHeight: 1.1 }}>MINUTA SEMANAL</div>
        </div>
      </div>
      <div style={{ fontSize: 14, color: "var(--tx2)", fontWeight: 500 }}>{dateLabel}</div>
    </div>
  );

  // ── SECCIÓN 1: GdD ───────────────────────────────────────────
  const mes = gdd.mes || {};
  const gddMetrics = [
    { label: "Leads", cur: s.leads||0, prev: a.leads||0, mes: mes.leads||0, ytd: y.leads||0, color: "var(--blue)" },
    { label: "MQLs",  cur: s.mqls||0,  prev: a.mqls||0,  mes: mes.mqls||0,  ytd: y.mqls||0,  color: "var(--purple)" },
    { label: "SQLs",  cur: s.sqls||0,  prev: a.sqls||0,  mes: mes.sqls||0,  ytd: y.sqls||0,  color: "var(--green)" },
    { label: "Opps",  cur: s.opps||0,  prev: a.opps||0,  mes: mes.opps||0,  ytd: y.opps||0,  color: "var(--yellow)" },
  ];
  const pTotal = (s.pipeline_mkt||0)+(s.pipeline_com||0);
  const fmtDateDMY = (dateStr) => {
    if (!dateStr) return "";
    // Intentar parsear "16 mar" o "2026-03-16" → DD - MM - AAAA
    const d = new Date(dateStr + (dateStr.includes("-") ? "T12:00:00" : ", 2026"));
    if (isNaN(d)) return dateStr;
    return d.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" }).replace(/\//g, " - ");
  };
  const gddSub = f.semana_desde ? `${fmtDateDMY(f.semana_desde)}${f.semana_hasta ? " al " + fmtDateDMY(f.semana_hasta) : ""}` : "";
  const sec1 = (
    <SectionWrap num="1" title="GENERACIÓN DE DEMANDA" sub={gddSub} color="var(--blue)">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 1, background: "var(--bg4)" }}>
        {gddMetrics.map((m, i) => {
          const pct = pctChg(m.cur, m.prev);
          return (
            <div key={i} style={{ padding: "14px 16px", background: "var(--bg2)" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--tx3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>{m.label}</div>
              <div style={{ fontFamily: "var(--mono)", fontSize: 28, fontWeight: 800, color: m.color, lineHeight: 1, letterSpacing: "-0.04em" }}>{m.cur.toLocaleString()}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 6 }}>
                {pct !== null && <span style={{ fontSize: 11, fontWeight: 700, color: pct >= 0 ? "var(--green)" : "var(--red)" }}>{pct >= 0 ? "▲" : "▼"}{Math.abs(pct)}%</span>}
                <span style={{ fontSize: 10, color: "var(--tx3)" }}>vs sem. ant.</span>
              </div>
              {m.mes > 0 && <div style={{ marginTop: 5, fontSize: 10, color: "var(--tx3)", borderTop: "1px solid var(--bg4)", paddingTop: 4 }}>
                <span style={{ color: "var(--tx2)", fontWeight: 600 }}>{m.mes.toLocaleString()}</span> <span>acum. mes</span>
              </div>}
            </div>
          );
        })}
      </div>
      <div style={{ padding: "10px 16px", borderTop: "1px solid var(--bg4)", display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
        {pTotal > 0 && <>
          <div style={{ fontSize: 12, color: "var(--tx3)" }}>Pipeline <span style={{ fontWeight: 700, color: "var(--tx)", fontFamily: "var(--mono)" }}>{fmtM(pTotal)}</span></div>
          <div style={{ fontSize: 12, color: "var(--tx3)" }}>Mkt <span style={{ fontWeight: 600 }}>{fmtM(s.pipeline_mkt||0)}</span></div>
          <div style={{ fontSize: 12, color: "var(--tx3)" }}>Com <span style={{ fontWeight: 600 }}>{fmtM(s.pipeline_com||0)}</span></div>
        </>}
        {f.lastUpdate && <div style={{ fontSize: 10, color: "var(--tx3)", marginLeft: "auto" }}>Actualizado: {f.lastUpdate}</div>}
      </div>
    </SectionWrap>
  );

  // ── SECCIÓN 2: Panorama ───────────────────────────────────────
  const sec2 = an2 ? (() => {
    const spr = an2.byPhaseWeek?.["🚧 Sprint"]||0, rev = an2.byPhaseWeek?.["👀 Review"]||0;
    const mod = an2.byPhaseWeek?.["⚙️ Modificación"]||0, det = an2.byPhase["🚫 Detenido"]||0;
    const ven = (an2.overdue||[]).length, done = (an2.doneLastWeek||[]).length;
    const noCronoItems = an2.noCrono||[];
    const noRespItems = an2.noResp||[];
    const stoppedItems = an2.stoppedWeek||[];

    const alerts = [
      { val: ven,       label: "Vencidos",  color: ven>0?"var(--red)":"var(--green)",    icon: "⏰", sub: ven>0?"requieren acción":"Al día" },
      { val: det,       label: "Detenidos", color: det>0?"var(--yellow)":"var(--green)",  icon: "🚫", sub: det>0?"bloqueados":"Sin bloqueos" },
      { val: spr+rev+mod, label: "Activos", color: "var(--blue)",                         icon: "⚡", sub: (rev+mod)+" en revisión" },
      { val: done,      label: "Done sem.", color: done>0?"var(--green)":"var(--tx3)",    icon: "✅", sub: (an2.doneTotal||0)+" total" },
    ];

    // Helper para obtener squad abreviado de un item
    const sqShort = (it) => {
      // 1. Leer columna squad directamente
      const raw = it.column_values?.color_mkz0s203 || "";
      const sqName = normalizeSquad(raw);
      const sq = SQUADS.find(s => s.name === sqName);
      if (sq) return sq.name.split(" ")[0];
      // 2. Fallback: squad del responsable
      const resp = it.column_values?.person || "";
      if (resp) {
        const persona = PERSONAS.find(p => resp.includes(p.name));
        if (persona) {
          const sqP = SQUADS.find(s => s.name === persona.squad);
          if (sqP) return sqP.name.split(" ")[0];
        }
      }
      // 3. Fallback: prefijo del nombre del item ("CF |", "PE |", "NC |", "UPAX |")
      const prefix = (it.name || "").split("|")[0].trim().toUpperCase();
      const prefixMap = { "CF":"Inbound","PE":"Portafolio","NC":"Portafolio","UPAX":"Performance","MU":"Performance","HF":"Portafolio","MX":"Portafolio","ZS":"RevOps","UX":"RevOps" };
      if (prefixMap[prefix]) return prefixMap[prefix];
      return "—";
    };

    return (
      <SectionWrap num="2" title="PANORAMA OPERATIVO" color="var(--purple)">
        {/* 4 badges de alerta — grid uniforme con overflow hidden */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 0, background: "var(--bg4)", overflow: "hidden" }}>
          {alerts.map((al, i) => (
            <div key={i} style={{ padding: "14px 16px", background: "var(--bg2)", textAlign: "center", borderRight: i < 3 ? "1px solid var(--bg4)" : "none" }}>
              <div style={{ fontSize: 20, marginBottom: 6 }}>{al.icon}</div>
              <div style={{ fontFamily: "var(--mono)", fontSize: 26, fontWeight: 800, color: al.color, lineHeight: 1 }}>{al.val}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--tx)", marginTop: 5 }}>{al.label}</div>
              <div style={{ fontSize: 10, color: "var(--tx3)", marginTop: 2 }}>{al.sub}</div>
            </div>
          ))}
        </div>

        {/* Resumen por squad — tabla compacta con columnas fijas */}
        <div style={{ borderTop: "1px solid var(--bg4)", padding: "4px 0" }}>
          {SQUADS.map((sq, si) => {
            const d = an2.bySquad[sq.name]; if (!d) return null;
            const dw = an2.bySquadWeek?.[sq.name];
            const act  = dw ? (dw.phases["🚧 Sprint"]||0)+(dw.phases["👀 Review"]||0)+(dw.phases["⚙️ Modificación"]||0) : 0;
            const det2 = d.phases["🚫 Detenido"]||0;
            const ven2 = (an2.overdue||[]).filter(it => normalizeSquad(it.column_values?.color_mkz0s203)===sq.name).length;
            // Personas con tareas esta semana en este squad
            const personasSemana = PERSONAS.filter(p => p.squad === sq.name && !p.sdr).map(p => {
              const ppw = an2.byPersonWeek[p.name];
              if (!ppw || ppw.total === 0) return null;
              const pVen = (an2.overdue||[]).some(it => (it.column_values?.person||"").includes(p.name));
              const pDet = ppw.stopped > 0;
              const badge = pVen ? " 🔴" : pDet ? " 🟡" : "";
              return { name: shortName(p.name), badge, total: ppw.total, pVen, pDet };
            }).filter(Boolean);
            return (
              <div key={sq.id} style={{ padding:"6px 16px", borderBottom: si<SQUADS.length-1?"1px solid var(--bg3)":"none" }}>
                {/* Fila principal: squad + métricas */}
                <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:6, minWidth:110 }}>
                    <span style={{ width:7, height:7, borderRadius:"50%", background:sq.color, flexShrink:0 }} />
                    <span style={{ fontWeight:700, color:sq.color, fontSize:12 }}>{sq.name.split(" ")[0]}</span>
                  </div>
                  <span style={{ fontSize:11, color:"var(--tx2)", minWidth:72 }}>{act} esta semana</span>
                  {ven2>0 && <span style={{ fontSize:11, color:"var(--red)", fontWeight:700 }}>{ven2} ⏰</span>}
                  {det2>0 && <span style={{ fontSize:11, color:"var(--yellow)", fontWeight:700 }}>{det2} 🚫</span>}
                </div>
                {/* Personas activas esta semana */}
                {personasSemana.length > 0 && (
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap", paddingLeft:16, marginTop:3 }}>
                    {personasSemana.map(p => (
                      <span key={p.name} style={{ fontSize:10, color: p.pVen?"var(--red)":p.pDet?"var(--yellow)":"var(--tx3)", background:"var(--bg3)", borderRadius:4, padding:"1px 6px", whiteSpace:"nowrap" }}>
                        {p.name}{p.badge} <span style={{ fontFamily:"var(--mono)", fontSize:9 }}>{p.total}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Top vencidos */}
        <AlertRow label="⏰ Top vencidos" items={an2.overdue||[]} color="var(--red)" renderItem={it => {
          const tl = parseTL(it.column_values?.timerange_mkzcqv0j);
          const d = tl.end ? daysDiff(TODAY, tl.end) : 0;
          return <>
            <span style={{ fontFamily:"var(--mono)", color:"var(--red)", fontWeight:700, minWidth:32, fontSize:10 }}>-{d}d</span>
            <span style={{ fontSize:9, fontWeight:700, color:"var(--tx3)", minWidth:52 }}>{sqShort(it)}</span>
            <span style={{ flex:1, color:"var(--tx2)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{it.name}</span>
            <span style={{ color:"var(--tx3)", fontSize:10 }}>{shortName(it.column_values?.person)}</span>
          </>;
        }} />

        {/* Top detenidos */}
        <AlertRow label="🚫 Detenidos esta semana" items={stoppedItems} color="var(--yellow)" renderItem={it => <>
          <span style={{ fontSize:9, fontWeight:700, color:"var(--tx3)", minWidth:52 }}>{sqShort(it)}</span>
          <span style={{ flex:1, color:"var(--tx2)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{it.name}</span>
          <span style={{ color:"var(--tx3)", fontSize:10 }}>{shortName(it.column_values?.person)}</span>
        </>} />

        {/* Sprint sin fecha */}
        <AlertRow label="📅 Sprint sin fecha" items={noCronoItems} color="var(--yellow)" renderItem={it => <>
          <span style={{ fontSize:9, fontWeight:700, color:"var(--tx3)", minWidth:52 }}>{sqShort(it)}</span>
          <span style={{ flex:1, color:"var(--tx2)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{it.name}</span>
          <span style={{ color:"var(--tx3)", fontSize:10 }}>{shortName(it.column_values?.person)}</span>
        </>} />

        {/* Sprint sin responsable */}
        <AlertRow label="👤 Sin responsable" items={noRespItems} color="var(--red)" renderItem={it => <>
          <span style={{ fontSize:9, fontWeight:700, color:"var(--tx3)", minWidth:52 }}>{sqShort(it)}</span>
          <span style={{ flex:1, color:"var(--tx2)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{it.name}</span>
          <span style={{ color:"var(--red)", fontSize:10 }}>sin asignar</span>
        </>} />

      </SectionWrap>
    );
  })() : null;

  // ── SECCIÓN 3: Focos por squad ───────────────────────────────
  const sec3 = (() => {
    const focos = wd2?.focos || {};
    const squadsWithData = SQUADS.filter(sq => {
      const raw = focos[sq.id];
      const arr = Array.isArray(raw) ? raw : (raw?.focos||raw?.blocker||raw?.necesito ? [raw] : []);
      return arr.some(f => f.focos?.trim()||f.blocker?.trim()||f.necesito?.trim());
    });
    if (!squadsWithData.length) return null;
    return (
      <SectionWrap num="3" title="FOCOS POR SQUAD" color="var(--green)">
        <div style={{ padding: "8px 0" }}>
          {squadsWithData.map((sq, si) => {
            const raw = focos[sq.id];
            const arr = Array.isArray(raw) ? raw : (raw?.focos||raw?.blocker||raw?.necesito ? [raw] : []);
            const presenter = wd2?.presenters?.[sq.id] || sq.lead;
            return (
              <div key={sq.id} style={{ borderBottom: si < squadsWithData.length-1 ? "2px solid var(--bg3)" : "none", paddingBottom: 12, marginBottom: si < squadsWithData.length-1 ? 4 : 0 }}>
                {/* Squad header */}
                <div style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 16px 8px", background: sq.color+"0A" }}>
                  <div style={{ width:4, height:32, borderRadius:2, background:sq.color, flexShrink:0 }} />
                  <div>
                    <div style={{ fontSize:13, fontWeight:700, color:sq.color }}>{sq.name}</div>
                    <div style={{ fontSize:11, color:"var(--tx3)" }}>{presenter}</div>
                  </div>
                </div>
                {/* Content */}
                <div style={{ padding:"6px 16px 0" }}>
                  {arr.filter(f=>f.focos?.trim()).map((f,i) => {
                    const parts = f.focos.split(/\d+\)/).map(s=>s.trim()).filter(Boolean);
                    return (parts.length>1?parts:[f.focos.trim()]).map((p,j) => (
                      <div key={i+"-"+j} style={{ display:"flex", gap:8, padding:"4px 0", borderBottom:"1px solid var(--bg3)", alignItems:"flex-start" }}>
                        <span style={{ color:sq.color, fontWeight:700, flexShrink:0, marginTop:1 }}>·</span>
                        <span style={{ fontSize:13, color:"var(--tx2)", lineHeight:1.5 }}>{p}</span>
                      </div>
                    ));
                  })}
                  {arr.filter(f=>f.blocker?.trim()).map((f,i) => {
                    const who = f.blocker_quien ? " → "+shortName(f.blocker_quien) : "";
                    const when = f.blocker_cuando ? " ("+new Date(f.blocker_cuando+"T12:00:00").toLocaleDateString("es-MX",{day:"numeric",month:"short"})+")" : "";
                    return (
                      <div key={"b"+i} style={{ display:"flex", gap:8, padding:"5px 10px", margin:"4px 0", background:"rgba(255,59,48,.07)", borderRadius:6, borderLeft:"3px solid var(--red)", alignItems:"flex-start" }}>
                        <span style={{ fontSize:11, fontWeight:700, color:"var(--red)", flexShrink:0 }}>⚠ BLOCKER</span>
                        <span style={{ fontSize:12, color:"var(--tx2)", flex:1 }}>{f.blocker.trim()}<strong>{who}</strong>{when && <strong style={{color:"var(--red)"}}>{when}</strong>}</span>
                      </div>
                    );
                  })}
                  {arr.filter(f=>f.necesito?.trim()).map((f,i) => {
                    const who = f.necesito_quien ? " → "+shortName(f.necesito_quien) : "";
                    const when = f.necesito_cuando ? " ("+new Date(f.necesito_cuando+"T12:00:00").toLocaleDateString("es-MX",{day:"numeric",month:"short"})+")" : "";
                    return (
                      <div key={"n"+i} style={{ display:"flex", gap:8, padding:"5px 10px", margin:"4px 0", background:"rgba(255,159,10,.07)", borderRadius:6, borderLeft:"3px solid var(--yellow)", alignItems:"flex-start" }}>
                        <span style={{ fontSize:11, fontWeight:700, color:"var(--yellow)", flexShrink:0 }}>✋ NECESITO</span>
                        <span style={{ fontSize:12, color:"var(--tx2)", flex:1 }}>{f.necesito.trim()}<strong>{who}</strong>{when && <strong style={{color:"var(--yellow)"}}>{when}</strong>}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </SectionWrap>
    );
  })();

  // ── SECCIÓN 4: Compromisos ────────────────────────────────────
  const comps2 = (wd2?.compromisos||[]).filter(c=>c.que?.trim());
  const sec4 = comps2.length ? (
    <SectionWrap num="4" title="COMPROMISOS" color="var(--yellow)">
      <div style={{ padding: "8px 16px" }}>
        {comps2.map((c,i) => {
          const done = c.status === "done";
          const fecha = c.cuando ? new Date(c.cuando+"T12:00:00").toLocaleDateString("es-MX",{day:"numeric",month:"short"}) : "sin fecha";
          return (
            <div key={i} style={{ display:"flex", gap:10, alignItems:"flex-start", padding:"6px 0", borderBottom: i<comps2.length-1?"1px solid var(--bg3)":"none", opacity: done?0.55:1 }}>
              <span style={{ color: done?"var(--green)":"var(--blue)", fontSize:16, flexShrink:0, lineHeight:1.3, marginTop:1 }}>{done?"✓":"○"}</span>
              <span style={{ flex:1, fontSize:13, color: done?"var(--tx3)":"var(--tx)", lineHeight:1.5, textDecoration: done?"line-through":"none" }}>{c.que.trim()}</span>
              <div style={{ flexShrink:0, textAlign:"right" }}>
                <div style={{ fontSize:11, fontWeight:600, color:"var(--tx2)" }}>{shortName(c.quien)||"—"}</div>
                <div style={{ fontSize:10, color:"var(--tx3)" }}>{fecha}</div>
              </div>
            </div>
          );
        })}
      </div>
    </SectionWrap>
  ) : null;

  // ── SECCIÓN 5: Carga semanal — TODOS del equipo, partido de PERSONAS
  // Se parte de la lista maestra para que aparezcan todos (incl. Franco con 0)
  const sec5 = an2 ? (() => {
    const pw = an2.byPersonWeek || {};
    // Todos los miembros no-SDR, ordenados por carga desc
    const all = PERSONAS
      .filter(p => !p.sdr)
      .map(p => ({
        name: p.name,
        squad: p.squad,
        d: pw[p.name] || { items: 0, stopped: 0, total: 0 },
      }))
      .sort((a, b) => b.d.total - a.d.total);
    const maxVal = Math.max(...all.map(p => p.d.total), 1);
    const half = Math.ceil(all.length / 2);
    const col1 = all.slice(0, half), col2 = all.slice(half);
    const CRow = ({ person, squad, d, rank }) => {
      const pct = maxVal > 0 ? d.total / maxVal : 0;
      const barColor = d.total > 10 ? "var(--red)" : d.total > 6 ? "var(--yellow)" : d.total > 0 ? "var(--green)" : "var(--bg4)";
      const sqColor = SQUADS.find(s => s.name === squad)?.color || "var(--bg4)";
      return (
        <div style={{ display:"flex", alignItems:"center", gap:6, padding:"4px 0", borderBottom:"1px solid var(--bg3)", opacity: d.total===0 ? 0.45 : 1 }}>
          <span style={{ fontFamily:"var(--mono)", fontSize:9, color:"var(--tx3)", minWidth:14, textAlign:"right" }}>{rank}</span>
          <span style={{ width:5, height:5, borderRadius:"50%", background:sqColor, flexShrink:0 }} />
          <span style={{ fontSize:11, fontWeight: d.total>0 ? 600 : 400, flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", color:d.total>10?"var(--red)":"var(--tx)" }}>{shortName(person)}</span>
          {d.stopped>0 && <span style={{ fontSize:9, color:"var(--red)", fontWeight:700 }}>🚫</span>}
          <div style={{ width:44, height:4, background:"var(--bg4)", borderRadius:2, overflow:"hidden", flexShrink:0 }}>
            <div style={{ width:(pct*100)+"%", height:"100%", background:barColor, borderRadius:2 }} />
          </div>
          <span style={{ fontFamily:"var(--mono)", fontSize:11, fontWeight:700, color: d.total>0 ? barColor : "var(--tx3)", minWidth:20, textAlign:"right" }}>{d.total}</span>
        </div>
      );
    };
    return (
      <SectionWrap num="5" title="CARGA SEMANAL" sub={"("+WEEK.start.toLocaleDateString("es-MX",{day:"numeric",month:"short"})+" – "+WEEK.end.toLocaleDateString("es-MX",{day:"numeric",month:"short"})+")"} color="var(--cyan)">
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 16px", padding:"10px 16px" }}>
          <div>{col1.map((p,i)=><CRow key={p.name} person={p.name} squad={p.squad} d={p.d} rank={i+1} />)}</div>
          <div>{col2.map((p,i)=><CRow key={p.name} person={p.name} squad={p.squad} d={p.d} rank={half+i+1} />)}</div>
        </div>
      </SectionWrap>
    );
  })() : null;

  return [header, sec1, sec2, sec3, sec4, sec5].filter(Boolean);
}


function PdfButton({ text, dateStr, wd, analysis, gddData }) {
  // Genera un HTML completo auto-contenido y abre en nueva ventana para imprimir como PDF
  function handlePdf() {
    const gdd = gddData || {};
    const s = gdd.semana || {}, a = gdd.anterior || {}, mes = gdd.mes || {}, y = gdd.ytd || {}, f = gdd.fechas || {};
    const pTotal = (s.pipeline_mkt||0)+(s.pipeline_com||0);
    const fmtN = (v) => (v||0).toLocaleString("es-MX");
    const fmtM = (v) => v >= 1000000 ? "$"+(v/1000000).toFixed(1)+"M" : v >= 1000 ? "$"+(v/1000).toFixed(0)+"K" : "$"+(v||0);
    const pct = (cur, prev) => { if (!prev) return ""; const p = Math.round(((cur-prev)/prev)*100); return `<span style="color:${p>=0?"#16a34a":"#dc2626"};font-weight:700">${p>=0?"▲":"▼"}${Math.abs(p)}%</span>`; };
    const dateLabel = new Date(dateStr).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

    // Construir secciones de focos
    let focosHtml = "";
    if (wd) {
      SQUADS.forEach(sq => {
        const raw = wd.focos?.[sq.id];
        const arr = Array.isArray(raw) ? raw : (raw?.focos||raw?.blocker||raw?.necesito ? [raw] : []);
        const filled = arr.filter(f2 => f2.focos?.trim()||f2.blocker?.trim()||f2.necesito?.trim());
        if (!filled.length) return;
        const presenter = wd.presenters?.[sq.id] || sq.lead;
        focosHtml += `<div style="margin-bottom:16px;padding:12px 16px;border-radius:8px;border-left:4px solid ${sq.color};background:#fafafa">
          <div style="font-weight:700;color:${sq.color};font-size:13px;margin-bottom:8px">${sq.name} <span style="font-weight:400;color:#666">· ${presenter}</span></div>`;
        filled.forEach(f2 => {
          if (f2.focos?.trim()) focosHtml += `<div style="font-size:12px;color:#333;margin-bottom:4px">🎯 ${f2.focos.trim().replace(/</g,"&lt;")}</div>`;
          if (f2.blocker?.trim()) focosHtml += `<div style="font-size:12px;color:#dc2626;margin-bottom:4px">🚫 <strong>Blocker:</strong> ${f2.blocker.trim().replace(/</g,"&lt;")}</div>`;
          if (f2.necesito?.trim()) focosHtml += `<div style="font-size:12px;color:#d97706;margin-bottom:4px">🤝 <strong>Necesito:</strong> ${f2.necesito.trim().replace(/</g,"&lt;")}</div>`;
        });
        focosHtml += `</div>`;
      });
    }

    // Compromisos
    let compsHtml = "";
    const comps = (wd?.compromisos||[]).filter(c => c.que?.trim());
    if (comps.length) {
      compsHtml = comps.map((c,i) => {
        const fecha = c.cuando ? new Date(c.cuando+"T12:00:00").toLocaleDateString("es-MX",{day:"numeric",month:"short"}) : "sin fecha";
        return `<div style="display:flex;gap:10px;padding:6px 0;border-bottom:1px solid #eee;font-size:12px">
          <span style="color:${c.status==="done"?"#16a34a":"#999"}">${c.status==="done"?"✅":"⬜"}</span>
          <span style="flex:1;${c.status==="done"?"text-decoration:line-through;color:#999":""}">${(c.que||"").replace(/</g,"&lt;")}</span>
          <span style="color:#666">${shortName(c.quien)||""}</span>
          <span style="color:#999">${fecha}</span>
        </div>`;
      }).join("");
    }

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Minuta Weekly ${dateStr}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #1a1a1a; background: #fff; padding: 32px 40px; max-width: 760px; margin: 0 auto; font-size: 13px; line-height: 1.6; }
  h1 { font-size: 22px; font-weight: 800; letter-spacing: -0.03em; margin-bottom: 4px; }
  h2 { font-size: 14px; font-weight: 700; color: #333; margin: 20px 0 10px; padding-bottom: 6px; border-bottom: 2px solid #eee; }
  .meta { font-size: 12px; color: #666; margin-bottom: 24px; }
  .kpi-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 1px; background: #e5e5e5; border-radius: 8px; overflow: hidden; margin-bottom: 16px; }
  .kpi { background: #fff; padding: 14px; }
  .kpi-label { font-size: 10px; font-weight: 700; color: #888; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 6px; }
  .kpi-val { font-family: "Courier New", monospace; font-size: 26px; font-weight: 800; line-height: 1; }
  .kpi-sub { font-size: 10px; color: #888; margin-top: 4px; }
  .kpi-mes { font-size: 10px; color: #444; margin-top: 4px; border-top: 1px solid #f0f0f0; padding-top: 4px; }
  .pipeline { background: #f8f8f8; border-radius: 6px; padding: 10px 14px; font-size: 12px; color: #444; display: flex; gap: 16px; margin-bottom: 20px; flex-wrap: wrap; }
  @media print {
    body { padding: 20px; }
    @page { margin: 1.5cm; size: A4; }
    h2 { break-after: avoid; }
    .no-print { display: none !important; }
  }
</style>
</head>
<body>
  <div class="no-print" style="background:#1d1d1f;color:#fff;padding:12px 20px;margin:-32px -40px 24px;display:flex;align-items:center;justify-content:space-between;gap:16px">
    <span style="font-size:13px">📄 Para guardar como PDF: <strong>Ctrl+P</strong> (Windows) · <strong>⌘+P</strong> (Mac) → Guardar como PDF</span>
    <button onclick="window.close()" style="background:transparent;border:1px solid #555;color:#ccc;padding:5px 14px;border-radius:6px;cursor:pointer;font-size:12px">✕ Cerrar</button>
  </div>

  <h1>⚡ Minuta Weekly · Mkt Corp</h1>
  <div class="meta">📅 ${dateLabel} · Grupo UPAX</div>

  <h2>📊 Generación de Demanda${f.semana_desde ? ` · ${f.semana_desde}${f.semana_hasta?" al "+f.semana_hasta:""}` : ""}</h2>
  <div class="kpi-grid">
    ${[
      {l:"Leads",cur:s.leads||0,prev:a.leads||0,mes:mes.leads||0,ytd:y.leads||0,c:"#0a84ff"},
      {l:"MQLs",cur:s.mqls||0,prev:a.mqls||0,mes:mes.mqls||0,ytd:y.mqls||0,c:"#af52de"},
      {l:"SQLs",cur:s.sqls||0,prev:a.sqls||0,mes:mes.sqls||0,ytd:y.sqls||0,c:"#34c759"},
      {l:"Opps",cur:s.opps||0,prev:a.opps||0,mes:mes.opps||0,ytd:y.opps||0,c:"#ff9f0a"},
    ].map(m => `<div class="kpi">
      <div class="kpi-label">${m.l}</div>
      <div class="kpi-val" style="color:${m.c}">${fmtN(m.cur)}</div>
      <div class="kpi-sub">${pct(m.cur,m.prev)} vs sem. ant.</div>
      ${m.mes ? `<div class="kpi-mes">${fmtN(m.mes)} acum. mes</div>` : ""}
    </div>`).join("")}
  </div>
  ${pTotal > 0 ? `<div class="pipeline">🏦 Pipeline: <strong>${fmtM(pTotal)}</strong> · Mkt ${fmtM(s.pipeline_mkt||0)} · Com ${fmtM(s.pipeline_com||0)}</div>` : ""}

  ${focosHtml ? `<h2>🎯 Focos por Squad</h2>${focosHtml}` : ""}

  ${compsHtml ? `<h2>📝 Compromisos</h2>${compsHtml}` : ""}

  <div style="margin-top:28px;font-size:10px;color:#aaa;border-top:1px solid #eee;padding-top:8px;font-family:monospace">
    Weekly Mkt Corp Upax · generado ${new Date().toLocaleString("es-MX")}
  </div>
</body>
</html>`;

    const win = window.open("", "_blank", "width=820,height=900");
    if (win) { win.document.write(html); win.document.close(); }
    else { alert("Habilita popups para este sitio para generar el PDF"); }
  }

  return (
    <button onClick={handlePdf} style={{ background: "var(--tx)", color: "var(--bg)", border: "none", borderRadius: "var(--r-sm)", padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
      📄 PDF
    </button>
  );
}

function SlackButton({ text }) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState(false);

  async function handleSend() {
    setSending(true); setErr(false);
    try {
      const res = await fetch("/api/slack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const d = await res.json();
      if (d.success) { setSent(true); setTimeout(() => setSent(false), 3000); }
      else { setErr(true); setTimeout(() => setErr(false), 3000); copyToClipboard(text); }
    } catch { setErr(true); setTimeout(() => setErr(false), 3000); copyToClipboard(text); }
    setSending(false);
  }

  return (
    <button onClick={handleSend} disabled={sending} style={{
      background: sent ? "var(--green)" : err ? "var(--red)" : "linear-gradient(135deg,#4A154B,#611f69)",
      color: "#fff", border: "none", borderRadius: "var(--r-sm)", padding: "6px 14px",
      fontSize: 12, fontWeight: 600, cursor: sending ? "default" : "pointer", opacity: sending ? 0.7 : 1,
    }}>
      {sent ? "✓ Enviado" : err ? "⚠️ Copiado" : sending ? "⏳" : "📨 Slack"}
    </button>
  );
}

function MinutaDetailView({ weekKey, data, todayWd, todayAnalysis, gddData, blockTimes, onBack, onClose }) {
  const isToday = weekKey === STORE_KEY;
  // Datos estructurados para el renderer visual
  const visualWd = isToday ? todayWd : (data || {});
  const visualAn = todayAnalysis; // análisis del board siempre actual, independiente de la fecha de la minuta
  const visualGdd = gddData; // siempre pasa el gdd actual
  // Texto plano para copiar/PDF (siempre regenerado con datos actuales)
  const rawText = isToday
    ? generateMinuta(todayWd, todayAnalysis, gddData, blockTimes)
    : (data?.minutaText || generateMinuta(data, null, gddData, blockTimes));
  const [editMode, setEditMode] = useState(false);
  const [editText, setEditText] = useState(rawText);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const displayText = editMode ? editText : rawText;
  const dateStr = weekKey.replace("weekly:", "");
  const dateFmt = new Date(dateStr).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  async function handleSave() {
    await storeSet(weekKey, { ...(data || {}), minutaText: editText });
    setSaved(true); setTimeout(() => setSaved(false), 2000); setEditMode(false);
  }
  function handleCopy() {
    copyToClipboard(displayText); setCopied(true); setTimeout(() => setCopied(false), 2000);
  }




  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", borderBottom: "1px solid var(--bg4)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={onBack} style={{ background: "var(--bg3)", border: "none", borderRadius: "var(--r-sm)", padding: "5px 10px", fontSize: 12, cursor: "pointer", color: "var(--tx3)" }}>← Volver</button>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>📋 Minuta</div>
            <div style={{ fontSize: 11, color: "var(--tx3)" }}>{dateFmt}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {editMode
            ? <button onClick={handleSave} style={{ background: "var(--green)", color: "#fff", border: "none", borderRadius: "var(--r-sm)", padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{saved ? "✓ Guardado" : "💾 Guardar"}</button>
            : <button onClick={() => { setEditMode(true); setEditText(rawText); }} style={{ background: "var(--bg3)", color: "var(--tx2)", border: "1px solid var(--bg4)", borderRadius: "var(--r-sm)", padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>✏️ Editar</button>}
          <button onClick={handleCopy} style={{ background: copied ? "var(--green)" : "var(--blue)", color: "#fff", border: "none", borderRadius: "var(--r-sm)", padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{copied ? "✓ Copiado" : "📋 Copiar"}</button>
          <SlackButton text={displayText} />
          <PdfButton text={displayText} dateStr={dateStr} wd={visualWd} analysis={visualAn} gddData={visualGdd} />
          <button onClick={onClose} style={{ background: "var(--bg3)", border: "none", width: 32, height: 32, borderRadius: 16, fontSize: 16, cursor: "pointer", color: "var(--tx3)", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
        </div>
      </div>
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {editMode ? (
          <textarea value={editText} onChange={e => setEditText(e.target.value)} style={{ flex: 1, width: "100%", background: "var(--bg3)", color: "var(--tx)", border: "none", padding: "16px 20px", fontSize: 12, fontFamily: "var(--mono)", resize: "none", outline: "none", lineHeight: 1.7 }} />
        ) : (
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
            {renderMinutaVisual(rawText, visualWd, visualAn, visualGdd)}
          </div>
        )}
      </div>
    </>
  );
}

function MinutaPreviewModal({ wd, analysis, gddData, blockTimes, onClose }) {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedKey, setSelectedKey] = useState(null);
  const [selectedData, setSelectedData] = useState(null);
  const dateFmt = (k) => new Date(k.replace("weekly:", "")).toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

  useEffect(() => {
    (async () => {
      const allKeys = await storeList("weekly:");
      // Ensure today and MAR23 always appear
      const mar23 = "weekly:2026-03-23";
      const merged = [...new Set([STORE_KEY, ...allKeys, mar23])].sort().reverse();
      setKeys(merged);
      setLoading(false);
    })();
  }, []);

  async function selectKey(k) {
    let d = await storeGet(k);
    if (!d && k === "weekly:2026-03-23") d = WEEKLY_MAR23;
    setSelectedData(d);
    setSelectedKey(k);
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", backdropFilter: "blur(10px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--bg2)", borderRadius: "var(--r-lg)", boxShadow: "0 32px 80px rgba(0,0,0,.25)", width: "100%", maxWidth: 680, maxHeight: "85vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {selectedKey ? (
          <MinutaDetailView
            weekKey={selectedKey}
            data={selectedData}
            todayWd={wd}
            todayAnalysis={analysis}
            gddData={gddData}
            blockTimes={blockTimes}
            onBack={() => setSelectedKey(null)}
            onClose={onClose}
          />
        ) : (
          <>
            {/* Lista header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid var(--bg4)", flexShrink: 0 }}>
              <span style={{ fontSize: 16, fontWeight: 700 }}>📋 Minutas</span>
              <button onClick={onClose} style={{ background: "var(--bg3)", border: "none", width: 32, height: 32, borderRadius: 16, fontSize: 16, cursor: "pointer", color: "var(--tx3)", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
            </div>
            {/* Lista de minutas */}
            <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
              {loading ? (
                <div style={{ textAlign: "center", padding: 40, color: "var(--tx3)" }}>Cargando...</div>
              ) : keys.length === 0 ? (
                <div style={{ textAlign: "center", padding: 40, color: "var(--tx3)", fontSize: 13 }}>No hay minutas guardadas aún.</div>
              ) : (
                keys.map((k) => {
                  const isToday = k === STORE_KEY;
                  return (
                    <div key={k} onClick={() => selectKey(k)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: "var(--r)", marginBottom: 6, background: "var(--bg)", border: "1px solid var(--bg4)", cursor: "pointer", transition: "all .15s" }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg3)"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "var(--bg)"}
                    >
                      <div style={{ width: 36, height: 36, borderRadius: "var(--r-sm)", background: isToday ? "var(--blue)" : "var(--bg3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
                        {isToday ? "📝" : "📋"}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--tx)" }}>{dateFmt(k)}{isToday ? <span style={{ marginLeft: 8, fontSize: 10, background: "var(--blue)", color: "#fff", borderRadius: 4, padding: "2px 6px" }}>hoy</span> : ""}</div>
                        <div style={{ fontSize: 11, color: "var(--tx3)", marginTop: 1 }}>Weekly Mkt Corp</div>
                      </div>
                      <span style={{ fontSize: 16, color: "var(--tx3)" }}>›</span>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMsg, setLoadingMsg] = useState("Iniciando...");
  const [err, setErr] = useState(null);
  const [tab, setTab] = useState("home");
  const [wd, setWd] = useState(emptyWeekly());
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [finished, setFinished] = useState(false);
  const [minutaDraft, setMinutaDraft] = useState("");
  const [minutaSaved, setMinutaSaved] = useState(false);
  const [activeSquad, setActiveSquad] = useState(SQUADS[0].id);
  const [currentBlockIdx, setCurrentBlockIdx] = useState(0); // FIX: index-based block tracking
  const [blockTimes, setBlockTimes] = useState({});          // FIX: time per block
  const blockStartRef = useRef(null);
  const [showMinutas, setShowMinutas] = useState(false); // historial completo (no usado en botón)
  const [minutaPreview, setMinutaPreview] = useState(false); // preview de minuta del día
  const [presenterMode, setPresenterMode] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [minutaLightbox, setMinutaLightbox] = useState(null); // { key, data }
  const [copyModal, setCopyModal] = useState(null);
  const [phaseModal, setPhaseModal] = useState(null); // { phase, items }
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [appGddData, setAppGddData] = useState(null);
  const intRef = useRef(null), startRef = useRef(null), elRef = useRef(0);

  const saveFn = useCallback(async (d) => { await storeSet(STORE_KEY, d); }, []);

  const GDD_DEFAULT_APP = {
    semana: { leads: 1186, mqls: 30, sqls: 10, opps: 22, pipeline_mkt: 58938625, pipeline_com: 100372995 },
    anterior: { leads: 1554, mqls: 53, sqls: 12, opps: 20 },
    mes: { leads: 4820, mqls: 112, sqls: 38, opps: 78 },
    ytd: { leads: 14636, mqls: 957, sqls: 225, opps: 330 },
    fechas: { semana_desde: "16 mar", semana_hasta: "22 mar", mes_label: "mar 2026" },
    lastUpdate: "23 mar 2026",
  };
  useEffect(() => {
    storeGet("config:gdd-metrics").then((v) => {
      setAppGddData(v || GDD_DEFAULT_APP);
    }).catch(() => setAppGddData(GDD_DEFAULT_APP));
  }, []);

  const block = AGENDA[currentBlockIdx] || AGENDA[AGENDA.length - 1];

  // FIX: advanceBlock properly defined — stops current block timer, advances idx, starts next
  const advanceBlock = useCallback((direction) => {
    setCurrentBlockIdx((prev) => {
      const next = direction === "next" ? Math.min(prev + 1, AGENDA.length - 1) : Math.max(prev - 1, 0);
      if (next === prev) return prev;

      // Save time spent on current block
      if (blockStartRef.current) {
        const spent = Math.round((Date.now() - blockStartRef.current) / 1000);
        setBlockTimes((bt) => ({ ...bt, [AGENDA[prev].id]: (bt[AGENDA[prev].id] || 0) + spent }));
      }
      blockStartRef.current = Date.now();

      // Auto-navigate tab
      const nextBlock = AGENDA[next];
      setTab(nextBlock.tab);
      if (nextBlock.sq && nextBlock.sq !== "cross") setActiveSquad(nextBlock.sq);

      return next;
    });
  }, []);

  // FIX: jumpToBlock by index (used by TabAgenda)
  const jumpToBlock = useCallback((idx) => {
    if (idx < 0 || idx >= AGENDA.length) return;
    if (blockStartRef.current) {
      const spent = Math.round((Date.now() - blockStartRef.current) / 1000);
      setBlockTimes((bt) => ({ ...bt, [AGENDA[currentBlockIdx].id]: (bt[AGENDA[currentBlockIdx].id] || 0) + spent }));
    }
    blockStartRef.current = Date.now();
    setCurrentBlockIdx(idx);
    const b = AGENDA[idx];
    setTab(b.tab);
    if (b.sq && b.sq !== "cross") setActiveSquad(b.sq);
  }, [currentBlockIdx]);

  const startTimer = useCallback(() => {
    startRef.current = Date.now();
    elRef.current = elapsed;
    if (!blockStartRef.current) blockStartRef.current = Date.now();
    setRunning(true);
    if (elapsed === 0) { setTab("panorama"); setCurrentBlockIdx(1); } // Start at Panorama Semanal
  }, [elapsed]);

  const pauseTimer = useCallback(() => {
    setRunning(false);
    clearInterval(intRef.current);
    // Save time for current block up to pause
    if (blockStartRef.current) {
      const spent = Math.round((Date.now() - blockStartRef.current) / 1000);
      setBlockTimes((bt) => ({ ...bt, [block.id]: (bt[block.id] || 0) + spent }));
      blockStartRef.current = null;
    }
  }, [block]);

  const finishTimer = useCallback(() => {
    setRunning(false);
    clearInterval(intRef.current);
    // Save final block time
    if (blockStartRef.current) {
      const spent = Math.round((Date.now() - blockStartRef.current) / 1000);
      setBlockTimes((bt) => ({ ...bt, [block.id]: (bt[block.id] || 0) + spent }));
      blockStartRef.current = null;
    }
    setFinished(true);
    setMinutaSaved(false);
  }, [block]);

  useEffect(() => {
    if (finished && !minutaDraft) {
      const draft = generateMinuta(wd, analysis, appGddData, blockTimes);
      setMinutaDraft(draft);
      storeSet(STORE_KEY, { ...wd, minutaText: draft });
    }
  }, [finished]);

  useEffect(() => {
    if (running) {
      if (!blockStartRef.current) blockStartRef.current = Date.now();
      intRef.current = setInterval(() => setElapsed(elRef.current + Math.floor((Date.now() - startRef.current) / 1000)), 200);
    }
    return () => clearInterval(intRef.current);
  }, [running]);

  // Auto-save every 60s while running
  useEffect(() => {
    if (!running) return;
    const as = setInterval(() => storeSet(STORE_KEY, wd), 60000);
    return () => clearInterval(as);
  }, [running, wd]);

  const eMin = elapsed / 60;

  const handleCopy = useCallback((text) => {
    const ok = copyToClipboard(text);
    if (!ok) setCopyModal(text);
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setErr(null);
    try {
      const fresh = await fetchAllItems();
      if (fresh.length > 0) {
        setItems(fresh);
        await storeSet(CACHE_KEY, { items: fresh, ts: new Date().toISOString(), doneCount: fresh._doneCount || 0 });
        setLastUpdate(new Date().toISOString());
      }
    } catch {}
    setRefreshing(false);
  }, []);

  // Load — cache first, then Monday, never blocks UI forever
  useEffect(() => {
    (async () => {
      let hasCached = false;
      try {
        setLoadingMsg("Buscando cache...");
        const [cached, stored] = await Promise.all([storeGet(CACHE_KEY), storeGet(STORE_KEY)]);
        setWd(stored || WEEKLY_MAR23);
        if (cached?.items?.length > 0) {
          setItems(cached.items);
          setLastUpdate(cached.ts);
          setLoading(false);
          hasCached = true;
          if (Date.now() - new Date(cached.ts).getTime() > 30 * 60 * 1000) refresh();
        }
      } catch { setWd(WEEKLY_MAR23); }

      if (hasCached) return;

      // Safety timeout — never hang forever
      const safetyTimer = setTimeout(() => {
        setErr("Tiempo de espera agotado — Monday no respondió. Trabaja en modo sin conexión o presiona Sync.");
        setLoading(false);
      }, 65000);

      try {
        setLoadingMsg("Conectando con Monday.com...");
        const all = await fetchAllItems();
        clearTimeout(safetyTimer);
        if (all.length > 0) {
          setItems(all);
          await storeSet(CACHE_KEY, { items: all, ts: new Date().toISOString(), doneCount: all._doneCount || 0 });
          setLastUpdate(new Date().toISOString());
        } else {
          setErr((all._error || "Sin datos") + " · Trabaja en modo sin conexión.");
        }
      } catch (e) {
        clearTimeout(safetyTimer);
        setErr("Error al conectar: " + (e?.message || "desconocido"));
      }
      setLoading(false);
    })();
  }, []);

  const analysis = useMemo(() => {
    if (!items.length) return null;
    const byPhase = {}, byPhaseWeek = {}, bySquad = {}, bySquadWeek = {}, byPerson = {}, byPersonWeek = {}, overdue = [], noResp = [], noCrono = [], stoppedWeek = [], backlogWithDates = [], doneLastWeek = [];
    items.forEach((it) => {
      const cv = it.column_values || {}, ph = cv.color_mkz09na || "?", sq = normalizeSquad(cv.color_mkz0s203 || "?"), pr = cv.person;
      const timeline = cv.timerange_mkzcqv0j, isThisWeek = overlapsThisWeek(timeline);

      // Todos los items del grupo Delivery — incluye Done, Detenidos, Sprint, etc.
      byPhase[ph] = (byPhase[ph] || 0) + 1;
      if (isThisWeek) byPhaseWeek[ph] = (byPhaseWeek[ph] || 0) + 1;
      if (!bySquad[sq]) bySquad[sq] = { total: 0, phases: {} };
      bySquad[sq].total++; bySquad[sq].phases[ph] = (bySquad[sq].phases[ph] || 0) + 1;
      if (isThisWeek && isActive(ph)) {
        if (!bySquadWeek[sq]) bySquadWeek[sq] = { total: 0, phases: {} };
        bySquadWeek[sq].total++; bySquadWeek[sq].phases[ph] = (bySquadWeek[sq].phases[ph] || 0) + 1;
      }

      if (isActive(ph) && pr) pr.split(", ").forEach((p) => { if (!byPerson[p]) byPerson[p] = { items: 0, subitems: 0, total: 0 }; byPerson[p].items++; byPerson[p].total++; });

      if (isActive(ph)) {
        const hasSubs = (it.subitems || []).length > 0;
        if (hasSubs) {
          (it.subitems || []).forEach((sub) => {
            const sp = sub.column_values?.person;
            const subPhase = sub.column_values?.color_mkzjvp66;
            const subTimeline = sub.column_values?.timerange_mkzx7r55;
            if (!sp || subPhase === "✅ Done") return;
            // Si subitem tiene cronograma propio, usar ese; si no, heredar del padre
            const subThisWeek = subTimeline ? overlapsThisWeek(subTimeline) : isThisWeek;
            if (!subThisWeek) return;
            sp.split(", ").forEach((p) => {
              const n = normalizePersonName(p); if (!isTeamMember(n)) return;
              if (!byPersonWeek[n]) byPersonWeek[n] = { items: 0, stopped: 0, total: 0 };
              if (subPhase === "🚫 Detenido") byPersonWeek[n].stopped++; else byPersonWeek[n].items++;
              byPersonWeek[n].total++;
            });
          });
        } else if (isThisWeek && pr) {
          // Item sin subitems — usar responsable del item padre
          pr.split(", ").forEach((p) => {
            const n = normalizePersonName(p); if (!isTeamMember(n)) return;
            if (!byPersonWeek[n]) byPersonWeek[n] = { items: 0, stopped: 0, total: 0 };
            byPersonWeek[n].items++; byPersonWeek[n].total++;
          });
        }
      }

      if (ph === "🚫 Detenido" && isThisWeek) stoppedWeek.push(it);
      if (ph === "⏳Backlog" && timeline) backlogWithDates.push(it);

      // Done sem. anterior: fase ✅ Done + Fecha Entrega Real dentro de PREV_WEEK
      // Todo vive en GROUP_DELIVERY — la fase Done se marca automáticamente al llenar Fecha Entrega Real
      if (ph === "✅ Done") {
        const fer = cv.date_mkzchmsq; // Fecha Entrega Real
        if (fer) {
          const deliveryDate = new Date(fer);
          if (deliveryDate >= PREV_WEEK.start && deliveryDate <= PREV_WEEK.end) {
            doneLastWeek.push(it);
          }
        }
      }

      if (isOverdue(it)) overdue.push(it);
      if (!pr && ph !== "✅ Done") noResp.push(it);
      if (ph === "🚧 Sprint" && !timeline) noCrono.push(it);
    });

    const activeThisWeek = items.filter((it) => isActive(it.column_values?.color_mkz09na) && overlapsThisWeek(it.column_values?.timerange_mkzcqv0j)).length;
    const velocity = { active: activeThisWeek, done: doneLastWeek.length, overdue: overdue.length };
    const semaphore = overdue.length > 10 || stoppedWeek.length > 5 ? "red" : overdue.length > 4 || stoppedWeek.length > 2 || noCrono.length > 5 ? "yellow" : "green";
    // doneTotal = total de items con fase Done en el grupo Delivery
    const doneTotal = byPhase["✅ Done"] || 0;

    PERSONAS.filter((p) => !p.sdr).forEach((p) => { if (!byPersonWeek[p.name]) byPersonWeek[p.name] = { items: 0, stopped: 0, total: 0 }; });

    return { byPhase, byPhaseWeek, bySquad, bySquadWeek, byPerson, byPersonWeek, overdue, noResp, noCrono, stoppedWeek, backlogWithDates, doneLastWeek, velocity, semaphore, doneTotal };
  }, [items]);

  if (loading) return (
    <div style={{ fontFamily: "var(--sans)", background: "var(--bg)", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--tx3)" }}>
      <style>{CSS}</style>
      <div style={{ fontSize: 32, marginBottom: 16, animation: "pulse 1.5s ease infinite" }}>⚡</div>
      <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.2em", textTransform: "uppercase" }}>{loadingMsg}</div>
    </div>
  );

  // FIX: Never return null on error — always show the dashboard
  const emptyAnalysis = { byPhase: {}, byPhaseWeek: {}, bySquad: {}, bySquadWeek: {}, byPerson: {}, byPersonWeek: {}, overdue: [], noResp: [], noCrono: [], stoppedWeek: [], backlogWithDates: [], doneLastWeek: [], velocity: { active: 0, done: 0, overdue: 0 }, semaphore: "yellow", doneTotal: 0 };
  const an = analysis || emptyAnalysis;

  const tabs = [
    { id: "home",        icon: "🏠", label: "Home",         color: "var(--blue)" },
    { id: "agenda",      icon: "⏱",  label: "Agenda",       color: "var(--purple)" },
    { id: "panorama",    icon: "📊", label: "Panorama",     color: "var(--cyan)" },
    { id: "focos",       icon: "🎯", label: "Focos",        color: "var(--yellow)" },
    { id: "compromisos", icon: "📝", label: "Compromisos",  color: "var(--green)" },
    { id: "minutas",     icon: "📋", label: "Minutas",      color: "var(--purple)" },
  ];

  return (
    <div className={presenterMode ? "presenter-mode" : ""} style={{ fontFamily: "var(--sans)", background: "var(--bg)", minHeight: "100vh", color: "var(--tx)" }}>
      <style>{CSS}</style>

      {(running || elapsed > 0) && !finished && (
        <TimerZone
          elapsed={elapsed} running={running}
          onStart={() => { startRef.current = Date.now(); elRef.current = elapsed; if (!blockStartRef.current) blockStartRef.current = Date.now(); setRunning(true); }}
          onPause={pauseTimer}
          onNext={() => advanceBlock("next")}
          onPrev={() => advanceBlock("prev")}
          onFinish={finishTimer}
          block={block} wd={wd} blockTimes={blockTimes} currentIdx={currentBlockIdx}
        />
      )}

      <div style={{ maxWidth: 920, margin: "0 auto", padding: "20px 20px 48px" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: "-0.04em", lineHeight: 1.2 }}>
              ⚡ Weekly <span style={{ color: "var(--tx3)", fontWeight: 500 }}>Mkt Corp</span>
            </h1>
            <div style={{ fontSize: 11, color: "var(--tx3)", marginTop: 6, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontFamily: "var(--mono)", fontSize: 10 }}>{items.length} items</span>
              {lastUpdate && <span style={{ fontSize: 10, opacity: 0.5 }}>· sync {new Date(lastUpdate).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}</span>}
              {err && <span style={{ fontSize: 10, color: "var(--yellow)" }}>· {err}</span>}
              <button onClick={refresh} disabled={refreshing} style={{ background: "var(--bg2)", color: refreshing ? "var(--yellow)" : "var(--tx3)", border: "1px solid var(--bg4)", borderRadius: "var(--r-sm)", padding: "3px 10px", fontSize: 10, fontWeight: 500, cursor: refreshing ? "default" : "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ display: "inline-block", animation: refreshing ? "spin 1s linear infinite" : "none" }}>↻</span>
                <span>{refreshing ? "Sincronizando..." : "Sync"}</span>
              </button>
              <button onClick={async () => {
                setErr("Verificando conexión...");
                try {
                  const resp = await fetch("/api/monday", { cache: "no-store" });
                  const data = await resp.json();
                  setErr(resp.ok ? `✅ Monday OK · ${data.total || 0} items` : `❌ Error: ${data.error || resp.status}`);
                } catch(e) {
                  setErr("Error: " + e.message);
                }
              }} title="Verificar conexión con Monday.com" style={{ background: "var(--bg2)", color: "var(--tx3)", border: "1px solid var(--bg4)", borderRadius: "var(--r-sm)", padding: "3px 10px", fontSize: 10, fontWeight: 500, cursor: "pointer" }}>🔍</button>

              <button onClick={() => {
                if (!document.fullscreenElement) {
                  document.documentElement.requestFullscreen().catch(() => {});
                  setPresenterMode(true);
                } else {
                  document.exitFullscreen().catch(() => {});
                  setPresenterMode(false);
                }
              }} style={{ background: presenterMode ? "var(--tx)" : "var(--bg2)", color: presenterMode ? "#fff" : "var(--tx3)", border: presenterMode ? "none" : "1px solid var(--bg4)", borderRadius: "var(--r-sm)", padding: "3px 10px", fontSize: 10, fontWeight: 500, cursor: "pointer" }} title="Pantalla completa">{presenterMode ? "📺 ON" : "📺"}</button>
            </div>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {[
              { l: "BKL", tooltip: "Backlog — importantes pero no urgentes, sin trabajo activo", v: an.byPhase["⏳Backlog"] || 0, c: "var(--tx3)", ph: "⏳Backlog", its: items.filter(it => it.column_values?.color_mkz09na === "⏳Backlog") },
              { l: "SPR", tooltip: "Sprint — en ejecución activa ahora mismo", v: an.byPhase["🚧 Sprint"] || 0, c: "var(--yellow)", ph: "🚧 Sprint", its: items.filter(it => it.column_values?.color_mkz09na === "🚧 Sprint") },
              { l: "REV", tooltip: "Review — en revisión o aprobación", v: an.byPhase["👀 Review"] || 0, c: "var(--cyan)", ph: "👀 Review", its: items.filter(it => it.column_values?.color_mkz09na === "👀 Review") },
              { l: "DET", tooltip: "Detenidos — bloqueados, requieren acción", v: an.byPhase["🚫 Detenido"] || 0, c: "var(--red)", ph: "🚫 Detenido", its: items.filter(it => it.column_values?.color_mkz09na === "🚫 Detenido") },
              { l: "VEN", tooltip: "Vencidos — cronograma expirado sin completar", v: (an.overdue || []).length, c: "var(--red)", ph: "⏰ Vencidos", its: an.overdue || [] },
            ].map((s) => (
              <div key={s.l} onClick={() => setPhaseModal({ phase: s.ph, items: s.its })} title={s.tooltip} style={{ background: "var(--bg)", border: "1px solid var(--bg4)", borderRadius: "var(--r-sm)", padding: "5px 8px", textAlign: "center", minWidth: 40, cursor: "pointer", transition: "all .15s" }}
                onMouseEnter={e => e.currentTarget.style.background = "var(--bg3)"}
                onMouseLeave={e => e.currentTarget.style.background = "var(--bg)"}>
                <div style={{ fontFamily: "var(--mono)", fontSize: 16, fontWeight: 700, color: s.c, letterSpacing: "-0.04em" }}>{s.v}</div>
                <div style={{ fontSize: 8, color: "var(--tx3)", fontWeight: 600, letterSpacing: "0.1em" }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Finished panel */}
        {finished && (
          <Card style={{ marginBottom: 16, borderLeft: "3px solid var(--green)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "var(--green)", fontFamily: "var(--mono)" }}>WEEKLY TERMINADA</div>
                <div style={{ fontSize: 12, color: "var(--tx3)", fontFamily: "var(--mono)", marginTop: 2 }}>{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")} min · {minutaSaved ? "✅ Guardada" : "⚠️ Sin guardar"}</div>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {!minutaSaved && <button onClick={async () => { await storeSet(STORE_KEY, { ...wd, minutaText: minutaDraft }); setMinutaSaved(true); }} style={{ background: "var(--bg2)", color: "var(--tx2)", border: "1px solid var(--bg4)", padding: "8px 18px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "var(--mono)", textTransform: "uppercase" }}>GUARDAR</button>}
                <button onClick={async () => { await storeSet(STORE_KEY, { ...wd, minutaText: minutaDraft }); setMinutaSaved(true); handleCopy(minutaDraft); }} style={{ background: "var(--tx)", color: "var(--bg)", border: "none", padding: "8px 24px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "var(--mono)", textTransform: "uppercase" }}>{minutaSaved ? "📤 COPIAR A SLACK" : "💾 GUARDAR + COPIAR"}</button>
                <button onClick={async () => { await storeSet(STORE_KEY, { ...wd, minutaText: minutaDraft }); setMinutaSaved(true); const ok = await sendToSlack(minutaDraft); if (ok) alert("✅ Enviado a Slack #general"); else { handleCopy(minutaDraft); alert("⚠️ No se pudo enviar. Copiado al portapapeles."); } }} style={{ background: "linear-gradient(135deg,#4A154B,#611f69)", color: "#fff", border: "none", padding: "8px 20px", borderRadius: "var(--r-sm)", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "var(--mono)", textTransform: "uppercase" }}>📨 ENVIAR A SLACK</button>
              </div>
            </div>
            <textarea value={minutaDraft} onChange={(e) => { setMinutaDraft(e.target.value); setMinutaSaved(false); }} style={{ width: "100%", minHeight: 280, background: "var(--bg2)", color: "var(--tx)", border: "1px solid var(--bg4)", padding: 16, fontSize: 12, fontFamily: "var(--mono)", resize: "vertical", outline: "none", lineHeight: 1.7 }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
              <button onClick={() => setMinutaDraft(generateMinuta(wd, an, appGddData, blockTimes))} style={{ background: "transparent", color: "var(--tx3)", border: "1px solid var(--bg4)", padding: "4px 12px", fontSize: 10, cursor: "pointer", fontFamily: "var(--mono)" }}>↻ Regenerar</button>
              <span style={{ fontSize: 10, color: "var(--tx3)", fontFamily: "var(--mono)" }}>{minutaDraft.length} chars</span>
            </div>
          </Card>
        )}

        {eMin >= 60 && !finished && (
          <div style={{ background: "rgba(255,69,58,.06)", border: "0.3px solid rgba(255,69,58,.2)", borderLeft: "2px solid var(--red)", padding: "10px 14px", marginBottom: 12, display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
            <span style={{ color: "var(--red)", fontWeight: 600 }}>Overtime</span>
            <span style={{ color: "var(--tx3)" }}>→ ⏹ para cerrar</span>
          </div>
        )}



        {/* Tabs sticky — always visible at top of content area */}
        <div className="sticky-nav" style={{ display: "flex", gap: 0, marginBottom: 0 }}>
          {tabs.map((t) => {
            const isAct = tab === t.id, isLive = running && block.tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)} aria-label={t.label} aria-current={isAct ? "page" : undefined} style={{ background: "transparent", color: isAct ? "var(--tx)" : "var(--tx3)", border: "none", borderBottom: isAct ? `2px solid ${t.color}` : "2px solid transparent", padding: "8px 16px", fontSize: 12, fontWeight: isAct ? 700 : 400, cursor: "pointer", fontFamily: "var(--sans)", marginBottom: -1, letterSpacing: "-0.01em", transition: "all .2s" }}>
                {isLive && <span aria-hidden="true" style={{ display: "inline-block", width: 5, height: 5, borderRadius: "50%", background: block.color, animation: "liveDot 1s ease infinite", marginRight: 5, verticalAlign: "middle" }} />}
                <span aria-hidden="true">{t.icon}</span> {t.label}
              </button>
            );
          })}
        </div>
        <div style={{ height: 20 }} />

        {tab === "home"        && <TabHome analysis={an} items={items} elapsed={elapsed} onStart={startTimer} onViewAlerts={() => { setTab("panorama"); try { sessionStorage.setItem("panorama-tab","alertas"); } catch {} }} />}
        {tab === "agenda"      && <TabAgenda wd={wd} setWd={setWd} save={saveFn} currentIdx={currentBlockIdx} blockTimes={blockTimes} onJumpToBlock={jumpToBlock} />}
        {tab === "panorama"    && <TabPanorama analysis={an} items={items} />}
        {tab === "focos"       && <TabFocos items={items} wd={wd} setWd={setWd} save={saveFn} activeSquad={activeSquad} setActiveSquad={setActiveSquad} />}
        {tab === "compromisos" && <TabCompromisos wd={wd} setWd={setWd} save={saveFn} analysis={an} onCopy={handleCopy} gddData={appGddData} />}
        {tab === "minutas" && <TabMinutasInline wd={wd} analysis={an} gddData={appGddData} blockTimes={blockTimes} onOpenMinuta={(key, data) => setMinutaLightbox({ key, data })} />}

        <div style={{ marginTop: 32, padding: "12px 0", borderTop: "1px solid var(--bg4)" }}>
          {confirmReset ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
              <span style={{ fontSize: 12, color: "var(--tx2)" }}>¿Limpiar focos, compromisos y presentadores?</span>
              <button onClick={async () => { await storeDel(STORE_KEY); setWd(emptyWeekly()); setFinished(false); setMinutaDraft(""); setMinutaSaved(false); setElapsed(0); setCurrentBlockIdx(0); setBlockTimes({}); blockStartRef.current = null; setConfirmReset(false); }} style={{ background: "var(--red)", color: "#fff", border: "none", borderRadius: 8, padding: "5px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Sí, limpiar</button>
              <button onClick={() => setConfirmReset(false)} style={{ background: "var(--bg3)", color: "var(--tx2)", border: "none", borderRadius: 8, padding: "5px 16px", fontSize: 12, cursor: "pointer" }}>Cancelar</button>
            </div>
          ) : (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 10, color: "var(--tx3)", opacity: 0.4, fontFamily: "var(--mono)" }}>v7.9 · mkt corp upax</span>
              <button onClick={() => setConfirmReset(true)} title="Limpiar focos, compromisos y presentadores de la sesión actual" style={{ background: "transparent", color: "var(--red)", border: "1px solid rgba(255,59,48,.2)", borderRadius: "var(--r-sm)", padding: "3px 10px", fontSize: 10, cursor: "pointer", opacity: 0.5 }}>🗑 Reset sesión</button>
            </div>
          )}
        </div>
      </div>

      {copyModal && <CopyModal text={copyModal} onClose={() => setCopyModal(null)} />}

      {phaseModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", backdropFilter: "blur(8px)", zIndex: 9998, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => setPhaseModal(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "var(--bg2)", borderRadius: "var(--r-lg)", boxShadow: "0 24px 60px rgba(0,0,0,.2)", width: "100%", maxWidth: 560, maxHeight: "80vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid var(--bg4)", flexShrink: 0 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{phaseModal.phase}</div>
                <div style={{ fontSize: 12, color: "var(--tx3)", marginTop: 2 }}>{phaseModal.items.length} items</div>
              </div>
              <button onClick={() => setPhaseModal(null)} style={{ background: "var(--bg3)", border: "none", width: 30, height: 30, borderRadius: 15, cursor: "pointer", color: "var(--tx3)", fontSize: 14 }}>✕</button>
            </div>
            <div style={{ overflowY: "auto", padding: "8px 16px 16px" }}>
              {phaseModal.items.length === 0
                ? <div style={{ textAlign: "center", padding: "24px 0", color: "var(--tx3)", fontSize: 13 }}>Sin items</div>
                : phaseModal.items.map((it, i) => {
                    const sq = SQUADS.find(s => s.name === normalizeSquad(it.column_values?.color_mkz0s203));
                    const tl = parseTL(it.column_values?.timerange_mkzcqv0j);
                    const od = isOverdue(it);
                    return (
                      <div key={it.id || i} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "10px 0", borderBottom: "1px solid var(--bg3)" }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: sq?.color || "var(--tx3)", flexShrink: 0, marginTop: 4 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, color: od ? "var(--red)" : "var(--tx)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</div>
                          <div style={{ display: "flex", gap: 8, marginTop: 3, fontSize: 11, color: "var(--tx3)", flexWrap: "wrap" }}>
                            {sq && <span style={{ color: sq.color, fontWeight: 600 }}>{sq.name.split(" ")[0]}</span>}
                            {it.column_values?.person && <span>👤 {shortName(it.column_values.person)}</span>}
                            {tl.end && <span style={{ color: od ? "var(--red)" : "var(--tx3)", fontWeight: od ? 700 : 400 }}>{od ? "⚠️ " : ""}📅 {tl.end.toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })
              }
            </div>
          </div>
        </div>
      )}

      {/* Minuta lightbox — renderizado en el root, fuera de cualquier scroll container */}
      {minutaLightbox && (
        <div
          style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,.6)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
          onClick={() => { setMinutaLightbox(null); document.body.style.overflow = ""; }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: "var(--bg2)", borderRadius: "var(--r-lg)", boxShadow: "0 40px 100px rgba(0,0,0,.4)", width: "100%", maxWidth: 700, height: "82vh", display: "flex", flexDirection: "column", overflow: "hidden" }}
          >
            <MinutaDetailView
              weekKey={minutaLightbox.key}
              data={minutaLightbox.data}
              todayWd={wd}
              todayAnalysis={an}
              gddData={appGddData}
              blockTimes={blockTimes}
              onBack={() => { setMinutaLightbox(null); document.body.style.overflow = ""; }}
              onClose={() => { setMinutaLightbox(null); document.body.style.overflow = ""; }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
