'use client'

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  BOARD_ID, GROUP_DELIVERY, GROUP_ACUERDOS,
  COL_IDS, TODAY_STR, TODAY, STORE_KEY, CACHE_KEY,
  SQUADS, SQUAD_ALIASES, PHASES, AGENDA, PERSONAS,
  WEEKLY_MAR23, emptyWeekly,
} from "./lib/constants";
import {
  normalizeSquad, normalizePersonName, isTeamMember,
  parseTL, addDays, getMondayStr, daysDiff, isOverdue, isActive,
  getWeekBounds, WEEK, getPrevWeekBounds, PREV_WEEK,
  overlapsThisWeek, pctColor, shortName, getPersonDetail,
  PHASE_SHORT, PERSON_NAMES,
  downloadTextFile, copyToClipboard,
} from "./lib/utils";
import { storeGet, storeSet, storeDel, storeList, storeGetRaw, storeSetRaw } from "./lib/storage";
import { fetchAllItems, createMondayItem, sendToSlack } from "./lib/api";
import { generateMinuta } from "./lib/minuta";
import { CSS } from "./lib/css";
import { useGDDData } from "./hooks/useGDDData";
import {
  Bar, Card, Chip, Alerta, PersonSelect, CopyModal,
  PersonDetailView, NumInput, SquadInputSection,
} from "./components/ui";
import { TimerZone } from "./components/TimerZone";
import { TabHome } from "./components/TabHome";
import { TabAgenda } from "./components/TabAgenda";
import { TabPanorama } from "./components/TabPanorama";
import { TabFocos } from "./components/TabFocos";
import { TabCompromisos } from "./components/TabCompromisos";
import { TabMinutasInline, MinutaDetailView } from "./components/TabMinutas";

/* ═══════════════════════════════════════════════════════════════
   MAIN APP — Orquestador principal
   ═══════════════════════════════════════════════════════════════ */

export default function App() {
  const [items, setItems] = useState([]);
  const [itemsFingerprint, setItemsFingerprint] = useState(0);
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
  const [slackStatus, setSlackStatus] = useState(null);
  const [activeSquad, setActiveSquad] = useState(SQUADS[0].id);
  const [currentBlockIdx, setCurrentBlockIdx] = useState(0);
  const [blockTimes, setBlockTimes] = useState({});
  const blockStartRef = useRef(null);
  const [presenterMode, setPresenterMode] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const [minutaLightbox, setMinutaLightbox] = useState(null);
  const [copyModal, setCopyModal] = useState(null);
  const [phaseModal, setPhaseModal] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const intRef = useRef(null), startRef = useRef(null), elRef = useRef(0);

  // Hook unificado para datos GDD (Sheets + HubSpot + historial)
  const { gddData: hookGddData, mqlBreakdown, history: gddHistory, setHistory: setGddHistory, loading: gddLoading, refetch: refetchGdd } = useGDDData();
  // appGddData: datos GDD para minuta y compromisos
  const [appGddData, setAppGddData] = useState(null);
  useEffect(() => {
    if (hookGddData) setAppGddData(hookGddData);
  }, [hookGddData]);

  const saveFn = useCallback(async (d) => { await storeSet(STORE_KEY, d); }, []);

  // Auto-save debounce 3s
  const autoSaveRef = useRef(null);
  useEffect(() => {
    if (!wd || !wd.date) return;
    clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(() => {
      storeSet(STORE_KEY, wd).catch(() => {});
    }, 3000);
    return () => clearTimeout(autoSaveRef.current);
  }, [wd]);

  const block = AGENDA[currentBlockIdx] || AGENDA[AGENDA.length - 1];

  const advanceBlock = useCallback((direction) => {
    setCurrentBlockIdx((prev) => {
      const next = direction === "next" ? Math.min(prev + 1, AGENDA.length - 1) : Math.max(prev - 1, 0);
      if (next === prev) return prev;
      if (blockStartRef.current) {
        const spent = Math.round((Date.now() - blockStartRef.current) / 1000);
        setBlockTimes((bt) => ({ ...bt, [AGENDA[prev].id]: (bt[AGENDA[prev].id] || 0) + spent }));
      }
      blockStartRef.current = Date.now();
      const nextBlock = AGENDA[next];
      setTab(nextBlock.tab);
      if (nextBlock.sq && nextBlock.sq !== "cross") setActiveSquad(nextBlock.sq);
      return next;
    });
  }, []);

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
    if (elapsed === 0) { setTab("panorama"); setCurrentBlockIdx(1); }
  }, [elapsed]);

  const pauseTimer = useCallback(() => {
    setRunning(false);
    clearInterval(intRef.current);
    if (blockStartRef.current) {
      const spent = Math.round((Date.now() - blockStartRef.current) / 1000);
      setBlockTimes((bt) => ({ ...bt, [block.id]: (bt[block.id] || 0) + spent }));
      blockStartRef.current = null;
    }
  }, [block]);

  const finishTimer = useCallback(() => {
    setRunning(false);
    clearInterval(intRef.current);
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
      intRef.current = setInterval(() => {
        const newElapsed = elRef.current + Math.floor((Date.now() - startRef.current) / 1000);
        setElapsed(newElapsed);
      }, 1000);
    }
    return () => clearInterval(intRef.current);
  }, [running]);

  useEffect(() => {
    if (!running) return;
    const as = setInterval(() => storeSet(STORE_KEY, wd), 60000);
    return () => clearInterval(as);
  }, [running, wd]);

  const eMin = elapsed / 60;

  const handleCopy = useCallback((text) => {
    const result = copyToClipboard(text);
    // copyToClipboard now returns a promise
    if (result && typeof result.then === 'function') {
      result.then(ok => { if (!ok) setCopyModal(text); });
    } else if (!result) {
      setCopyModal(text);
    }
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setErr(null);
    try {
      const fresh = await fetchAllItems();
      if (fresh.length > 0) {
        setItems(fresh);
        const fp = fresh.length * 1000 + parseInt(fresh[0]?.id || 0) + parseInt(fresh[fresh.length-1]?.id || 0);
        setItemsFingerprint(fp);
        await storeSet(CACHE_KEY, { items: fresh, ts: new Date().toISOString(), doneCount: fresh._doneCount || 0 });
        setLastUpdate(new Date().toISOString());
      }
    } catch {}
    setRefreshing(false);
  }, []);

  // Load — cache first, then Monday
  useEffect(() => {
    (async () => {
      let hasCached = false;
      try {
        setLoadingMsg("Buscando cache...");
        const [cached, stored] = await Promise.all([storeGet(CACHE_KEY), storeGet(STORE_KEY)]);
        setWd(stored || WEEKLY_MAR23);
        if (cached?.items?.length > 0) {
          setItems(cached.items);
          const fp0 = cached.items.length * 1000 + parseInt(cached.items[0]?.id || 0) + parseInt(cached.items[cached.items.length-1]?.id || 0);
          setItemsFingerprint(fp0);
          setLastUpdate(cached.ts);
          setLoading(false);
          hasCached = true;
          if (Date.now() - new Date(cached.ts).getTime() > 30 * 60 * 1000) refresh();
        }
      } catch { setWd(WEEKLY_MAR23); }

      if (hasCached) return;

      const safetyTimer = setTimeout(() => {
        setErr("Tiempo de espera agotado -- Monday no respondio. Trabaja en modo sin conexion o presiona Sync.");
        setLoading(false);
      }, 65000);

      try {
        setLoadingMsg("Conectando con Monday.com...");
        const all = await fetchAllItems();
        clearTimeout(safetyTimer);
        if (all.length > 0) {
          setItems(all);
          const fp1 = all.length * 1000 + parseInt(all[0]?.id || 0) + parseInt(all[all.length-1]?.id || 0);
          setItemsFingerprint(fp1);
          await storeSet(CACHE_KEY, { items: all, ts: new Date().toISOString(), doneCount: all._doneCount || 0 });
          setLastUpdate(new Date().toISOString());
        } else {
          setErr((all._error || "Sin datos") + " -- Trabaja en modo sin conexion.");
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
    const byPhase = {}, byPhaseWeek = {}, bySquad = {}, bySquadWeek = {}, byPerson = {}, byPersonWeek = {}, overdue = [], noResp = [], noCrono = [], stoppedWeek = [], backlogWithDates = [], doneLastWeek = [], doneThisWeek = [], overdueThisWeekArr = [], overdueLastWeekArr = [], stoppedLastWeekArr = [];
    const _tlCache = new Map();
    const parseTLCached = (t) => {
      if (!t) return { start: null, end: null };
      if (_tlCache.has(t)) return _tlCache.get(t);
      const result = parseTL(t);
      _tlCache.set(t, result);
      return result;
    };

    const WEEK_START_STR = getMondayStr(TODAY_STR);
    const WEEK_END_STR = addDays(WEEK_START_STR, 4);

    items.forEach((it) => {
      const cv = it.column_values || {}, ph = cv.color_mkz09na || "?", sq = normalizeSquad(cv.color_mkz0s203 || "?"), pr = cv.person;
      const timeline = cv.timerange_mkzcqv0j, isThisWeek = overlapsThisWeek(timeline);
      if (timeline) parseTLCached(timeline);

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
        const deadlineItem = it.column_values?.date_mm1b10rx;
        const projectThisWeek = deadlineItem ? (deadlineItem >= WEEK_START_STR && deadlineItem <= WEEK_END_STR) : false;

        if (projectThisWeek && pr) {
          pr.split(", ").forEach((p) => {
            const n = normalizePersonName(p);
            if (!isTeamMember(n)) return;
            if (!byPersonWeek[n]) byPersonWeek[n] = { projects: 0, tasks: 0, stopped: 0, total: 0 };
            byPersonWeek[n].projects++;
            byPersonWeek[n].total++;
          });
        }

        (it.subitems || []).forEach((sub) => {
          const sp = sub.column_values?.person;
          const subPhase = sub.column_values?.color_mkzjvp66;
          const subDeadline = sub.column_values?.date_mm1hnswx;
          if (!sp) return;
          if (!["🚧 Sprint", "👀 Review", "⚙️ Modificación"].includes(subPhase)) return;
          if (!subDeadline || subDeadline < WEEK_START_STR || subDeadline > WEEK_END_STR) return;
          sp.split(", ").forEach((p) => {
            const n = normalizePersonName(p);
            if (!isTeamMember(n)) return;
            if (!byPersonWeek[n]) byPersonWeek[n] = { projects: 0, tasks: 0, stopped: 0, total: 0 };
            byPersonWeek[n].tasks++;
            byPersonWeek[n].total++;
          });
        });
      }

      if (ph === "🚫 Detenido") {
        if (isThisWeek) stoppedWeek.push(it);
        const tlDet = parseTLCached(timeline);
        if (tlDet.start && tlDet.end && tlDet.start <= PREV_WEEK.end && tlDet.end >= PREV_WEEK.start) stoppedLastWeekArr.push(it);
      }
      if (ph === "⏳Backlog" && timeline) backlogWithDates.push(it);

      if (ph === "✅ Done") {
        const fer = cv.date_mkzchmsq;
        if (fer) {
          const deliveryDate = new Date(fer);
          if (deliveryDate >= PREV_WEEK.start && deliveryDate <= PREV_WEEK.end) doneLastWeek.push(it);
          if (deliveryDate >= WEEK.start && deliveryDate <= WEEK.end) doneThisWeek.push(it);
        }
      }

      if (isOverdue(it)) {
        overdue.push(it);
        const tlEnd = parseTLCached(timeline).end;
        if (tlEnd) {
          if (tlEnd >= PREV_WEEK.start && tlEnd <= PREV_WEEK.end) overdueLastWeekArr.push(it);
          else if (tlEnd >= WEEK.start && tlEnd <= WEEK.end) overdueThisWeekArr.push(it);
        }
      }
      if (!pr && ph !== "✅ Done") noResp.push(it);
      if (ph === "🚧 Sprint" && !timeline) noCrono.push(it);
    });

    const activeThisWeek = items.filter((it) => isActive(it.column_values?.color_mkz09na) && overlapsThisWeek(it.column_values?.timerange_mkzcqv0j)).length;
    const velocity = { active: activeThisWeek, done: doneLastWeek.length, overdue: overdue.length };
    const semaphore = overdue.length > 10 || stoppedWeek.length > 5 ? "red" : overdue.length > 4 || stoppedWeek.length > 2 || noCrono.length > 5 ? "yellow" : "green";
    const doneTotal = byPhase["✅ Done"] || 0;

    PERSONAS.filter((p) => !p.sdr).forEach((p) => { if (!byPersonWeek[p.name]) byPersonWeek[p.name] = { items: 0, stopped: 0, total: 0 }; });

    return { byPhase, byPhaseWeek, bySquad, bySquadWeek, byPerson, byPersonWeek, overdue, noResp, noCrono, stoppedWeek, backlogWithDates, doneLastWeek, doneThisWeek, overdueThisWeek: overdueThisWeekArr, overdueLastWeek: overdueLastWeekArr, stoppedLastWeek: stoppedLastWeekArr, velocity, semaphore, doneTotal };
  }, [items, itemsFingerprint]);

  // ── Audit Log helper ──────────────────────────────────────────
  const AUDIT_LOG_KEY = "audit_log";
  const logAudit = useCallback(async (tipo, descripcion, datos = {}, origen = "usuario") => {
    try {
      const current = await storeGet(AUDIT_LOG_KEY);
      const log = Array.isArray(current) ? current : [];
      const entry = { id: Date.now().toString() + Math.random().toString(36).slice(2, 6), ts: new Date().toISOString(), tipo, descripcion, datos, origen };
      await storeSet(AUDIT_LOG_KEY, [entry, ...log].slice(0, 500));
    } catch (e) { console.warn("Audit log failed:", e?.message); }
  }, []);

  // ── Loading screen ──────────────────────────────────────────
  if (loading) return (
    <div style={{ fontFamily: "var(--sans)", background: "var(--bg)", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--tx3)" }}>
      <style>{CSS}</style>
      <div style={{ fontSize: 32, marginBottom: 16, animation: "pulse 1.5s ease infinite" }}>⚡</div>
      <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.2em", textTransform: "uppercase" }}>{loadingMsg}</div>
    </div>
  );

  const emptyAnalysis = { byPhase: {}, byPhaseWeek: {}, bySquad: {}, bySquadWeek: {}, byPerson: {}, byPersonWeek: {}, overdue: [], noResp: [], noCrono: [], stoppedWeek: [], backlogWithDates: [], doneLastWeek: [], doneThisWeek: [], overdueThisWeek: [], overdueLastWeek: [], stoppedLastWeek: [], velocity: { active: 0, done: 0, overdue: 0 }, semaphore: "yellow", doneTotal: 0 };
  const an = analysis || emptyAnalysis;

  const _authHeaders = () => ({
    'Content-Type': 'application/json',
    ...(process.env.NEXT_PUBLIC_API_SECRET ? { 'Authorization': `Bearer ${process.env.NEXT_PUBLIC_API_SECRET}` } : {}),
  });

  const tabs = [
    { id: "home",        icon: "🏠", label: "Home",         color: "var(--blue)" },
    { id: "agenda",      icon: "⏱",  label: "Agenda",       color: "var(--purple)" },
    { id: "panorama",    icon: "📊", label: "Panorama",     color: "var(--cyan)" },
    { id: "focos",       icon: "🎯", label: "Focos",        color: "var(--yellow)" },
    { id: "compromisos", icon: "📝", label: "Compromisos",  color: "var(--green)" },
    { id: "minutas",     icon: "📋", label: "Minutas",      color: "var(--purple)" },
  ];

  return (
    <div suppressHydrationWarning className={presenterMode ? "presenter-mode" : ""} style={{ fontFamily: "var(--sans)", background: "var(--bg)", minHeight: "100vh", color: "var(--tx)" }}>
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
              {lastUpdate && <span style={{ fontSize: 11, color: "var(--tx3)" }}>· sync {new Date(lastUpdate).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}</span>}
              {err && <span style={{ fontSize: 10, color: "var(--yellow)" }}>· {err}</span>}
              <button onClick={refresh} disabled={refreshing} style={{ background: "var(--bg2)", color: refreshing ? "var(--yellow)" : "var(--tx3)", border: "1px solid var(--bg4)", borderRadius: "var(--r-sm)", padding: "3px 10px", fontSize: 10, fontWeight: 500, cursor: refreshing ? "default" : "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ display: "inline-block", animation: refreshing ? "spin 1s linear infinite" : "none" }}>↻</span>
                <span>{refreshing ? "Sincronizando..." : "Sync"}</span>
              </button>
              <button onClick={async () => {
                setErr("Verificando conexion...");
                try {
                  const resp = await fetch("/api/monday", { cache: "no-store" });
                  const data = await resp.json();
                  setErr(resp.ok ? `Monday OK -- ${data.total || 0} items` : `Error: ${data.error || resp.status}`);
                } catch(e) { setErr("Error: " + e.message); }
              }} title="Verificar conexion con Monday.com" style={{ background: "var(--bg2)", color: "var(--tx3)", border: "1px solid var(--bg4)", borderRadius: "var(--r-sm)", padding: "3px 10px", fontSize: 10, fontWeight: 500, cursor: "pointer" }}>🔍</button>
              <button onClick={() => {
                if (!document.fullscreenElement) { document.documentElement.requestFullscreen().catch(() => {}); setPresenterMode(true); }
                else { document.exitFullscreen().catch(() => {}); setPresenterMode(false); }
              }} style={{ background: presenterMode ? "var(--tx)" : "var(--bg2)", color: presenterMode ? "#fff" : "var(--tx3)", border: presenterMode ? "none" : "1px solid var(--bg4)", borderRadius: "var(--r-sm)", padding: "3px 10px", fontSize: 10, fontWeight: 500, cursor: "pointer" }} title="Pantalla completa">{presenterMode ? "📺 ON" : "📺"}</button>
            </div>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {[
              { l: "BKL", tooltip: "Backlog", v: an.byPhase["⏳Backlog"] || 0, c: "var(--tx3)", bg: "transparent", border: "var(--bg4)", ph: "⏳Backlog", its: items.filter(it => it.column_values?.color_mkz09na === "⏳Backlog") },
              { l: "SPR", tooltip: "Sprint", v: an.byPhase["🚧 Sprint"] || 0, c: "var(--yellow)", bg: "rgba(245,158,11,.06)", border: "rgba(245,158,11,.25)", ph: "🚧 Sprint", its: items.filter(it => it.column_values?.color_mkz09na === "🚧 Sprint") },
              { l: "REV", tooltip: "Review", v: an.byPhase["👀 Review"] || 0, c: "var(--cyan)", bg: "rgba(90,200,250,.06)", border: "rgba(90,200,250,.25)", ph: "👀 Review", its: items.filter(it => it.column_values?.color_mkz09na === "👀 Review") },
              { l: "DET", tooltip: "Detenidos", v: an.byPhase["🚫 Detenido"] || 0, c: "var(--orange)", bg: "rgba(255,149,0,.08)", border: "rgba(255,149,0,.3)", ph: "🚫 Detenido", its: items.filter(it => it.column_values?.color_mkz09na === "🚫 Detenido") },
              { l: "VEN", tooltip: "Vencidos", v: (an.overdue || []).length, c: "var(--red)", bg: "rgba(255,59,48,.08)", border: "rgba(255,59,48,.3)", ph: "⏰ Vencidos", its: an.overdue || [] },
            ].map((s) => (
              <div key={s.l} onClick={() => setPhaseModal({ phase: s.ph, items: s.its })} title={s.tooltip} style={{ background: s.bg || "var(--bg)", border: `1px solid ${s.border || "var(--bg4)"}`, borderRadius: "var(--r-sm)", padding: "5px 8px", textAlign: "center", minWidth: 40, cursor: "pointer", transition: "all .15s" }}
                onMouseEnter={e => e.currentTarget.style.background = "var(--bg3)"}
                onMouseLeave={e => e.currentTarget.style.background = s.bg || "var(--bg)"}>
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
                <div style={{ fontSize: 12, color: "var(--tx3)", fontFamily: "var(--mono)", marginTop: 2 }}>{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")} min · {minutaSaved ? "Guardada" : "Sin guardar"}</div>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {!minutaSaved && <button onClick={async () => { await storeSet(STORE_KEY, { ...wd, minutaText: minutaDraft }); setMinutaSaved(true); }} style={{ background: "var(--bg2)", color: "var(--tx2)", border: "1px solid var(--bg4)", padding: "8px 18px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "var(--mono)", textTransform: "uppercase" }}>GUARDAR</button>}
                <button onClick={async () => { await storeSet(STORE_KEY, { ...wd, minutaText: minutaDraft }); setMinutaSaved(true); handleCopy(minutaDraft); }} style={{ background: "var(--tx)", color: "var(--bg)", border: "none", padding: "8px 24px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "var(--mono)", textTransform: "uppercase" }}>{minutaSaved ? "COPIAR A SLACK" : "GUARDAR + COPIAR"}</button>
                <button onClick={async () => { await storeSet(STORE_KEY, { ...wd, minutaText: minutaDraft }); setMinutaSaved(true); setSlackStatus("sending"); const ok = await sendToSlack(minutaDraft); setSlackStatus(ok ? "ok" : "error"); if (!ok) handleCopy(minutaDraft); setTimeout(() => setSlackStatus(null), 4000); }} style={{ background: "linear-gradient(135deg,#4A154B,#611f69)", color: "#fff", border: "none", padding: "8px 20px", borderRadius: "var(--r-sm)", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "var(--mono)", textTransform: "uppercase" }}>ENVIAR A SLACK</button>
              </div>
            </div>
            <textarea value={minutaDraft} onChange={(e) => { setMinutaDraft(e.target.value); setMinutaSaved(false); }} style={{ width: "100%", minHeight: 280, background: "var(--bg2)", color: "var(--tx)", border: "1px solid var(--bg4)", padding: 16, fontSize: 12, fontFamily: "var(--mono)", resize: "vertical", outline: "none", lineHeight: 1.7 }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
              <button onClick={() => setMinutaDraft(generateMinuta(wd, an, appGddData, blockTimes))} style={{ background: "transparent", color: "var(--tx3)", border: "1px solid var(--bg4)", padding: "4px 12px", fontSize: 10, cursor: "pointer", fontFamily: "var(--mono)" }}>Regenerar</button>
              <span style={{ fontSize: 10, color: "var(--tx3)", fontFamily: "var(--mono)" }}>{minutaDraft.length} chars</span>
              {slackStatus && (
                <span style={{ fontSize: 11, fontWeight: 600, fontFamily: "var(--mono)", color: slackStatus === "ok" ? "var(--green)" : slackStatus === "error" ? "var(--red)" : "var(--yellow)" }}>
                  {slackStatus === "sending" ? "Enviando a Slack..." : slackStatus === "ok" ? "Enviado a #general" : "Sin token Slack -- copiado al portapapeles"}
                </span>
              )}
            </div>
          </Card>
        )}

        {eMin >= 60 && !finished && (
          <div style={{ background: "rgba(255,69,58,.06)", border: "0.3px solid rgba(255,69,58,.2)", borderLeft: "2px solid var(--red)", padding: "10px 14px", marginBottom: 12, display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
            <span style={{ color: "var(--red)", fontWeight: 600 }}>Overtime</span>
            <span style={{ color: "var(--tx3)" }}>→ ⏹ para cerrar</span>
          </div>
        )}

        {/* Tabs sticky */}
        <div className="sticky-nav" style={{ display: "flex", gap: 0, marginBottom: 0, overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          {tabs.map((t) => {
            const isAct = tab === t.id, isLive = running && block.tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)} aria-label={t.label} aria-current={isAct ? "page" : undefined} style={{ background: "transparent", color: isAct ? "var(--tx)" : "var(--tx3)", border: "none", borderBottom: isAct ? `2px solid ${t.color}` : "2px solid transparent", padding: "8px 12px", fontSize: 12, fontWeight: isAct ? 700 : 400, cursor: "pointer", fontFamily: "var(--sans)", marginBottom: -1, letterSpacing: "-0.01em", transition: "all .2s", flexShrink: 0, whiteSpace: "nowrap" }}>
                {isLive && <span aria-hidden="true" style={{ display: "inline-block", width: 5, height: 5, borderRadius: "50%", background: block.color, animation: "liveDot 1s ease infinite", marginRight: 5, verticalAlign: "middle" }} />}
                <span aria-hidden="true">{t.icon}</span> {t.label}
              </button>
            );
          })}
        </div>
        <div style={{ height: 20 }} />

        {tab === "home"        && <TabHome analysis={an} items={items} elapsed={elapsed} onStart={startTimer} onViewAlerts={() => { setTab("panorama"); try { sessionStorage.setItem("panorama-tab","alertas"); } catch {} }} gddData={appGddData} setGddData={setAppGddData} mqlBreakdown={mqlBreakdown} gddHistory={gddHistory} setGddHistory={setGddHistory} gddLoading={gddLoading} />}
        {tab === "agenda"      && <TabAgenda wd={wd} setWd={setWd} save={saveFn} currentIdx={currentBlockIdx} blockTimes={blockTimes} onJumpToBlock={jumpToBlock} />}
        {tab === "panorama"    && <TabPanorama analysis={an} items={items} />}
        {tab === "focos"       && <TabFocos items={items} wd={wd} setWd={setWd} save={saveFn} activeSquad={activeSquad} setActiveSquad={setActiveSquad} />}
        {tab === "compromisos" && <TabCompromisos wd={wd} setWd={setWd} save={saveFn} analysis={an} onCopy={handleCopy} gddData={appGddData} />}
        {tab === "minutas"     && <TabMinutasInline wd={wd} analysis={an} gddData={appGddData} blockTimes={blockTimes} onOpenMinuta={(key, data) => setMinutaLightbox({ key, data })} />}

        {/* Footer */}
        <div style={{ marginTop: 32, padding: "12px 0", borderTop: "1px solid var(--bg4)" }}>
          {confirmReset ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--tx)" }}>Resetear sesion de hoy?</div>
                <div style={{ fontSize: 11, color: "var(--tx3)", marginTop: 2 }}>Borra focos, compromisos y presentadores. Las minutas historicas NO se eliminan.</div>
              </div>
              <button onClick={async () => {
                await logAudit("session_reset", "Reset de sesion: " + TODAY_STR, { date: TODAY_STR, focos_areas: Object.keys(wd.focos || {}), compromisos_count: (wd.compromisos || []).length });
                await storeSet(STORE_KEY + ":before_reset", wd);
                await storeDel(STORE_KEY);
                setWd(emptyWeekly()); setFinished(false); setMinutaDraft(""); setMinutaSaved(false);
                setElapsed(0); elRef.current = 0; setCurrentBlockIdx(0); setBlockTimes({});
                blockStartRef.current = null; setSlackStatus(null); setConfirmReset(false);
              }} style={{ background: "var(--red)", color: "#fff", border: "none", borderRadius: 8, padding: "5px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>Si, resetear</button>
              <button onClick={() => setConfirmReset(false)} style={{ background: "var(--bg3)", color: "var(--tx2)", border: "none", borderRadius: 8, padding: "5px 16px", fontSize: 12, cursor: "pointer" }}>Cancelar</button>
            </div>
          ) : (
            <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 11, color: "var(--tx2)", opacity: 0.5, fontFamily: "var(--mono)" }}>v9.0 · mkt corp upax</span>
              <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                <button onClick={() => setAuditOpen(!auditOpen)} style={{ background:"transparent", color:"var(--tx3)", border:"1px solid rgba(0,0,0,.1)", borderRadius:"var(--r-sm)", padding:"3px 10px", fontSize:10, cursor:"pointer", opacity:0.5 }}>Audit</button>
                <button onClick={() => setConfirmReset(true)} title="Limpiar focos, compromisos y presentadores de la sesion actual" style={{ background: "transparent", color: "var(--red)", border: "1px solid rgba(255,59,48,.2)", borderRadius: "var(--r-sm)", padding: "3px 10px", fontSize: 10, cursor: "pointer", opacity: 0.5 }}>Reset sesion</button>
              </div>
            </div>
            {auditOpen && <AuditLogPanel />}
            </>
          )}
        </div>
      </div>

      {copyModal && <CopyModal text={copyModal} onClose={() => setCopyModal(null)} />}

      {phaseModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", zIndex: 9998, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => setPhaseModal(null)}>
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
                            {it.column_values?.person && <span>{shortName(it.column_values.person)}</span>}
                            {tl.end && <span style={{ color: od ? "var(--red)" : "var(--tx3)", fontWeight: od ? 700 : 400 }}>{tl.end.toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}</span>}
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

      {/* Minuta lightbox */}
      {minutaLightbox && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,.6)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
          onClick={() => { setMinutaLightbox(null); document.body.style.overflow = ""; }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "var(--bg2)", borderRadius: "var(--r-lg)", boxShadow: "0 40px 100px rgba(0,0,0,.4)", width: "100%", maxWidth: 700, height: "82vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <MinutaDetailView
              weekKey={minutaLightbox.key} data={minutaLightbox.data}
              todayWd={wd} todayAnalysis={an} gddData={appGddData} blockTimes={blockTimes}
              onBack={() => { setMinutaLightbox(null); document.body.style.overflow = ""; }}
              onClose={() => { setMinutaLightbox(null); document.body.style.overflow = ""; }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   AuditLogPanel — inline en page.js porque es ligero y solo se
   usa en el footer del App principal
   ═══════════════════════════════════════════════════════════════ */
const AUDIT_TYPE_COLORS = { session_reset: "var(--red)", minuta_delete: "#FF9500", gdd_edit: "var(--blue)", gdd_manual_save: "var(--green)", gdd_auto_save: "var(--green)", monday_sync: "var(--purple)", session_save: "var(--green)" };
const AUDIT_TYPE_ICONS = { session_reset: "🗑", minuta_delete: "🗑", gdd_edit: "✏️", gdd_manual_save: "💾", gdd_auto_save: "🤖", monday_sync: "🔄", session_save: "💾" };

const AuditLogPanel = React.memo(function AuditLogPanel() {
  const [log, setLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    storeGet("audit_log").then((l) => { setLog(Array.isArray(l) ? l : []); setLoading(false); });
  }, []);

  const types = [...new Set(log.map((e) => e.tipo))].sort();
  const filtered = filter === "all" ? log : log.filter((e) => e.tipo === filter);
  const todayCount = log.filter((e) => e.ts?.startsWith(TODAY_STR)).length;
  const fmtTs = (ts) => { if (!ts) return "—"; try { const d = new Date(ts); return d.toLocaleDateString("es-MX", { day:"numeric", month:"short" }) + " " + d.toLocaleTimeString("es-MX", { hour:"2-digit", minute:"2-digit" }); } catch { return ts; } };

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom: 10, flexWrap:"wrap", gap:6 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ fontSize:13, fontWeight:700, color:"var(--tx2)" }}>Audit Log</span>
          {todayCount > 0 && <span style={{ fontSize:10, fontWeight:700, background:"var(--blue)", color:"#fff", borderRadius:10, padding:"1px 7px" }}>{todayCount} hoy</span>}
          <span style={{ fontSize:11, color:"var(--tx3)" }}>{log.length} total</span>
        </div>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ background:"var(--bg2)", border:"1px solid var(--bg4)", borderRadius:"var(--r-sm)", padding:"3px 8px", fontSize:11, color:"var(--tx2)", outline:"none", cursor:"pointer" }}>
          <option value="all">Todos los tipos</option>
          {types.map((t) => <option key={t} value={t}>{AUDIT_TYPE_ICONS[t] || "•"} {t}</option>)}
        </select>
      </div>
      {loading ? (
        <div style={{ textAlign:"center", padding:"10px 0", color:"var(--tx3)", fontSize:12 }}>Cargando...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign:"center", padding:"14px 0", color:"var(--tx3)", fontSize:12, border:"2px dashed var(--bg4)", borderRadius:"var(--r-sm)" }}>Sin eventos registrados aun.</div>
      ) : (
        <div style={{ maxHeight:300, overflowY:"auto" }}>
          {filtered.slice(0, 100).map((entry) => {
            const col = AUDIT_TYPE_COLORS[entry.tipo] || "var(--tx3)";
            const icon = AUDIT_TYPE_ICONS[entry.tipo] || "•";
            return (
              <div key={entry.id} style={{ display:"flex", gap:8, alignItems:"flex-start", padding:"6px 0", borderBottom:"1px solid var(--bg3)" }}>
                <span style={{ fontSize:14, flexShrink:0, marginTop:1 }}>{icon}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12, color:"var(--tx)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{entry.descripcion || entry.tipo}</div>
                  <div style={{ display:"flex", gap:6, marginTop:2, flexWrap:"wrap" }}>
                    <span style={{ fontSize:10, fontWeight:700, color:col, background:col+"18", borderRadius:4, padding:"1px 5px" }}>{entry.tipo}</span>
                    <span style={{ fontSize:10, color:"var(--tx3)", fontFamily:"var(--mono)" }}>{fmtTs(entry.ts)}</span>
                    {entry.origen && entry.origen !== "usuario" && <span style={{ fontSize:10, color:"var(--tx3)" }}>· {entry.origen}</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});
