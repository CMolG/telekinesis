# Plan 1 — Ampliación de la librería de animaciones/transiciones + documentación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crecer el vocabulario cinematográfico de 11 a 22 efectos (pan, pulse, glow, callout, caption, letterbox, hover, press-key, confetti, cursor-hide, cursor-show), sumar 3 easings y 1 perfil de sonido nuevos, y dejar cada efecto documentado con ejemplo de timesheet — todo de forma **estrictamente aditiva** sobre el contrato de `@telekinesis/schema`.

**Architecture:** Cada efecto nuevo es un miembro más de la unión discriminada `Effect` (`packages/schema/src/effects.ts`) con su handler en el switch de `runEffect` (`packages/core/src/effects.ts`, protegido por exhaustiveness guard: un efecto sin handler rompe el build). Los visuales viven en la capa overlay (`#telekinesis-layer`, hermana de `<body>` — nunca dentro, porque la cámara transforma `<body>`), o delegan en `Camera`. El engine de Playwright solo cambia para efectos con I/O real (`hover`, `press-key`); el resto cae en su rama `default` (visual puro) sin tocarlo.

**Tech Stack:** Zod (schema), TypeScript strict, rAF + WAAPI (`el.animate`) para visuales, Web Audio (preview) + síntesis PCM propia (`packages/render/src/synth/`) para el sonido nuevo, Vitest.

**Dependencias con otros planes:** Ninguna. Los planes 2 (secuencias) y 5 (galería GIF) consumen lo que este plan añade, pero no lo bloquean.

---

## Estado del arte (verificado en código, 2026-07-06)

| Pieza | Estado |
| --- | --- |
| Efectos | 11: `click, type-down, drag-and-drop, shake, zoom-in, zoom-out, scroll-up, scroll-down, cursor-move, highlight, wait` |
| Easings | 9 (5 originales + 4 añadidos 2026-07: expo/quint/circ/back). `spring` = integrador físico real en `timing.ts` |
| Cámara | `camera.ts`: matriz `scale+tx+ty` por rAF, Ken Burns idle drift, springs. **Ya soporta paneo internamente** — pero ningún efecto lo expone |
| Cursor | Fitts ease, overshoot+settle con springs, motion trail, squash & stretch en `pressPulse` |
| Spotlight | Desliza entre targets (FLIP), breathing pulse, grace window de 2.2 s |
| Sonido | 5 perfiles con doble síntesis (Web Audio live + PCM offline), catálogo con metadatos en `schema/src/sound.ts` |
| Docs | `docs/effects.md` (tabla por efecto), `apps/docs/src/content/effects.mdx`, showcase en `apps/docs/telekinesis/sections.ts` |

**Los huecos que este plan cierra:** no hay paneo sin zoom, ni anotaciones de texto (callout/caption — lo más pedido para tutoriales), ni celebración (confetti), ni control del cursor como "actor" (hide/show), ni hover real, ni tecla física (`Enter` para submits), ni letterbox cinematográfico, ni variante blur del spotlight.

## Reglas duras (no negociables)

1. **Enums solo crecen.** Nunca renombrar/eliminar valores de `EasingPattern`, `SoundProfile`, `EFFECT_ACTIONS` (el comentario en `schema/src/easing.ts:8-10` ya lo exige). Los timesheets de `examples/` y el Studio referencian por string.
2. **Checklist por efecto nuevo** (el compilador fuerza casi todo — `LANE_OF` y `EFFECT_BASE_DURATIONS` son `Record<EffectAction, …>` y el switch de `runEffect` tiene guard `never`):
   - `schema/src/effects.ts`: schema Zod + tipo + entrada en la unión `Effect` + `EFFECT_ACTIONS`.
   - `schema/src/layout.ts`: lane en `LANE_OF` + duración base en `EFFECT_BASE_DURATIONS`.
   - `core/src/effects.ts`: case en `runEffect`.
   - `core/src/seek.ts`: decisión explícita persistente/momentáneo (comentario si se omite).
   - `apps/studio/src/Inspector.tsx`: campos propios si los hay.
   - `apps/studio/src/Timeline.tsx`: color si se añade lane nueva.
   - `docs/effects.md`: sección `### \`<action>\`` (el test de cobertura de la Task 12 lo hace obligatorio).
   - Engine (`engine/src/record.ts`): **solo** si hay I/O real.
3. **`mode: "self" | "external"` intacto.** En external, Playwright hace el I/O real; los visuales siempre corren en la página.
4. Elementos visuales nuevos → siempre en `getLayer()` (viewport space), transform/opacity-only en frames animados, y limpieza en `finally` ante abort.
5. Cada task termina con `pnpm typecheck && pnpm test` verdes y un commit.

## Mapa de ficheros

- **Modificar:** `packages/schema/src/{easing,effects,layout,sound}.ts`, `packages/core/src/{easing,effects,seek,overlay,cursor,sound}.ts`, `packages/engine/src/record.ts`, `apps/studio/src/{Inspector,Timeline}.tsx`, `docs/effects.md`, `apps/docs/src/content/effects.mdx`, `apps/docs/telekinesis/sections.ts`, `playground/src/demo.ts`, `packages/render/src/synth/voices.ts`
- **Crear:** `packages/core/src/annotations.ts` (callout + caption + keycap), `packages/core/src/confetti.ts`, `packages/schema/test/effects-catalog.test.ts`, `packages/schema/test/docs-coverage.test.ts`

---

### Task 0: Rama y línea base verde

- [ ] **Step 0.1:** `git checkout -b feat/effects-vocabulary`
- [ ] **Step 0.2:** Run: `pnpm typecheck && pnpm test` — Expected: PASS (si falla, parar y reportar antes de tocar nada).

### Task 1: Tres easings nuevos (`ease-in-expo`, `ease-out-expo`, `ease-in-out-back`)

**Files:** Modify `packages/schema/src/easing.ts`, `packages/core/src/easing.ts`; Test `packages/core/test/easing.test.ts`

- [ ] **Step 1.1: Test que falla.** En `packages/core/test/easing.test.ts` añadir los 3 nombres al listado de curvas testeadas (el fichero ya itera endpoints `f(0)=0, f(1)=1`; seguir su patrón exacto).
- [ ] **Step 1.2:** Run: `pnpm --filter @telekinesis/core test` — Expected: FAIL (typecheck: las claves no existen).
- [ ] **Step 1.3: Schema.** En `EasingPattern` de `schema/src/easing.ts`, añadir al final del enum:

```ts
  // Added <fecha>: plan 1 backlog (docs/superpowers/plans/2026-07-06-01-…md).
  "ease-in-expo",
  "ease-out-expo",
  "ease-in-out-back",
```

- [ ] **Step 1.4: Core.** En `core/src/easing.ts` añadir a `cssEasing`:

```ts
  "ease-in-expo": "cubic-bezier(0.7, 0, 0.84, 0)",
  "ease-out-expo": "cubic-bezier(0.16, 1, 0.3, 1)",
  "ease-in-out-back": "cubic-bezier(0.68, -0.6, 0.32, 1.6)",
```

y a `jsEasing` (formas cerradas de easings.net):

```ts
  "ease-in-expo": (t) => (t === 0 ? 0 : Math.pow(2, 10 * t - 10)),
  "ease-out-expo": (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  "ease-in-out-back": (t) => {
    const c = 1.70158 * 1.525;
    return t < 0.5
      ? (Math.pow(2 * t, 2) * ((c + 1) * 2 * t - c)) / 2
      : (Math.pow(2 * t - 2, 2) * ((c + 1) * (2 * t - 2) + c) + 2) / 2;
  },
```

- [ ] **Step 1.5:** Run: `pnpm --filter @telekinesis/core test && pnpm typecheck` — Expected: PASS.
- [ ] **Step 1.6:** Commit: `feat(schema,core): add ease-in-expo, ease-out-expo, ease-in-out-back easings`

### Task 2: Efecto `pan` (paneo de cámara sin cambiar zoom)

**Files:** Modify `packages/schema/src/{effects,layout}.ts`, `packages/core/src/{overlay,effects,seek}.ts`; Test `packages/schema/test/effects-catalog.test.ts` (nuevo)

- [ ] **Step 2.1: Crear el test-catálogo que acompañará a todos los efectos nuevos.** Crear `packages/schema/test/effects-catalog.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { EFFECT_ACTIONS, EFFECT_BASE_DURATIONS, LANE_OF, parseTimesheet } from "../src";

/** Un timesheet mínimo válido con el efecto dado. */
const sheetWith = (effect: Record<string, unknown>) =>
  parseTimesheet({ timeline: [effect] });

describe("pan", () => {
  it("parsea con defaults", () => {
    const s = sheetWith({ action: "pan", frameId: "hero" });
    expect(s.timeline[0]).toMatchObject({ action: "pan", duration: 900, easing: "ease-in-out" });
  });
  it("exige frameId", () => {
    expect(() => sheetWith({ action: "pan" })).toThrow();
  });
});

describe("catálogo coherente", () => {
  it("toda action tiene lane y duración base", () => {
    for (const a of EFFECT_ACTIONS) {
      expect(LANE_OF[a]).toBeTruthy();
      expect(EFFECT_BASE_DURATIONS[a]).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2.2:** Run: `pnpm --filter @telekinesis/schema test` — Expected: FAIL (`pan` no existe).
- [ ] **Step 2.3: Schema.** En `schema/src/effects.ts`, junto a los efectos de cámara:

```ts
export const PanEffect = BaseEffect.extend({
  action: z.literal("pan"),
  /** Frame al que panear manteniendo la escala actual de la cámara. */
  frameId: z.string(),
  duration: z.number().min(0).default(900),
  easing: EasingPattern.default("ease-in-out"),
  soundProfile: SoundProfile.optional(),
});
export type PanEffect = z.infer<typeof PanEffect>;
```

Añadir `PanEffect` a la unión `Effect` y `"pan"` a `EFFECT_ACTIONS`. En `layout.ts`: `pan: "camera"` en `LANE_OF`, `pan: 900` en `EFFECT_BASE_DURATIONS`.

- [ ] **Step 2.4: Core.** El paneo es un `zoomTo` a la escala actual con foco nuevo — `Camera.solveTarget` ya re-ancla. En `overlay.ts` añadir:

```ts
  /** Panea la cámara para centrar `focus` (viewport coords) sin cambiar la escala. No-op visual a escala 1 salvo que ya exista pan acumulado. */
  pan(focus: Point, duration: number, easing: EasingPattern, signal?: AbortSignal): Promise<void> {
    return this.zoom(focus, this.camera.scale, duration, easing, signal);
  }
```

Nota: `camera` es `private readonly` — usar el getter existente `currentScale` (`this.zoom(focus, this.currentScale, …)`).
En `core/src/effects.ts`, case nuevo:

```ts
    case "pan": {
      const rect = getFrameRect(effect.frameId);
      if (rect) {
        await overlay.pan(rectCenter(rect), effect.duration, effect.easing, signal);
      }
      if (effect.soundProfile) ctx.mark(effect.soundProfile);
      return;
    }
```

En `seek.ts` — **persistente**: añadir case que llame a `overlay.pan(center, 0, INSTANT_EASING)`.

- [ ] **Step 2.5:** Run: `pnpm --filter @telekinesis/schema test && pnpm typecheck` — Expected: PASS (el guard `never` de `runEffect` obliga a que el case exista).
- [ ] **Step 2.6: Validación sensorial.** `pnpm playground`, en consola del navegador:
      `__telekinesis.runEffect({ action: "zoom-in", frameId: "pricing", scale: 1.3, duration: 800, easing: "ease-out", transformOrigin: "center", delayBefore: 0 })` y después `__telekinesis.runEffect({ action: "pan", frameId: "login", duration: 900, easing: "ease-in-out" })` — la cámara debe deslizarse al formulario sin cambiar el nivel de zoom. (Nota: `runEffect` espera efectos ya defaulted; pasar todos los campos como arriba.)
- [ ] **Step 2.7:** Commit: `feat: pan camera effect`

### Task 3: Efecto `pulse` (latido de atención sobre un frame)

**Files:** Modify `schema/src/{effects,layout}.ts`, `core/src/{overlay,effects}.ts`, test en `effects-catalog.test.ts`

- [ ] **Step 3.1: Test** (mismo patrón que Task 2): defaults `{ scale: 1.06, beats: 2, duration: 900 }`, exige `frameId`.
- [ ] **Step 3.2: Schema:**

```ts
export const PulseEffect = BaseEffect.extend({
  action: z.literal("pulse"),
  frameId: z.string(),
  /** Escala pico de cada latido. */
  scale: z.number().positive().default(1.06),
  /** Número de latidos. */
  beats: z.number().int().min(1).max(8).default(2),
  duration: z.number().min(0).default(900),
  soundProfile: SoundProfile.optional(),
});
```

Unión + `EFFECT_ACTIONS` + `LANE_OF: "interaction"` + base 900.

- [ ] **Step 3.3: Core.** En `overlay.ts` (junto a `shake`, misma firma de estilo):

```ts
  /** N latidos de escala sobre el elemento — atención sin robar el foco. WAAPI, transform-only. */
  async pulse(el: HTMLElement, scale: number, beats: number, duration: number, signal?: AbortSignal): Promise<void> {
    const frames: Keyframe[] = [];
    for (let b = 0; b < beats; b++) {
      frames.push({ transform: "scale(1)", offset: b / beats });
      frames.push({ transform: `scale(${scale})`, offset: (b + 0.5) / beats });
    }
    frames.push({ transform: "scale(1)", offset: 1 });
    el.animate(frames, { duration, easing: "ease-in-out" });
    await sleep(duration, signal);
  }
```

Case en `runEffect` (mismo esqueleto que `shake`: resolver `getFrameElement`, llamar, `mark`). `seek.ts`: momentáneo — **no** añadir case; añadir `pulse` al comentario de efectos sin estado persistente.

- [ ] **Step 3.4:** Run tests + typecheck. Expected: PASS.
- [ ] **Step 3.5:** Commit: `feat: pulse effect`

### Task 4: Efecto `glow` (halo de color alrededor de un frame)

**Files:** igual patrón. Lane nueva **`annotation`** (ver Step 4.3).

- [ ] **Step 4.1: Test:** defaults `{ color: "#7c5cff", duration: 1200, padding: 6 }`; exige `frameId`; y en el test de catálogo, `LANE_OF.glow === "annotation"`.
- [ ] **Step 4.2: Schema:**

```ts
export const GlowEffect = BaseEffect.extend({
  action: z.literal("glow"),
  frameId: z.string(),
  /** Color CSS del halo. */
  color: z.string().default("#7c5cff"),
  duration: z.number().min(0).default(1200),
  padding: z.number().min(0).default(6),
  soundProfile: SoundProfile.optional(),
});
```

- [ ] **Step 4.3: Lane `annotation`.** En `schema/src/layout.ts`: añadir `"annotation"` a `EffectLane` y `EFFECT_LANES` (al final), y `glow: "annotation"`. En `apps/studio/src/Timeline.tsx` añadir a `LANE_COLOR`: `annotation: "#ec4899"` (el `Record<EffectLane, string>` fuerza esto en typecheck).
- [ ] **Step 4.4: Core.** En `overlay.ts`:

```ts
  /** Halo suave que respira una vez alrededor de `rect` y se desvanece. Vive en la capa overlay. */
  async glow(rect: DOMRect, color: string, padding: number, duration: number, signal?: AbortSignal): Promise<void> {
    const el = document.createElement("div");
    Object.assign(el.style, {
      position: "absolute",
      left: `${rect.left - padding}px`,
      top: `${rect.top - padding}px`,
      width: `${rect.width + padding * 2}px`,
      height: `${rect.height + padding * 2}px`,
      borderRadius: "12px",
      pointerEvents: "none",
      boxShadow: `0 0 0 2px ${color}, 0 0 24px 6px ${color}`,
      opacity: "0",
      willChange: "opacity, transform",
    });
    getLayer().appendChild(el);
    el.animate(
      [
        { opacity: 0, transform: "scale(0.97)" },
        { opacity: 0.9, transform: "scale(1)", offset: 0.25 },
        { opacity: 0.55, transform: "scale(1.01)", offset: 0.7 },
        { opacity: 0, transform: "scale(1.02)" },
      ],
      { duration, easing: "ease-in-out" },
    );
    try {
      await sleep(duration, signal);
    } finally {
      el.remove();
    }
  }
```

Case en `runEffect` con `getFrameRect`. Seek: momentáneo (comentario).

- [ ] **Step 4.5:** Tests + typecheck + commit: `feat: glow effect and annotation lane`

### Task 5: `highlight` con variante `style: "blur"`

**Files:** Modify `schema/src/effects.ts` (campo opcional), `core/src/overlay.ts`; test de defaults.

- [ ] **Step 5.1: Test:** `highlight` sin `style` sigue parseando con `style: "dim"`; con `style: "blur"` parsea.
- [ ] **Step 5.2: Schema.** En `HighlightEffect` añadir campo aditivo:

```ts
  /** `dim` (actual): oscurece el resto. `blur`: desenfoca el resto (4 paneles con backdrop-filter; entra sin slide). */
  style: z.enum(["dim", "blur"]).default("dim"),
```

- [ ] **Step 5.3: Core.** En `Overlay.highlight`, si `opts.style === "blur"`: en lugar del box-shadow gigante, montar 4 paneles (top/bottom/left/right alrededor del cutout) con `backdropFilter: "blur(6px)"` + `background: rgba(0,0,0,0.18)`, pop-in de opacidad, sin FLIP-slide (documentado: un slide de 4 paneles no compensa su complejidad); reutilizar `breatheHighlight` solo sobre el outline. Mantener la ruta `dim` **byte a byte** como está. Añadir `style` a `HighlightOptions` y pasarlo desde `runEffect` y `seek` no (momentáneo).
- [ ] **Step 5.4:** Validación sensorial en playground (`style: "blur"` sobre `pricing`). Tests + typecheck + commit: `feat: highlight blur style`

### Task 6: `callout` y `caption` (anotaciones de texto)

**Files:** Create `packages/core/src/annotations.ts`; Modify schema/layout/effects/seek/Inspector; test de defaults.

- [ ] **Step 6.1: Tests:** `callout` exige `frameId` y `text`; defaults `{ placement: "auto", duration: 2000, maxWidth: 280 }`. `caption` exige `text`; defaults `{ duration: 2500, position: "bottom" }`. Lanes: `annotation`.
- [ ] **Step 6.2: Schema:**

```ts
export const CalloutEffect = BaseEffect.extend({
  action: z.literal("callout"),
  frameId: z.string(),
  /** Texto de la burbuja (una o dos líneas; sin markdown). */
  text: z.string().min(1),
  placement: z.enum(["auto", "top", "bottom", "left", "right"]).default("auto"),
  duration: z.number().min(0).default(2000),
  maxWidth: z.number().min(80).default(280),
  soundProfile: SoundProfile.optional(),
});

export const CaptionEffect = BaseEffect.extend({
  action: z.literal("caption"),
  /** Rótulo de "tercio inferior" para narrar el paso — no anclado a un frame. */
  text: z.string().min(1),
  /** Título opcional en negrita sobre el texto. */
  title: z.string().optional(),
  position: z.enum(["bottom", "top"]).default("bottom"),
  duration: z.number().min(0).default(2500),
  soundProfile: SoundProfile.optional(),
});
```

Base durations: `callout: 2000`, `caption: 2500`.

- [ ] **Step 6.3: Core — `packages/core/src/annotations.ts`** (módulo nuevo; el overlay ya es grande y esto es un dominio propio — texto sobre la capa):

```ts
import { getLayer } from "./layer";
import { sleep } from "./timing";

const BUBBLE_BASE: Partial<CSSStyleDeclaration> = {
  position: "absolute",
  pointerEvents: "none",
  background: "rgba(17, 24, 39, 0.94)",
  color: "#f9fafb",
  font: "500 14px/1.45 system-ui, -apple-system, sans-serif",
  padding: "10px 14px",
  borderRadius: "10px",
  boxShadow: "0 6px 24px rgba(0,0,0,0.35)",
  willChange: "transform, opacity",
  zIndex: "3",
};

/** Elige el lado con más espacio libre en viewport cuando placement es "auto". */
export function resolvePlacement(
  rect: DOMRect,
  placement: "auto" | "top" | "bottom" | "left" | "right",
): "top" | "bottom" | "left" | "right" {
  if (placement !== "auto") return placement;
  const room = {
    top: rect.top,
    bottom: window.innerHeight - rect.bottom,
    left: rect.left,
    right: window.innerWidth - rect.right,
  };
  return (Object.entries(room).sort((a, b) => b[1] - a[1])[0][0]) as
    "top" | "bottom" | "left" | "right";
}

export async function showCallout(
  rect: DOMRect,
  opts: { text: string; placement: "auto" | "top" | "bottom" | "left" | "right"; maxWidth: number; duration: number; signal?: AbortSignal },
): Promise<void> {
  const side = resolvePlacement(rect, opts.placement);
  const el = document.createElement("div");
  el.textContent = opts.text;
  Object.assign(el.style, BUBBLE_BASE, { maxWidth: `${opts.maxWidth}px`, opacity: "0" });
  getLayer().appendChild(el);
  const gap = 12;
  const b = el.getBoundingClientRect(); // medir tras montar
  const pos = {
    top:    { x: rect.left + rect.width / 2 - b.width / 2, y: rect.top - b.height - gap },
    bottom: { x: rect.left + rect.width / 2 - b.width / 2, y: rect.bottom + gap },
    left:   { x: rect.left - b.width - gap, y: rect.top + rect.height / 2 - b.height / 2 },
    right:  { x: rect.right + gap, y: rect.top + rect.height / 2 - b.height / 2 },
  }[side];
  // Clamp al viewport (8px de margen) para que nunca se corte.
  const x = Math.max(8, Math.min(pos.x, window.innerWidth - b.width - 8));
  const y = Math.max(8, Math.min(pos.y, window.innerHeight - b.height - 8));
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  const enterFrom = side === "top" ? "translateY(6px)" : side === "bottom" ? "translateY(-6px)" : side === "left" ? "translateX(6px)" : "translateX(-6px)";
  el.animate(
    [
      { opacity: 0, transform: `${enterFrom} scale(0.96)` },
      { opacity: 1, transform: "none", offset: 0.12 },
      { opacity: 1, transform: "none", offset: 0.88 },
      { opacity: 0, transform: "scale(0.98)" },
    ],
    { duration: opts.duration, easing: "ease-in-out", fill: "forwards" },
  );
  try {
    await sleep(opts.duration, opts.signal);
  } finally {
    el.remove();
  }
}

export async function showCaption(opts: {
  text: string; title?: string; position: "bottom" | "top"; duration: number; signal?: AbortSignal;
}): Promise<void> {
  const el = document.createElement("div");
  if (opts.title) {
    const t = document.createElement("div");
    t.textContent = opts.title;
    t.style.cssText = "font-weight:700;font-size:15px;margin-bottom:2px";
    el.appendChild(t);
  }
  el.appendChild(document.createTextNode(opts.text));
  Object.assign(el.style, BUBBLE_BASE, {
    left: "50%",
    [opts.position]: "6%",
    transform: "translateX(-50%)",
    maxWidth: "min(560px, 72vw)",
    textAlign: "center",
    opacity: "0",
  });
  getLayer().appendChild(el);
  const slide = opts.position === "bottom" ? "12px" : "-12px";
  el.animate(
    [
      { opacity: 0, transform: `translateX(-50%) translateY(${slide})` },
      { opacity: 1, transform: "translateX(-50%)", offset: 0.1 },
      { opacity: 1, transform: "translateX(-50%)", offset: 0.9 },
      { opacity: 0, transform: `translateX(-50%) translateY(${slide})` },
    ],
    { duration: opts.duration, easing: "ease-in-out", fill: "forwards" },
  );
  try {
    await sleep(opts.duration, opts.signal);
  } finally {
    el.remove();
  }
}
```

- [ ] **Step 6.4:** Cases en `runEffect` (callout: `getFrameRect`; caption directo). Seek: momentáneos. Export en `core/src/index.ts` (`showCallout`, `showCaption`, `resolvePlacement` para tests).
- [ ] **Step 6.5: Inspector.** En `apps/studio/src/Inspector.tsx` añadir campos: `text` (input, para `callout`/`caption` — reutilizar el bloque de `type-down` generalizándolo a `action === "type-down" || action === "callout" || action === "caption"`), `title` y `position` (caption), `placement` y `maxWidth` (callout).
- [ ] **Step 6.6:** Tests + typecheck + validación en playground (callout sobre `tier-pro`, caption "Paso 1 — elige tu plan"). Commit: `feat: callout and caption text annotations`

### Task 7: `letterbox` (barras de cine — estado persistente)

- [ ] **Step 7.1: Test:** defaults `{ enabled: true, coverage: 0.1, duration: 600 }`; `coverage` acotado (0.02–0.25).
- [ ] **Step 7.2: Schema:**

```ts
export const LetterboxEffect = BaseEffect.extend({
  action: z.literal("letterbox"),
  /** true = entra el modo cine; false = sale. */
  enabled: z.boolean().default(true),
  /** Alto de cada barra como fracción del viewport. */
  coverage: z.number().min(0.02).max(0.25).default(0.1),
  duration: z.number().min(0).default(600),
  soundProfile: SoundProfile.optional(),
});
```

Lane `camera`, base 600.

- [ ] **Step 7.3: Core.** En `overlay.ts`, estado nuevo `private letterboxEls: [HTMLElement, HTMLElement] | null` + método:

```ts
  /** Barras negras top/bottom. Idempotente: enable sobre enable re-anima a la nueva cobertura. duration<=0 = snap (seek). */
  async letterbox(enabled: boolean, coverage: number, duration: number, signal?: AbortSignal): Promise<void> { … }
```

Implementación: dos `div` `position:absolute; left:0; right:0; background:#000; zIndex:4` (top: `top:0`, bottom: `bottom:0`), animar `height` de su valor actual a `coverage*100vh` (o a 0 y `remove()` al salir) con `animate()` sobre `transform: scaleY` — usar `height` directo con transición CSS es aceptable aquí (2 elementos, una vez). Guardar refs para idempotencia.

- [ ] **Step 7.4: Seek — persistente.** Case en `seek.ts` `applyPersistent`: `overlay.letterbox(effect.enabled, effect.coverage, 0)`. Y en el baseline del `seekTo` (junto a `resetZoom`): `overlay.letterbox(false, 0.1, 0)` para que cada scrub parta de página limpia.
- [ ] **Step 7.5:** Tests + typecheck + playground + commit: `feat: letterbox effect`

### Task 8: `cursor-hide` / `cursor-show`

- [ ] **Step 8.1: Test:** ambos parsean sin campos; base 200; lane `cursor`.
- [ ] **Step 8.2: Schema:** dos efectos mínimos (`action` literal + `BaseEffect`), sin `frameId`. **Core:** `cursor.hide()` / `cursor.show()` + `sleep(200)` (la transición de opacidad de 200 ms ya existe en `cursor.ts`). **Seek — persistente:** case que llame a `cursor.hide()`/`show()` (nota: `seekTo` hace `cursor.show()` como baseline; el case de `cursor-hide` lo revierte si el último efecto empezado lo pide).
- [ ] **Step 8.3:** Tests + typecheck + commit: `feat: cursor-hide and cursor-show effects`

### Task 9: `hover` (I/O real en el engine)

- [ ] **Step 9.1: Test:** exige `frameId`; defaults `{ duration: 600, dwell: 500 }`; lane `interaction`.
- [ ] **Step 9.2: Schema:**

```ts
export const HoverEffect = BaseEffect.extend({
  action: z.literal("hover"),
  frameId: z.string(),
  /** Viaje del cursor hasta el frame. */
  duration: z.number().min(0).default(600),
  /** Tiempo posado sobre el frame (el :hover "se cocina" aquí). */
  dwell: z.number().min(0).default(500),
  soundProfile: SoundProfile.optional(),
});
```

- [ ] **Step 9.3: Core** (case en `runEffect`): mover cursor al centro del frame (`cursor.moveTo`), en `self` mode despachar `pointerover/pointerenter/mouseover/mouseenter` burbujeantes sobre el elemento, `sleep(dwell)`. **Engine** (`record.ts`): case explícito **antes** del `default`:

```ts
    case "hover": {
      await runVisual(page, eff);            // ghost cursor viaja y posa
      await frameLocator(page, eff.frameId).hover({ force: true }); // :hover CSS real
      await page.waitForTimeout(eff.dwell);
      mark(eff.soundProfile);
      return;
    }
```

(Nota `force: true`: la capa de cámara mantiene el transform en movimiento por diseño — mismo razonamiento que el click forzado en `record.ts:130-135`.) Seek: momentáneo salvo posición del cursor → tratar como `cursor-move` (case que hace `cursor.place(center)`).

- [ ] **Step 9.4:** Tests + typecheck + commit: `feat: hover effect with real :hover in recordings`

### Task 10: `press-key` (tecla física + keycap visual)

- [ ] **Step 10.1: Test:** exige `key` (string no vacío); defaults `{ duration: 450 }`; lane `interaction`.
- [ ] **Step 10.2: Schema:**

```ts
export const PressKeyEffect = BaseEffect.extend({
  action: z.literal("press-key"),
  /** Nombre Playwright de la tecla: "Enter", "Escape", "Tab", "ArrowDown", "Meta+k"… */
  key: z.string().min(1),
  /** Vida del keycap visual en pantalla. */
  duration: z.number().min(0).default(450),
  soundProfile: SoundProfile.optional(),
});
```

- [ ] **Step 10.3: Core.** En `annotations.ts` añadir `showKeycap(key, duration, signal)`: chip `<kbd>`-style (fondo #111827, borde inferior grueso, monospace, esquina inferior-derecha del viewport, `press` = translateY(2px) al 30% del timeline) en la capa overlay. Case en `runEffect`: mostrar keycap; en `self` mode además `document.activeElement?.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }))` (best-effort — documentar que el submit real solo ocurre en grabación). **Engine:** case explícito: `await page.keyboard.press(eff.key)` + `runVisual` + `mark`. Seek: momentáneo.
- [ ] **Step 10.4:** Tests + typecheck + commit: `feat: press-key effect (real keyboard in recordings, keycap overlay)`

### Task 11: `confetti` + perfil de sonido `chime`

**Files:** Create `packages/core/src/confetti.ts`; Modify `schema/src/{effects,layout,sound}.ts`, `core/src/{effects,sound}.ts`, `packages/render/src/synth/voices.ts`

- [ ] **Step 11.1: Tests:** confetti defaults `{ particles: 80, duration: 1400, seed: 7 }`, lane `annotation`; y en schema/sound: `SOUND_PROFILE_IDS` incluye `chime` con `cadence: "once"`.
- [ ] **Step 11.2: Schema (efecto):**

```ts
export const ConfettiEffect = BaseEffect.extend({
  action: z.literal("confetti"),
  /** Origen del estallido; sin frameId estalla en el centro del viewport. */
  frameId: z.string().optional(),
  particles: z.number().int().min(8).max(240).default(80),
  duration: z.number().min(0).default(1400),
  /** Semilla determinista — misma semilla, mismo confetti (GIFs reproducibles en CI). */
  seed: z.number().int().default(7),
  soundProfile: SoundProfile.optional(),
});
```

- [ ] **Step 11.3: Core — `confetti.ts`:** PRNG `mulberry32(seed)`; `particles` divs de 6–10 px (paleta fija de 5 colores de marca), lanzados desde el origen con velocidad/ángulo/rotación muestreados del PRNG; animación por partícula con WAAPI: `transform: translate(x(t), y(t)) rotate(θ(t))` en 3 keyframes (salida balística: subida rápida, caída con gravedad — precomputar los 3 puntos con física simple `y = v·t − ½g·t²`), `opacity` 1→1→0. Todo transform/opacity, cleanup en `finally`. Case en `runEffect` (origen = `rectCenter(getFrameRect(frameId))` o centro viewport). Seek: momentáneo.
- [ ] **Step 11.4: Sonido `chime`.** (1) `schema/src/sound.ts`: añadir `"chime"` al enum y al catálogo:

```ts
  chime: {
    id: "chime",
    label: "Chime",
    description: "Bright two-note success chime for celebrations and completed flows.",
    asset: "chime.wav",
    cadence: "once",
    synth: { gain: 0.6, variation: false },
  },
```

(2) `core/src/sound.ts`: voz Web Audio `scheduleChime` — dos `scheduleBody` con `attackMs` (nota 1: 880→880 Hz, decay 180 ms; nota 2 a +90 ms: 1318→1318 Hz (E6), decay 260 ms; ambas sin glide) + entrada en `SATURATION_DRIVE` (`chime: 1.2`) + case en `scheduleVoice` (el guard `never` obliga). (3) `render/src/synth/voices.ts`: voz offline equivalente con las primitivas existentes (`bodyLayer`/`attackDecayEnvelope`) — replicar frecuencias/tiempos de (2); `synthSounds` itera `SOUND_PROFILES`, así que el WAV nuevo sale solo. (4) Regenerar el pack committeado: `pnpm --filter @telekinesis/cli telekinesis sounds -- -o assets/sounds` (el comando corre con cwd `packages/cli`, así que escribe en `packages/cli/assets/sounds/` — verificado en `commands/sounds.ts`).
- [ ] **Step 11.5:** Escuchar el WAV (`afplay packages/cli/assets/sounds/chime.wav`) y el live preview en playground. Tests + typecheck + commit: `feat: confetti effect and chime sound profile`

### Task 12: Studio Inspector + test de cobertura de documentación

- [ ] **Step 12.1: Inspector.** Revisar `apps/studio/src/Inspector.tsx` contra los 9 efectos nuevos: añadir los campos no cubiertos (`scale`+`beats` de pulse, `color`+`padding` de glow, `style` de highlight, `coverage`+`enabled` de letterbox, `key` de press-key, `particles`+`seed` de confetti, `dwell` de hover) siguiendo los helpers `num`/`frameSelect` existentes; los selects de enums (placement/position/style) como el select de `soundProfile`. `hasDuration` en Inspector y `RESIZABLE_ACTIONS` en Timeline siguen siendo válidos por derivación (todos los nuevos llevan `duration`).
- [ ] **Step 12.2: Test de cobertura de docs.** Crear `packages/schema/test/docs-coverage.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { EFFECT_ACTIONS } from "../src";

const effectsMd = readFileSync(
  fileURLToPath(new URL("../../../docs/effects.md", import.meta.url)),
  "utf8",
);

describe("docs/effects.md", () => {
  it.each([...EFFECT_ACTIONS])("documenta `%s`", (action) => {
    expect(effectsMd).toMatch(new RegExp(`^### \\\`${action}\\\``, "m"));
  });
});
```

- [ ] **Step 12.3:** Run: `pnpm --filter @telekinesis/schema test` — Expected: FAIL para los 9 efectos nuevos (docs aún sin escribir). Ese rojo es el driver de la Task 13.
- [ ] **Step 12.4:** Commit: `feat(studio): inspector fields for new effects; test: docs coverage gate`

### Task 13: Documentación completa

**Files:** Modify `docs/effects.md`, `apps/docs/src/content/effects.mdx`, `apps/docs/telekinesis/sections.ts`, `playground/src/demo.ts`

- [ ] **Step 13.1: `docs/effects.md`.** Añadir una sección `### \`<action>\`` por efecto nuevo con el formato existente (tabla de campos + una línea de "cuándo usarlo"), en las secciones: Interactions (`hover`, `press-key`, `pulse`), Camera & navigation (`pan`, `letterbox`), **nueva** sección Annotations (`callout`, `caption`, `glow`, `confetti`), Cursor (`cursor-hide`, `cursor-show`). Documentar también los 3 easings nuevos en la línea de easing del encabezado y el perfil `chime` en la línea de soundProfile.
- [ ] **Step 13.2:** Run: `pnpm --filter @telekinesis/schema test` — Expected: PASS (cobertura completa).
- [ ] **Step 13.3: Docs site.** En `apps/docs/src/content/effects.mdx` reflejar las mismas secciones. En `apps/docs/telekinesis/sections.ts`, ampliar el timesheet de `effects` con un beat por efecto nuevo (callout sobre `fx-highlight`, caption, pulse, glow, confetti al final con `chime`) — esto alimenta el GIF autogenerado de la página.
- [ ] **Step 13.4: Playground.** Extender `playground/src/demo.ts` con un acto 5 "nuevas incorporaciones": `pan` → `callout` → `pulse` → `press-key Enter` → `confetti` + `caption` de cierre.
- [ ] **Step 13.5:** Validación sensorial: `pnpm playground` y reproducir el tour completo; `pnpm docs` y "Play live" en /effects.
- [ ] **Step 13.6:** Commit: `docs: full reference for the expanded effects vocabulary`

### Task 14: Puerta de calidad final

- [ ] **Step 14.1:** Run: `pnpm typecheck && pnpm test && pnpm build` — Expected: todo PASS.
- [ ] **Step 14.2:** Grabación real de humo: `pnpm --filter @telekinesis/playground build && pnpm --filter @telekinesis/playground preview &`, luego `pnpm --filter @telekinesis/cli telekinesis record examples/landing-demo.timesheet.json -- -u http://localhost:4173/landing.html?demo -o /tmp/plan1-smoke.mp4` — Expected: MP4 con sonido, sin errores. Matar el preview al acabar.
- [ ] **Step 14.3:** Commit final si quedó algo suelto + abrir PR `feat: effects vocabulary expansion (11 → 20 effects)`.

---

## Definición de hecho

- 22 acciones en `EFFECT_ACTIONS`, todas con lane, duración base, handler, decisión de seek, campos de Inspector y sección en `docs/effects.md` (test de cobertura en verde).
- 12 easings; 6 perfiles de sonido con WAV regenerado y voz doble (Web Audio + PCM).
- `pnpm typecheck && pnpm test && pnpm build` verdes; grabación de humo reproducible.
- Ningún valor de enum renombrado ni eliminado; `examples/*.timesheet.json` siguen parseando sin cambios.
