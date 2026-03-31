'use client'
// ─── CONSTANTS — config del equipo y del board ───────────────────────────────
// Editar aquí al cambiar miembros, squads, agenda o IDs de Monday
// TODO P4.3: migrar a Vercel KV para evitar redeploy al cambiar estructura

'use client'

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";

/* ═══════════════════════════════════════════════════════════════
   SECTION 1: CONSTANTS
   TODO: migrar BOARD_ID, GROUP_*, PERSONAS y SQUADS a Vercel KV
   para evitar redeploy al cambiar estructura del equipo
   ═══════════════════════════════════════════════════════════════ */

// ─── CONFIGURACIÓN DEL EQUIPO ──────────────────────────────────────────────────
// TODO P4.3: Separar en módulos cuando se estabilice:
//   lib/constants.js   → SQUADS, PERSONAS, AGENDA, MONDAY_USERS, PHASES
//   lib/analysis.js    → useMemo de análisis
//   lib/storage.js     → storeGet/storeSet/storeList
//   components/        → un archivo por Tab
// ────────────────────────────────────────────────────────────────────────────────
const BOARD_ID = 18044324200;
const GROUP_DELIVERY = "group_mm15cfz2"; // único grupo de trabajo
const GROUP_ACUERDOS = "group_mm1mhsd1"; // para crear compromisos de weekly
const SLACK_GENERAL_CHANNEL = "C081Z8R4ZH9";
const COL_IDS = ["person","color_mkz0s203","color_mkz09na","timerange_mkzcqv0j","date_mm1b10rx","date_mkzchmsq","color_mkzjvp66","timerange_mkzx7r55"];
// Fecha LOCAL del sistema — no usar toISOString() que devuelve UTC
// En México (UTC-6) la medianoche local = día anterior en UTC
const _now = new Date();
const TODAY_STR = `${_now.getFullYear()}-${String(_now.getMonth()+1).padStart(2,"0")}-${String(_now.getDate()).padStart(2,"0")}`;
const TODAY = new Date(TODAY_STR + "T12:00:00");
const STORE_KEY = `weekly:${TODAY_STR}`;
const CACHE_KEY = "monday-cache-v3"; // v3: pagination con filtro de grupo correcto

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
  // SDRs (Jennifer, Edna, Neyby, Leodegario, Aliosha) no tienen cuenta Monday — P4.9
  // Si se les crea cuenta, agregar sus IDs aquí para que los compromisos se asignen correctamente
};

/* ═══════════════════════════════════════════════════════════════
   SECTION 2: UTILITIES
   ═══════════════════════════════════════════════════════════════ */
