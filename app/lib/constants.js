'use client'
// lib/constants.js — config del equipo, board y agenda
// Solo contiene DATOS y CONSTANTES. Funciones utilitarias viven en utils.js.

export const BOARD_ID = 18044324200;
export const GROUP_DELIVERY = "group_mm15cfz2"; // único grupo de trabajo
export const GROUP_ACUERDOS = "group_mm1mhsd1"; // para crear compromisos de weekly
// SLACK_GENERAL_CHANNEL removido — se usa process.env.SLACK_CHANNEL en /api/slack (server-side only)
export const COL_IDS = ["person","color_mkz0s203","color_mkz09na","timerange_mkzcqv0j","date_mm1b10rx","date_mkzchmsq","color_mkzjvp66","timerange_mkzx7r55"];
// Fecha LOCAL del sistema — no usar toISOString() que devuelve UTC
// En México (UTC-6) la medianoche local = día anterior en UTC
const _now = new Date();
export const TODAY_STR = `${_now.getFullYear()}-${String(_now.getMonth()+1).padStart(2,"0")}-${String(_now.getDate()).padStart(2,"0")}`;
export const TODAY = new Date(TODAY_STR + "T12:00:00");
export const STORE_KEY = `weekly:${TODAY_STR}`;
export const CACHE_KEY = "monday-cache-v3"; // v3: pagination con filtro de grupo correcto

export const SQUADS = [
  { id: "inbound",     name: "Inbound Studio",          color: "#FF375F", lead: "Jean Pierre" },
  { id: "performance", name: "Performance y Conversión", color: "#30D158", lead: "Iris" },
  { id: "revops",      name: "RevOps & Analytics",       color: "#0A84FF", lead: "César" },
  { id: "portafolio",  name: "Portafolio y Ecosistema",  color: "#FF2D97", lead: "David" },
  { id: "outbound",    name: "Outbound y Pipeline",      color: "#FFD60A", lead: "Ileana" },
];

export const SQUAD_ALIASES = {
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

export const PHASES = {
  "⏳Backlog": "#475569", "🚧 Sprint": "#F59E0B", "👀 Review": "#06B6D4",
  "⚙️ Modificación": "#A855F7", "✅ Done": "#22C55E", "🚫 Detenido": "#EF4444",
};

export const AGENDA = [
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

export const PERSONAS = [
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

// MONDAY_USERS movido a lib/server-constants.js — IDs no deben estar en el bundle del frontend
// La API route /api/monday-write ahora resuelve personName → personId server-side

// normalizeSquad: única función que vive aquí porque depende directamente de SQUAD_ALIASES
export function normalizeSquad(raw) { return SQUAD_ALIASES[raw] || raw; }

export const WEEKLY_MAR23 = {
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

export const emptyWeekly = () => ({ date: TODAY_STR, presenters: {}, focos: {}, compromisos: [], synced: [] });
