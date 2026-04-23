'use client'
import React, { useState, useEffect } from 'react'
import { TODAY_STR } from '../lib/constants'
import { storeGet } from '../lib/storage'

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

export { AuditLogPanel }
