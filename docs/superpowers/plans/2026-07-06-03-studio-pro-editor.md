# Plan 3 — Studio profesional (inspiración CapCut) + librería de componentes por autodescubrimiento

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir el Studio en un editor de timesheets de nivel profesional — timeline propia con drag directo de clips, trim por ambos bordes, multi-selección, clipboard, zoom de timeline, reproducir-desde-el-playhead, proyectos con autosave y diálogo de export — y un **panel de componentes** que autodescubre los `<TelekineticFrame>` de la app embebida (con clasificación, miniaturas y acciones sugeridas) y permite consolidar una **librería de recetas de componentes** persistente y reutilizable entre proyectos.

**Architecture:** Se sustituye `@xzdarcy/react-timeline-editor` (hoy en modo `movable:false` + un `ReorderStrip` aparte, porque su modelo de "tiempo libre por fila" pelea contra nuestro modelo secuencial — la propia doc del módulo lo admite) por una **timeline propia basada en DOM** cuya geometría es un módulo puro testeable (`timeline-geom.ts`). El invariante no cambia: **`timeline[]` es la única fuente de verdad**; la vista se proyecta con `layoutTimesheet` y cada gesto se traduce a una operación sobre el array (drag horizontal = reorder; borde izquierdo = `delayBefore`; borde derecho = `duration`). El descubrimiento de componentes amplía `FrameInfo` (aditivo) con clasificación calculada en la página objetivo; las miniaturas las sirve el sidecar con Playwright; las recetas persisten en `~/.telekinesis/library.json` vía el sidecar.

**Tech Stack:** React 19, Vite, Vitest, pointer events nativos (sin librería de DnD), Playwright (sidecar de miniaturas), Node http (sidecar existente).

**Dependencias con otros planes:** Ninguna dura. Si el Plan 2 existe, el panel de componentes ofrece *secuencias* por tipo de componente (mejor); si no, ofrece efectos sueltos (degradación definida en Task 8). El Plan 1 solo añade más actions que la timeline pinta igual (colores por lane ya derivados).

---

## Estado del arte (verificado en `apps/studio/`)

**Ya conseguido** (no re-implementar): reorder por drag (en strip aparte) y Alt+↑/↓; undo/redo con historial inmutable (`history.ts`); playhead + scrubbing determinista vía `seek` del bridge (reconstrucción de estado persistente — `core/src/seek.ts`); resize del borde derecho con snapping (`resizeDurationMs`); lane de sonido con mute/perfil sugerido; X-ray por eventos `frames-changed` (rAF-throttled, sin polling); render GIF/MP4 y save vía sidecar.

**Huecos que este plan cierra:**

| Hueco | Hoy |
| --- | --- |
| Drag de clips en la propia timeline | `movable:false`; reorder vive en un strip separado de la vista temporal |
| Borde izquierdo (= `delayBefore`) | No editable arrastrando; los huecos entre clips no se visualizan |
| Multi-selección / clipboard / duplicar | No existe (`selected: number \| null`) |
| Zoom de timeline | Escala fija `140px/s` (`SCALE_WIDTH_PX`) |
| Play desde el playhead / paso a paso | `play` es todo-o-nada desde 0 |
| Proyectos | Sin autosave; Save pide un path con `window.prompt`; no hay Open |
| Export | Hardcoded: GIF 960px/15fps o MP4; sin presets |
| Panel de componentes | Palette plano de ids con 4 botones; sin clasificación, miniaturas ni recetas |

## Reglas duras

1. **`timeline[]` secuencial = única fuente de verdad.** La timeline nunca guarda posiciones absolutas; todo se re-deriva con `layoutTimesheet`. Prohibido introducir un modelo paralelo de tracks con offsets.
2. **El contrato del bridge (`core/src/studio-bridge.ts`) solo crece.** Mensajes existentes (`ping/listFrames/getRect/runEffect/play/stop/seek`) intactos — el playground también los usa.
3. Toda lógica de gesto (px→índice, px→ms, snapping, clipboard) va en módulos puros con tests **antes** que el componente que la usa.
4. Un gesto = un commit de historial (un undo deshace el gesto entero, como ya hace `commitSheet`).
5. Cada task: `pnpm --filter @telekinesis/studio test && pnpm typecheck` verdes + commit.

## Mapa de ficheros

- **Crear:** `apps/studio/src/timeline-geom.ts`, `apps/studio/src/TimelinePro.tsx`, `apps/studio/src/clipboard-ops.ts`, `apps/studio/src/ComponentsPanel.tsx`, `apps/studio/src/recipes.ts`, `apps/studio/src/ExportDialog.tsx`, `apps/studio/test/{timeline-geom,clipboard-ops,recipes}.test.ts`, `packages/core/src/classify.ts`, `packages/core/test/classify.test.ts`
- **Modificar:** `apps/studio/src/{App.tsx,timeline-ops.ts,styles.css}`, `apps/studio/server/index.ts`, `packages/core/src/{registry.ts,index.ts}`, `packages/core/src/player.ts` (opción `startIndex`), `apps/studio/package.json` (quitar `@xzdarcy/*`)
- **Eliminar al final:** `apps/studio/src/Timeline.tsx`, `apps/studio/src/ReorderStrip.tsx` (absorbidos por `TimelinePro`)

---

### Task 1: Geometría pura de la timeline (`timeline-geom.ts`)

**Files:** Create `apps/studio/src/timeline-geom.ts`, `apps/studio/test/timeline-geom.test.ts`

- [ ] **Step 1.1: Tests que fallan** — la matemática entera del editor, sin DOM:

```ts
import { describe, expect, it } from "vitest";
import { layoutTimesheet } from "@telekinesis/schema";
import {
  msToPx, pxToMs, clipBox, insertionIndexFromX, dragDelayBeforeMs, zoomAround,
} from "../src/timeline-geom";

const sheet = {
  timeline: [
    { action: "wait", duration: 1000 },                            // 0-1000
    { action: "zoom-in", duration: 1200, delayBefore: 500 },       // 1500-2700
    { action: "zoom-out", duration: 900 },                         // 2700-3600
  ],
} as never;
const layout = layoutTimesheet(sheet);
const view = { pxPerSecond: 100, leftPad: 16 };

describe("proyección", () => {
  it("ms↔px son inversas", () => {
    expect(pxToMs(msToPx(2350, view), view)).toBeCloseTo(2350);
  });
  it("clipBox posiciona por layout", () => {
    expect(clipBox(layout.items[1], view)).toEqual({ x: 16 + 150, w: 120 });
  });
});

describe("insertionIndexFromX (drag = reorder)", () => {
  it("suelta antes del primer clip → 0", () => {
    expect(insertionIndexFromX(0, layout, view)).toBe(0);
  });
  it("suelta en el hueco delayBefore → índice del clip que lo posee", () => {
    expect(insertionIndexFromX(msToPx(1200, view), layout, view)).toBe(1);
  });
  it("suelta pasada la mitad de un clip → después de él", () => {
    expect(insertionIndexFromX(msToPx(3300, view), layout, view)).toBe(3);
  });
});

describe("dragDelayBeforeMs (borde izquierdo)", () => {
  it("arrastrar el borde izq. a la izquierda crece delayBefore… hasta 0 de hueco", () => {
    expect(dragDelayBeforeMs(layout.items[1], msToPx(1100, view), view, [])).toBe(100);
  });
  it("nunca negativo", () => {
    expect(dragDelayBeforeMs(layout.items[1], msToPx(600, view), view, [])).toBe(0);
  });
  it("snapea a bordes vecinos", () => {
    expect(dragDelayBeforeMs(layout.items[1], msToPx(1004, view), view, [1000], 8)).toBe(0);
  });
});

describe("zoomAround (rueda)", () => {
  it("mantiene el ms bajo el puntero estable", () => {
    const next = zoomAround(view, 1.25, /*pointerX*/ 216, /*scrollLeft*/ 0);
    const msBefore = pxToMs(216 + 0, view);
    expect(pxToMs(216 + next.scrollLeft, next.view)).toBeCloseTo(msBefore, 0);
  });
});
```

- [ ] **Step 1.2:** Run: `pnpm --filter @telekinesis/studio test` — FAIL.
- [ ] **Step 1.3: Implementar.** Firmas exactas:

```ts
export interface TimelineView { pxPerSecond: number; leftPad: number; }
export const msToPx = (ms: number, v: TimelineView) => v.leftPad + (ms / 1000) * v.pxPerSecond;
export const pxToMs = (px: number, v: TimelineView) => Math.max(0, ((px - v.leftPad) / v.pxPerSecond) * 1000);
export const clipBox = (item: LaidOutEffect, v: TimelineView) => ({
  x: msToPx(item.start, v),
  w: Math.max(6, (item.duration / 1000) * v.pxPerSecond),
});
/** Índice de inserción en timeline[] para un drop en x: el hueco cuyo punto medio de clip está a la derecha. */
export function insertionIndexFromX(x: number, layout: TimesheetLayout, v: TimelineView): number { … }
/** Nuevo delayBefore al arrastrar el borde izq. hasta `edgeX`: clamp ≥0, snap a `edgesMs` (reusa snapToEdges). El fin del clip NO se mueve: duration se mantiene, solo cambia cuánto respira antes. */
export function dragDelayBeforeMs(item: LaidOutEffect, edgeX: number, v: TimelineView, neighborEdgesMs: readonly number[], thresholdPx = 8): number { … }
/** Zoom exponencial anclado al puntero; clamp pxPerSecond a [24, 800]. Devuelve { view, scrollLeft }. */
export function zoomAround(v: TimelineView, factor: number, pointerX: number, scrollLeft: number): { view: TimelineView; scrollLeft: number } { … }
```

`insertionIndexFromX`: recorrer `layout.items` (ya ordenados por `start`); devolver el índice del primer item cuyo `start + duration/2` en px supera `x`; si ninguno, `items.length`. Reutilizar `snapToEdges` de `timeline-ops.ts` para el snap (convertir threshold px→ms con `v.pxPerSecond`).

- [ ] **Step 1.4:** Tests PASS. Commit: `feat(studio): pure timeline geometry (projection, insertion, edge drags, zoom)`

### Task 2: `TimelinePro` — render + selección + playhead + zoom (sustituye a RTE)

**Files:** Create `apps/studio/src/TimelinePro.tsx`; Modify `apps/studio/src/App.tsx`, `apps/studio/src/styles.css`; Delete usage of `Timeline.tsx`/`ReorderStrip.tsx` (los ficheros se borran en Task 10)

- [ ] **Step 2.1: Estructura del componente.** Props (mantener las de `Timeline` actual para que `App.tsx` cambie poco): `{ sheet, layout, selection: Set<number>, onSelectionChange, playheadMs, totalMs, onScrub, onScrubStart, onResize, onDelayChange, onReorder, onToggleMute }`. Render DOM:
  - Un contenedor `overflow-x: auto` con ancho de contenido `msToPx(totalMs) + 200`.
  - **Regla de tiempo** arriba: ticks cada 1 s (y cada 0.5 s si `pxPerSecond > 200`), etiquetas `formatClock`; click/drag en la regla = scrub (`onScrubStart` + `onScrub(pxToMs(x))` — mismo contrato que hoy).
  - **Lanes** (una fila por `EFFECT_LANES` + sound, etiquetas a la izquierda como hoy, colores `LANE_COLOR` que se mueve aquí desde `Timeline.tsx`).
  - **Clips**: `<button>` absolutamente posicionados con `clipBox`; huecos `delayBefore/After` pintados como zona rayada (CSS `repeating-linear-gradient`) pegada al clip; clip seleccionado con outline; label = `action`.
  - **Playhead**: línea vertical full-height en `msToPx(playheadMs)`, arrastrable (pointer capture), + el range input accesible actual (conservarlo: `tk-playhead-range`).
  - **Lane de sonido**: chips `♪/∅` por clip `SOUND_CAPABLE` (misma lógica y aria-labels que hoy — copiar de `Timeline.tsx:196-218`).
  - **Zoom**: estado `view` en el componente; `Ctrl/Cmd + rueda` → `zoomAround` (aplicar `scrollLeft` devuelto al contenedor); botones `+ / − / fit` (fit: `pxPerSecond = (ancho visible - 32) / (totalMs/1000)`).
- [ ] **Step 2.2: Cablear en `App.tsx`:** sustituir `<ReorderStrip>` + `<Timeline>` por `<TimelinePro>`; `selected: number | null` pasa a `selection: Set<number>` (Task 4 la explota; de momento single: `new Set([i])`; `selectedEffect` = único elemento si `selection.size === 1`). Mantener `selectAndPreview` (click en clip → preview del efecto).
- [ ] **Step 2.3: Validación sensorial:** `pnpm studio` contra `pnpm docs` — paridad visual con lo de antes + zoom con rueda + scrub OK en regla, playhead y range.
- [ ] **Step 2.4:** `pnpm typecheck` + tests + commit: `feat(studio): TimelinePro replaces react-timeline-editor (custom DOM timeline)`

### Task 3: Gestos de edición — drag-reorder en la timeline, trim de ambos bordes

**Files:** Modify `apps/studio/src/TimelinePro.tsx`, `apps/studio/src/App.tsx`

- [ ] **Step 3.1: Drag horizontal = reorder.** Pointer events sobre el cuerpo del clip: al superar 4px de arrastre, entrar en modo drag (ghost del clip siguiendo el puntero, `insertionIndexFromX` en vivo pintando una barra de inserción vertical); al soltar, `onReorder(from, insertionIndex)` (el `reorderTimeline` existente; ajustar índice si `to > from` — restar 1, cubierto por test en Step 3.2). Escape cancela. Mantener Alt+←/→ como equivalente de teclado (migrar de ReorderStrip).
- [ ] **Step 3.2: Test puro** del ajuste drop-index→reorder-args en `timeline-geom.test.ts` (`dropToReorderArgs(from, insertionIndex)` → `{ from, to }`, casos to>from, to===from y to===from+1 = no-op).
- [ ] **Step 3.3: Trim borde derecho:** zona de 6px al final del clip (`cursor: ew-resize`); drag → `onResize(index, resizeDurationMs(...))` (función existente, snapping incluido) con preview en vivo (estado local de anchura) y commit al soltar. Solo para actions con `duration` real (mismo criterio `RESIZABLE_ACTIONS`, que se muda aquí desde `Timeline.tsx`).
- [ ] **Step 3.4: Trim borde izquierdo = `delayBefore`:** zona de 6px al inicio; drag → `dragDelayBeforeMs` con preview (el clip se desliza, su fin no se mueve); al soltar, `onDelayChange(index, ms)` → `updateEffect(index, { ...effect, delayBefore: ms || undefined })`. Disponible para **todas** las actions (todas heredan `delayBefore` de `BaseEffect`).
- [ ] **Step 3.5: Validación sensorial:** mover un clip entre lanes visuales (reordena globalmente), estirar un `highlight`, dar aire a un `zoom-in` con el borde izquierdo; undo/redo deshace cada gesto entero.
- [ ] **Step 3.6:** Commit: `feat(studio): direct clip drag-reorder and two-edge trimming`

### Task 4: Multi-selección + clipboard (`clipboard-ops.ts`)

**Files:** Create `apps/studio/src/clipboard-ops.ts`, `apps/studio/test/clipboard-ops.test.ts`; Modify `apps/studio/src/{TimelinePro.tsx,App.tsx}`

- [ ] **Step 4.1: Tests primero** — módulo puro sobre arrays:

```ts
duplicateAt(items, indices)      // inserta copias tras el último seleccionado; devuelve { items, newSelection }
removeAt(items, indices)         // borra el set; si queda vacío inyecta { action: "wait", duration: 500 } (regla actual de deleteEffect)
serializeClips(items, indices)   // → JSON string (array de efectos, deep-copied)
parseClips(json)                 // → efectos válidos (cada uno parsea contra Effect) o null
insertAt(items, index, clips)    // splice inmutable; devuelve { items, newSelection }
```

Casos: índices no contiguos, duplicar mantiene orden relativo, `parseClips` rechaza basura y objetos sin `action`.

- [ ] **Step 4.2: Implementar** (deep-copy con `structuredClone`; validar cada clip con `Effect.safeParse` de `@telekinesis/schema` en `parseClips`).
- [ ] **Step 4.3: UI.** En `TimelinePro`: click = selección única; Cmd/Ctrl+click = toggle; Shift+click = rango (índices entre ancla y click). En `App.tsx`, atajos globales (extender el listener de teclado existente de undo/redo, ignorando eventos cuyo target sea input/select/textarea): `Delete/Backspace` → removeAt; `Cmd+D` → duplicateAt; `Cmd+C` → `navigator.clipboard.writeText(serializeClips(...))`; `Cmd+V` → leer clipboard, `parseClips`, `insertAt` tras la selección (o al final); `Cmd+A` → seleccionar todo; `Esc` → limpiar selección. Cada op = un `commitSheet`.
- [ ] **Step 4.4: Inspector con multi-selección:** si `selection.size > 1`, mostrar `N clips seleccionados` + botones Duplicate/Delete (el form de campos solo con selección única).
- [ ] **Step 4.5:** Tests + typecheck + commit: `feat(studio): multi-select, clipboard, duplicate, batch delete`

### Task 5: Transporte pro — play desde el playhead, paso a paso, loop de selección

**Files:** Modify `packages/core/src/player.ts`, `packages/core/src/studio-bridge.ts`, `apps/studio/src/App.tsx`

- [ ] **Step 5.1: Core (aditivo).** `PlayOptions` gana `startIndex?: number` — `play()` hace `for (let i = opts.startIndex ?? 0; …)`. El bridge (`BridgePlayOptions` + handler `play`) lo pasa tal cual; `StudioPlayOptions` también. Nada más cambia (los pasos previos al índice no se re-simulan: mismo trade-off documentado que `seek.ts`; el estado persistente lo pone el `seek` previo del scrub).
- [ ] **Step 5.2: Studio.** ▶ Play pasa a: calcular `startIndex` = primer item de `layout.items` con `start >= playheadMs` (0 si playhead a 0); antes de reproducir, `client.seek(sheet, playheadMs)` para plantar el estado. Botones nuevos: `⏮` (playhead a 0 + seek), `◀ / ▶` step (seleccionar clip anterior/siguiente + `runEffect` de ese clip + mover playhead a su `start`), `⟲ selección` (reproducir del primer al último índice seleccionado en bucle hasta Stop: play con `startIndex` + abort tras `onStep` > último — implementar con el `AbortController` del cliente y contador en `onStep`).
- [ ] **Step 5.3: Playhead sigue la reproducción:** en `onStep(i)`, `setPlayheadMs(layout.items[i].start)` (barato y suficiente; interpolación fina queda fuera de alcance).
- [ ] **Step 5.4:** Validación sensorial + `pnpm typecheck` + commit: `feat(core,studio): play from playhead, step transport, loop selection`

### Task 6: Autodescubrimiento enriquecido — clasificación de componentes en `core`

**Files:** Create `packages/core/src/classify.ts`, `packages/core/test/classify.test.ts`; Modify `packages/core/src/registry.ts`, `packages/core/src/index.ts`

- [ ] **Step 6.1: Tests primero** (con pragma `// @vitest-environment jsdom` en el fichero de test; añadir `jsdom` a devDeps de core):

```ts
import { describe, expect, it } from "vitest";
import { classifyElement } from "../src/classify";

const el = (html: string) => {
  const host = document.createElement("div");
  host.innerHTML = html;
  return host.firstElementChild as HTMLElement;
};

describe("classifyElement", () => {
  it("botón directo o interior → action", () => {
    expect(classifyElement(el(`<div><button>Buy</button></div>`))).toBe("action");
  });
  it("input/textarea → field", () => {
    expect(classifyElement(el(`<div><input type="email"/></div>`))).toBe("field");
  });
  it("form → form", () => {
    expect(classifyElement(el(`<form><input/><button/></form>`))).toBe("form");
  });
  it("nav/aside/header → nav", () => {
    expect(classifyElement(el(`<nav><a href="/">home</a></nav>`))).toBe("nav");
  });
  it("img/video/canvas/svg dominante → media", () => {
    expect(classifyElement(el(`<div><img src="x.png"/></div>`))).toBe("media");
  });
  it("varios frames-hijos o >2 interactivos → container", () => {
    expect(classifyElement(el(`<div><button/><a href="#">x</a><button/></div>`))).toBe("container");
  });
  it("resto → content", () => {
    expect(classifyElement(el(`<p>hola</p>`))).toBe("content");
  });
});
```

- [ ] **Step 6.2: Implementar `classify.ts`:**

```ts
export type FrameKind = "action" | "field" | "form" | "nav" | "media" | "container" | "content";

/** Heurística DOM barata y determinista; se ejecuta en listFrames() (bajo demanda, no en el registro). */
export function classifyElement(el: HTMLElement): FrameKind { … }
```

Orden de decisión (primero gana): `form` (tag FORM o `role=form`); `field` (el propio el o un descendiente único `input/textarea/select/[contenteditable]` sin botón dominante); `action` (`button/a/[role=button]` propio o único interactivo interior); `nav` (`nav/aside/header/footer` o `role` equivalente); `media` (`img/video/canvas/svg` ocupa >60% del área — usar conteo de tags, no layout, para que jsdom lo pueda testear: "primer hijo relevante es media y no hay interactivos"); `container` (≥2 interactivos o ≥2 `[data-telekinesis-frame]` descendientes); si no, `content`.

- [ ] **Step 6.3: Ampliar `FrameInfo` (aditivo).** En `registry.ts`: `FrameInfo` gana `kind: FrameKind` y `tag: string` (lowercase `el.tagName`); `listFrames()` los calcula. Consumers existentes (engine `extract.ts`, MCP `frameShape`, Studio palette) siguen funcionando — campos extra en JSON son inofensivos; actualizar `ExtractedFrame` (engine) y `frameShape` (mcp) con los campos opcionales para tiparlos (aditivo).
- [ ] **Step 6.4:** Tests + typecheck + commit: `feat(core): frame classification (kind/tag) in listFrames`

### Task 7: Miniaturas de componentes en el sidecar

**Files:** Modify `apps/studio/server/index.ts`

- [ ] **Step 7.1: Endpoint `/api/thumbnails` (POST `{ url }`).** Con Playwright (dep ya presente vía `@telekinesis/engine` en devDeps): navegar `url` (con `?demo`), esperar runtime ready (mismo waitForFunction que `engine/src/extract.ts`), `listFrames` y para cada frame `page.locator([data-telekinesis-id="…"]).screenshot({ type: "jpeg", quality: 60 })` → responder `{ [id]: dataUrl }`. Cachear en memoria por `url` (Map con TTL 60 s) — el Studio lo pide al conectar y al pulsar "↻ thumbnails", no en cada `frames-changed`. Presupuesto: viewport 1280×720, JPEG q60, máx 40 frames (cortar y avisar en la respuesta).
- [ ] **Step 7.2: Cliente:** función `fetchThumbnails(target)` en `App.tsx`; estado `thumbs: Record<string, string>`; disparar tras `client.ready()` en `onIframeLoad` (fire-and-forget, con `.catch` silencioso — sin Playwright instalado el panel funciona sin fotos).
- [ ] **Step 7.3: Smoke manual:** `pnpm studio` → `curl -X POST localhost:57174/api/thumbnails -d '{"url":"http://localhost:4311"}' -H 'content-type: application/json' | head -c 300` — Expected: JSON con dataURLs.
- [ ] **Step 7.4:** Commit: `feat(studio): frame thumbnails endpoint (sidecar Playwright screenshots)`

### Task 8: Panel de componentes (sustituye al palette plano)

**Files:** Create `apps/studio/src/ComponentsPanel.tsx`; Modify `apps/studio/src/App.tsx`, `apps/studio/src/styles.css`

- [ ] **Step 8.1: Sugerencias por tipo — módulo puro + test** (en `timeline-ops.ts` + su test): `suggestedInsertions(frame: FrameInfo): { label: string; effects: unknown[] }[]`:
  - `action` → "Point & click" (`cursor-move`+`click` con sonido) · "Spotlight" (highlight)
  - `field` → "Fill" (`cursor-move`+`click`+`type-down` placeholder `"Hello"`) 
  - `form` → "Fill & submit" (fill de cada input descubierto dentro… no hay introspección interior: usar el propio frame → degradar a "Spotlight + zoom")
  - `container` → "Establish shot" (`zoom-in` 1.12 + `highlight`)
  - `nav`/`media`/`content` → "Spotlight" · "Zoom"
  - **Si Plan 2 está presente** (detectar `SEQUENCES` importable con try/catch dinámico… no: detectar por `typeof SEQUENCES !== "undefined"` importándolo estático — schema siempre está; usar `SEQUENCE_IDS.length > 0`): mapear a llamadas `sequenceEffects("cta-click"|"form-fill"|"intro-establish", …)` en lugar de efectos a mano.
- [ ] **Step 8.2: UI del panel.** Reemplazar el `<aside className="tk-palette">` por `<ComponentsPanel frames thumbs onInsert onFlash>`: 
  - Grid de tarjetas agrupadas por `kind` (chips de sección con conteo), cada tarjeta: miniatura (o placeholder de color por kind), `id`, `intent`, badge `kind`.
  - Hover → `onFlash(id)`: pinta el badge X-ray de ese frame en highlight (estado `flashId` que la capa X-ray ya renderiza — añadir clase CSS).
  - Click → expandir acciones sugeridas (botones que llaman a `onInsert(effects)` = `addEffect` múltiple en un solo commit).
  - Buscador por id/intent arriba (filtro local).
  - Botón "↻ thumbnails".
- [ ] **Step 8.3: Insertar en el playhead** (no siempre al final): `onInsert` inserta en `insertionIndexFromX(msToPx(playheadMs))`… ya tenemos el índice por tiempo: primer item con `start >= playheadMs`. Usar `insertAt` de `clipboard-ops`.
- [ ] **Step 8.4:** Validación sensorial contra `pnpm docs` (frames `hero`, `pillars`…): tarjetas con foto, hover ilumina, insertar "Establish shot" en medio del timeline.
- [ ] **Step 8.5:** Tests + typecheck + commit: `feat(studio): components panel with classification, thumbnails and suggested insertions`

### Task 9: Recetas — la librería de componentes persistente

**Files:** Create `apps/studio/src/recipes.ts`, `apps/studio/test/recipes.test.ts`; Modify `apps/studio/server/index.ts`, `apps/studio/src/{ComponentsPanel.tsx,App.tsx}`

- [ ] **Step 9.1: Modelo + tests primero** (`recipes.test.ts`):

```ts
export interface ComponentRecipe {
  name: string;                       // "CTA punch"
  /** A qué componentes aplica. Matching por cualquiera de los criterios presentes. */
  match: { kind?: FrameKind; intentPattern?: string; idPattern?: string };
  /** Efectos plantilla; "$frameId" se sustituye por el frame elegido al aplicar. */
  effects: Record<string, unknown>[];
  createdAt: string;
}
recipeMatches(recipe, frame)         // regex-safe (patrones inválidos → false), kind exacto
bindRecipe(recipe, frameId)          // deep-clone + sustitución de "$frameId" en frameId/destFrameId
recipeFromSelection(name, frame, effects) // captura: efectos seleccionados → plantilla (reemplaza el id concreto por "$frameId" en todos los campos *frameId* que coincidan)
```

Tests: matching por kind/intent/id, binding sustituye en `frameId` y `destFrameId`, captura invierte el binding.

- [ ] **Step 9.2: Persistencia en el sidecar.** `GET /api/library` → lee `~/.telekinesis/library.json` (`{ recipes: ComponentRecipe[] }`, `[]` si no existe); `POST /api/library` → escribe entero (last-write-wins, herramienta local mono-usuario). Crear dir con `mkdir recursive`.
- [ ] **Step 9.3: UI.** (a) En el Inspector/toolbar con selección no vacía: botón "★ Save as recipe" → pide nombre (input inline, no `window.prompt`) + elige el frame ancla (select de los frameIds usados en la selección) → `recipeFromSelection` → POST. (b) En `ComponentsPanel`, sección "Recipes": las que `recipeMatches` el componente hovered/expandido, botón por receta → `bindRecipe` → insertar. (c) Borrar receta (✕ con confirm inline).
- [ ] **Step 9.4: Validación sensorial:** guardar "CTA punch" (cursor-move+shake+click) desde una selección sobre `hero-cta`, verlo ofrecido en cualquier frame `kind: action`, aplicarlo sobre otro botón, reiniciar el Studio y comprobar que persiste.
- [ ] **Step 9.5:** Tests + typecheck + commit: `feat(studio): persistent component recipe library (~/.telekinesis/library.json)`

### Task 10: Proyecto y export — autosave, Open/Save, diálogo con presets, limpieza final

**Files:** Create `apps/studio/src/ExportDialog.tsx`; Modify `apps/studio/src/App.tsx`, `apps/studio/server/index.ts`; Delete `apps/studio/src/Timeline.tsx`, `apps/studio/src/ReorderStrip.tsx`; Modify `apps/studio/package.json`

- [ ] **Step 10.1: Autosave.** Persistir `{ sheet, target, savedAt }` en `localStorage["tk-studio-autosave"]` (debounce 500 ms sobre cambios de `history.present`); al arrancar, si existe y difiere de `DEFAULT_SHEET`, banner "Restaurar sesión anterior (hace X min)? [Restaurar] [Descartar]".
- [ ] **Step 10.2: Open/Save.** Sidecar: `POST /api/open { path }` → `{ timesheet }` (validado con `safeParseTimesheet` + `expandTimesheet` si Plan 2 presente; 404/400 con error legible). UI: menú "File" (New / Open… / Save / Save As…) — Open y Save As con input de path inline (estado `filePath` en App; Save reutiliza el path conocido). Título de la ventana/topbar: `meta.title — ● sin guardar` (dirty = `history.present !== lastSaved`).
- [ ] **Step 10.3: ExportDialog.** Modal al pulsar Render: preset de resolución (720p / 1080p / la del sheet), fps (15/24/30), formato (MP4 / GIF / ambos), y para GIF width (480/640/960) + fps (12/15). Al confirmar: sobrescribir `resolution`/`fps` del sheet **solo en el payload** del POST `/api/render` (el sheet del editor no cambia) y encadenar dos llamadas si "ambos". El server: aceptar `gif: { fps, width }` opcional en el body y pasarlo a `toGif`.
- [ ] **Step 10.4: Limpieza.** Borrar `Timeline.tsx` y `ReorderStrip.tsx`; quitar `@xzdarcy/react-timeline-editor` y `@xzdarcy/timeline-engine` de `apps/studio/package.json`; `pnpm install`; grep de imports huérfanos (`rg "@xzdarcy" apps/`).
- [ ] **Step 10.5: Gate final.** `pnpm typecheck && pnpm test && pnpm build` + dogfood completo guiado: cargar docs → insertar 6 clips desde el panel (2 por receta) → reordenar en timeline → trim ambos bordes → multi-duplicar → play desde playhead → export GIF 480px → Save As → recargar → Restaurar autosave. Commit + PR: `feat(studio): pro editor (custom timeline, clipboard, transport, components library, projects, export presets)`.

---

## Definición de hecho

- La timeline propia cubre todo lo que hacían RTE + ReorderStrip (sin regresiones: scrub, resize+snap, lane sonido, colores, a11y de los chips) y añade: drag-reorder directo, trim izquierdo (`delayBefore`), multi-selección, clipboard/duplicar, zoom con rueda anclado al puntero.
- Transporte: play desde playhead (con `startIndex` aditivo en core), paso a paso, loop de selección.
- Panel de componentes: clasificación (`kind` en `FrameInfo`, testeada), miniaturas reales, acciones sugeridas por tipo, e inserción en el playhead.
- Librería de recetas persistente en `~/.telekinesis/library.json` con matching/binding testeados.
- Proyectos: autosave con restauración, Open/Save/Save As, export con presets.
- `@xzdarcy/*` eliminado; `timeline[]` sigue siendo la única fuente de verdad; el bridge solo creció (`startIndex`).
