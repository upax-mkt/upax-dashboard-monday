# Weekly Cockpit — Spec de Diseno

**Fecha**: 2026-05-05
**Proyecto**: upax-dashboard-monday
**Enfoque**: B — Reestructura de Home como cockpit de weekly

---

## 1. Resumen

Reestructurar el tab Home de upax-dashboard-monday en 3 zonas claras orientadas a la reunion semanal (weekly) del equipo de Marketing Corporativo de UPAX. Mejorar la minuta generada automaticamente con datos comparativos de GdD, MQLs por canal, y roadmap. Mover alertas ejecutivas exclusivamente a Panorama.

### Cambios principales

1. **Home = 3 zonas**: Control de Weekly + GdD comparativo + Roadmap Timeline
2. **Minuta mejorada**: GdD semana anterior + actual, MQLs por canal completa, roadmap texto
3. **Alertas fuera de Home**: Eliminar OverdueSection, alertas viven solo en Panorama > Alertas
4. **Roadmap Timeline**: Componente visual horizontal agrupado por squad
5. **Fuente unica de datos GdD**: Todo pasa por useGDDData hook, mismas APIs, mismas propiedades

---

## 2. Zona 1 — Control de Weekly

### Estados

**No iniciada:**
- Boton prominente "Iniciar Weekly" (fondo solido, texto grande)
- Fecha del lunes de la semana + duracion estimada "~60 min"
- Semaforo operativo visible (verde/amarillo/rojo) del header actual

**En curso:**
- Timer activo con tiempo transcurrido
- Bloque actual de la agenda (label + color + presenter)
- Boton "Pausar" + Boton "Terminar Weekly"
- Navegacion por bloques con flechas (misma logica advanceBlock)

**Terminada:**
- generateMinuta() se ejecuta automaticamente al presionar "Terminar Weekly"
- Panel de minuta: textarea editable
- Botones: Guardar / Copiar / Enviar a Slack
- Boton "Regenerar" para recalcular minuta

### Flujo

```
[Iniciar Weekly] -> Timer arranca, tab salta a Panorama (bloque 1)
    | (navegar por tabs con agenda, flechas, clicks)
[Terminar Weekly] -> generateMinuta(), panel minuta aparece en Home
    |
[Guardar / Copiar / Enviar a Slack]
```

### Logica de fechas

- La semana se ancla al lunes de la semana en curso, siempre lun-dom
- Si la weekly se corre al martes o miercoles, los rangos NO cambian
- getDateRanges() en gdd-hubspot/route.js ya implementa esta logica — sin cambio backend
- "Semana anterior" = lunes anterior a domingo anterior
- "Semana actual" = lunes actual a domingo actual

---

## 3. Zona 2 — Generacion de Demanda

### Card GdD Comparativo

Tabla con 2 columnas: semana anterior (datos cerrados) y semana actual (parcial), con delta porcentual.

| Metrica | Sem Anterior | Sem Actual | Delta |
|---------|-------------|------------|-------|
| Leads | N (Mkt: X / Com: Y) | N (Mkt: X / Com: Y) | +/-% |
| MQLs | N (Mkt: X / Com: Y) | N (Mkt: X / Com: Y) | +/-% |
| SQLs | N (Mkt: X / Com: Y) | N (Mkt: X / Com: Y) | +/-% |
| Opps | N (Mkt: X / Com: Y) | N (Mkt: X / Com: Y) | +/-% |
| Pipeline | $N (Mkt $X / Com $Y) | $N (Mkt $X / Com $Y) | +/-% |

**Fuente de datos**: useGDDData -> /api/gdd-hubspot (campos semana y anterior)

### Card MQLs por Canal

Tabla completa de MQLs por canal de la **semana anterior** (datos cerrados, mas confiables para discusion). Con delta vs semana pre-anterior si hay historial disponible.

| Canal | MQLs | % | Delta |
|-------|------|---|-------|
| Paid Social | 5 | 42% | +2 |
| Organic Search | 3 | 25% | -1 |
| ... | ... | ... | ... |

**Fuente de datos**: useGDDData -> /api/hubspot-mqls
- Propiedades HubSpot consultadas: fuente_conversion (primario), hs_analytics_source (fallback)
- Misma logica de agregacion que ya existe en hubspot-mqls/route.js

### Fuente unica de datos

REGLA: Ningun componente hace fetch directo a las APIs de GdD. Todo pasa por useGDDData.

```
useGDDData (hook)
  |-- /api/gdd-hubspot ---------> { semana, anterior, mes, ytd, fechas }
  |-- /api/hubspot-mqls ---------> { por_origen, breakdown_macro } x 2 calls
  |   |-- call 1: semana anterior (datos cerrados)
  |   |-- call 2: semana actual
  |-- /api/gdd-targets ----------> { targets } (Google Sheets)
  |-- /api/storage (gdd_history) > [{ semana_desde, leads, mqls... }]
  |
  v
  Retorna: gddData, mqlBreakdown, mqlBreakdownPrev, targets, history
  |
  +---> TabHome Zona 2 (cards visuales)
  +---> generateMinuta() (texto plano)
```

---

## 4. Zona 3 — Roadmap Timeline

### Datos de entrada

Filtra de items (ya cargados desde Monday API):
- Fases activas: "Sprint" + "Review" + "Modificacion"
- date_mm1b10rx (deadline) existe
- Deadline cae dentro del mes actual

Funcion compartida en utils.js:

```js
getSprintRoadmap(items)
// Retorna items en fases activas con deadline del mes actual
// Ordenados por squad, luego por fecha ascendente
```

### Layout visual (desktop > 640px)

Timeline horizontal tipo Gantt simplificado, agrupado por squad:

```
ROADMAP MAYO 2026                              12 proyectos
+----------------------------------------------------------+
|  1    5    10    15    20    25    31                     |
|                                                          |
|  Inbound Studio                                          |
|  |----SSSSSSSSSS--|  Credenciales RL  JP                 |
|       |---SSSSSSSSSSSSSS|  Blog Series  Andrea           |
|                                                          |
|  Performance                                             |
|  |----------RRRRRR|  Landing MC  Paul                    |
|                                                          |
|  RevOps                                                  |
|  |--------------MMMM|  Reporte Q2  Cesar                 |
|                                                          |
|  V                                                       |
|  HOY                                                     |
+----------------------------------------------------------+
```

**Diferenciacion visual por fase:**
- Sprint: barra solida
- Review: barra con patron rayado (CSS repeating-linear-gradient)
- Modificacion: barra punteada (CSS dashed border)

**Componentes:**
- Eje horizontal: dias 1 al ultimo del mes, marcas cada 5 dias
- Linea "HOY": linea vertical punteada, color C.blue
- Barras:
  - Inicio = timerange_mkzcqv0j (start del timeline Monday). Si no tiene, barra empieza en HOY
  - Fin = date_mm1b10rx (deadline)
  - Color = SQUADS[].color del squad correspondiente
  - Barra llena = dias transcurridos, barra tenue = dias restantes
- Labels: derecha de cada barra — nombre proyecto (truncado ~25 chars) + responsable (shortName) + fase
- Proyectos vencidos: barra en C.red, se muestran arriba del grupo

**Agrupacion por squad:**
- Label del squad a la izquierda de cada grupo
- Dentro del grupo, orden por deadline ascendente
- Maximo 3 proyectos por squad por default (los mas proximos a deadline)
- Si hay mas: boton "+N mas" que expande el grupo

**Interacciones:**
- Hover sobre barra: tooltip con nombre completo + squad + deadline exacto + fase
- Sin clicks ni modales — solo informativo

### Layout mobile (< 640px)

Lista vertical simple, sin Gantt:

```
Inbound Studio
  05 may . Credenciales RL . JP . Sprint
  08 may . Blog Series . Andrea . Review

Performance
  12 may . Landing MC . Paul . Review
```

### Edge cases

- 0 proyectos con deadline este mes: Card vacia con "Sin proyectos con deadline este mes"
- Proyecto sin timeline pero con deadline: Barra puntual (solo el punto del deadline)
- Deadline ya pasado: Barra en C.red, marcada como vencida, se muestra arriba del grupo

### Componente

Archivo nuevo: app/components/RoadmapTimeline.jsx

```
Props: RoadmapTimeline({ items })
// items = todos los items de Monday (filtra internamente con getSprintRoadmap)
```

Usa tokens existentes (C, F, R) y SQUADS para colores. CSS inline (patron del proyecto). Sin dependencias externas.

---

## 5. Minuta mejorada

### Estructura completa (texto plano para Slack)

```
WEEKLY MKT CORP . LUNES 4 DE MAYO DE 2026
------------------------------------------------

1. GENERACION DE DEMANDA
   Semana anterior (27 abr - 3 may)
   . Leads       45  (Mkt: 30 | Com: 15)
   . MQLs        12  (Mkt: 8  | Com: 4)
   . SQLs         3  (Mkt: 2  | Com: 1)
   . Opps         2  (Mkt: 1  | Com: 1)
   . Pipeline  $1.2M (Mkt $800K | Com $400K)

   Semana actual (4 - 10 may)
   . Leads       38  v16%  (Mkt: 25 | Com: 13)
   . MQLs        15  ^25%  (Mkt: 10 | Com: 5)
   . SQLs         4  ^33%  (Mkt: 3  | Com: 1)
   . Opps         1  v50%  (Mkt: 0  | Com: 1)
   . Pipeline  $800K v33%  (Mkt $500K | Com $300K)

   MQLs por canal (sem anterior . datos cerrados)
   . Paid Social        5   42%
   . Organic Search      3   25%
   . Offline / SDR       2   17%
   . Direct Traffic      1    8%
   . Email Marketing     1    8%

2. PANORAMA OPERATIVO
   (sin cambios vs actual)

3. FOCOS POR SQUAD
   (sin cambios vs actual)

4. COMPROMISOS
   (sin cambios vs actual)

5. CARGA SEMANAL
   (sin cambios vs actual)

6. ROADMAP [MES]
   Inbound Studio
   05 may . Credenciales RL - JP . Sprint
   08 may . Blog Series - Andrea . Review

   Performance
   12 may . Landing MC - Paul . Review

   RevOps
   19 may . Reporte Q2 - Cesar . Modificacion
   28 may . Integracion CRM - Diego . Sprint

------------------------------------------------
Weekly Mkt Corp . 10:45
```

### Cambios vs minuta actual

| Seccion | Antes | Ahora |
|---------|-------|-------|
| GdD | 1 bloque con delta inline | 2 bloques: anterior completo + actual con deltas |
| MQLs por canal | No existia | Tabla completa de semana anterior |
| Roadmap | No existia | Seccion 6 agrupada por squad con fase |
| Panorama | Sin cambios | Sin cambios |
| Focos | Sin cambios | Sin cambios |
| Compromisos | Sin cambios | Sin cambios |
| Carga | Sin cambios | Sin cambios |

### Firma actualizada de generateMinuta

```js
generateMinuta(wd, analysis, gddData, mqlBreakdown, blockTimes, items)
//                                    ^ nuevo       ^ nuevo (para roadmap)
```

- mqlBreakdown: ya disponible en Dashboard.jsx via useGDDData
- items: ya disponible en Dashboard.jsx, necesario para filtrar roadmap

---

## 6. Eliminaciones del Home

### Se elimina:
- OverdueSection (componente completo de vencidos en TabHome)
- Cualquier card de alertas en TabHome

### Se mantiene:
- Semaforo en header (BKL/SPR/REV/DET/VEN pills) como indicador rapido
- Las alertas completas siguen en Panorama > sub-tab "Alertas" sin cambios

---

## 7. Archivos impactados

| Archivo | Tipo de cambio |
|---------|---------------|
| app/components/TabHome.jsx | Reestructura mayor: 3 zonas, eliminar OverdueSection, agregar GdD cards y RoadmapTimeline |
| app/components/RoadmapTimeline.jsx | NUEVO: componente timeline horizontal |
| app/lib/minuta.js | Extender generateMinuta() con nueva firma y secciones 1 (GdD dual), MQLs por canal, seccion 6 (roadmap) |
| app/lib/utils.js | Agregar getSprintRoadmap() funcion compartida |
| app/Dashboard.jsx | Actualizar llamada a generateMinuta() con nuevos params (mqlBreakdown, items) |
| app/components/TabPanorama.jsx | Sin cambios |

### Archivos que NO se tocan:
- APIs backend (gdd-hubspot, hubspot-mqls, gdd-targets, storage) — sin cambios
- useGDDData hook — sin cambios (ya expone mqlBreakdown y mqlBreakdownPrev)
- TabAgenda, TabFocos, TabCompromisos, TabMinutas — sin cambios
- constants.js, tokens.js, css.js — sin cambios

---

## 8. Restricciones tecnicas

- Sin dependencias externas nuevas. El Gantt se dibuja con divs posicionados (position: absolute/relative)
- CSS inline (patron del proyecto). Tokens de C, F, R
- TabHome.jsx actualmente tiene 51KB — la reestructura debe reducir su tamano extrayendo RoadmapTimeline como componente separado y eliminando OverdueSection
- getSprintRoadmap() en utils.js es la unica logica de filtrado de roadmap — tanto el componente visual como generateMinuta() la consumen
