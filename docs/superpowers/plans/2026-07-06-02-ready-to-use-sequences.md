# Plan 2 — Secuencias de animación ready-to-use

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Una librería de secuencias parametrizadas y con nombre (`form-fill`, `cta-click`, `feature-tour`, `login`…) que se expanden a efectos planos validados — usables desde un timesheet (`{ "use": "form-fill", "with": {...} }`), desde el Studio, desde el CLI y desde el MCP, para que "escribir un demo" pase de 20 líneas de efectos a 4 líneas de intención.

**Architecture:** Las secuencias viven en `@telekinesis/schema` (`sequences.ts`): cada una es `{ id, label, description, params: ZodSchema, expand(params) => EffectInput[] }`. El formato *autorado* (`AuthoredTimesheet`) admite en `timeline` tanto efectos como llamadas `SequenceCall`; `expandTimesheet()` lo reduce al formato *ejecutable* (`Timesheet`, sin cambios). La expansión es **temprana e idempotente**: `play()` (core), `loadTimesheet()` (CLI) y el draft del MCP expanden antes de validar; el motor, el renderer, el seek y el Studio siguen viendo solo efectos planos — cero cambios en engine/render y el `timeline[]` sigue siendo la única fuente de verdad del Studio (insertar una secuencia = expandirla en el acto).

**Tech Stack:** Zod, TypeScript strict, Vitest. Sin dependencias nuevas.

**Dependencias con otros planes:** Ninguna dura. Si el Plan 1 ya aterrizó, `login` y `search-and-reveal` ganan variantes (`press-key: Enter`, `confetti`) — marcadas como opcionales en cada task.

---

## Estado del arte (verificado)

- No existe ningún concepto de secuencia/preset/macro. Los patrones se repiten copiados a mano: el trío `cursor-move → click → type-down` aparece 2 veces en `playground/src/demo.ts`, 1 en `examples/landing-demo.timesheet.json` y otra en el generador heurístico del MCP (`packages/mcp/src/draft.ts:56-74`), con pacings ligeramente distintos cada vez — exactamente lo que una secuencia canoniza.
- `Timesheet.timeline` es `z.array(Effect).min(1)` con `superRefine` para destinos (`schema/src/timesheet.ts:26-51`).
- `parseTimesheet` se llama en: `core/src/player.ts:33`, `core/src/seek.ts:55`, `engine/src/record.ts:55`, CLI `io.ts`, MCP valida con `safeParseTimesheet`.
- El Studio añade efectos con objetos planos (`App.tsx addEffect`) y el palette ya lista frames descubiertos — punto de enganche natural para "insertar secuencia con estos frames".

## Reglas duras

1. **`Timesheet` (ejecutable) no cambia.** Nada de `SequenceCall` llega jamás a `runEffect`/`record`/`seekTo`. La compatibilidad es total: todo timesheet actual sigue siendo válido tal cual (un `AuthoredTimesheet` cuyo timeline solo tiene efectos es byte-idéntico tras expandir).
2. **Expansión determinista y pura:** `expand(params)` no toca DOM ni red; misma entrada → misma salida (los GIFs de CI dependen de ello).
3. **Validación en dos fases con errores útiles:** primero los `params` de cada llamada contra su schema (error apuntando a `timeline[i].with.<campo>`), después el resultado completo contra `Timesheet` (una secuencia jamás puede expandir a algo imposible de reproducir).
4. IDs de secuencia en kebab-case; el catálogo solo crece (mismas reglas aditivas que los enums).

## Mapa de ficheros

- **Crear:** `packages/schema/src/sequences.ts`, `packages/schema/test/sequences.test.ts`, `packages/cli/src/commands/sequences.ts`, `examples/sequences-demo.timesheet.json`, `docs/sequences.md`, `apps/docs/src/content/sequences.mdx`
- **Modificar:** `packages/schema/src/index.ts`, `packages/core/src/player.ts`, `packages/cli/src/io.ts`, `packages/cli/src/cli.ts`, `packages/mcp/src/{index,draft}.ts`, `apps/studio/src/App.tsx`, `apps/docs/src/content/_meta.js`, `README.md` (mención breve)

---

### Task 1: Núcleo — `SequenceCall`, `AuthoredTimesheet`, `expandTimesheet`

**Files:** Create `packages/schema/src/sequences.ts`, `packages/schema/test/sequences.test.ts`; Modify `packages/schema/src/index.ts`

- [ ] **Step 1.1: Tests que fallan.** Crear `packages/schema/test/sequences.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  expandTimesheet,
  parseTimesheet,
  SEQUENCE_IDS,
  SEQUENCES,
} from "../src";

describe("expandTimesheet", () => {
  it("deja pasar un timesheet de solo efectos, intacto", () => {
    const sheet = { timeline: [{ action: "wait", duration: 500 }] };
    expect(expandTimesheet(sheet).timeline).toEqual(sheet.timeline);
  });

  it("expande una llamada a secuencia a efectos planos válidos", () => {
    const sheet = {
      timeline: [
        { use: "cta-click", with: { frameId: "buy" } },
      ],
    };
    const flat = expandTimesheet(sheet);
    expect(flat.timeline.every((e) => "action" in e)).toBe(true);
    expect(() => parseTimesheet(flat)).not.toThrow();
    expect(flat.timeline.map((e: any) => e.action)).toEqual([
      "cursor-move", "click",
    ]);
  });

  it("es idempotente", () => {
    const once = expandTimesheet({ timeline: [{ use: "cta-click", with: { frameId: "x" } }] });
    expect(expandTimesheet(once)).toEqual(once);
  });

  it("rechaza un id desconocido con la ruta del error", () => {
    expect(() => expandTimesheet({ timeline: [{ use: "nope" }] }))
      .toThrow(/timeline\[0\].*nope/);
  });

  it("valida los params contra el schema de la secuencia", () => {
    expect(() => expandTimesheet({ timeline: [{ use: "cta-click", with: {} }] }))
      .toThrow(/frameId/);
  });

  it("propaga delayBefore/delayAfter de la llamada al primer/último efecto", () => {
    const flat = expandTimesheet({
      timeline: [{ use: "cta-click", with: { frameId: "x" }, delayBefore: 300, delayAfter: 700 }],
    });
    expect((flat.timeline[0] as any).delayBefore).toBe(300);
    expect((flat.timeline.at(-1) as any).delayAfter).toBe(700);
  });
});

describe("catálogo", () => {
  it("todas las secuencias expanden a un timesheet parseable con params de ejemplo", () => {
    for (const id of SEQUENCE_IDS) {
      const seq = SEQUENCES[id];
      const effects = seq.expand(seq.params.parse(seq.example));
      expect(effects.length, id).toBeGreaterThan(0);
      expect(() => parseTimesheet({ timeline: effects }), id).not.toThrow();
    }
  });
});
```

- [ ] **Step 1.2:** Run: `pnpm --filter @telekinesis/schema test` — Expected: FAIL (módulo inexistente).
- [ ] **Step 1.3: Implementación.** Crear `packages/schema/src/sequences.ts`:

```ts
import { z } from "zod";
import { Effect } from "./effects";
import { Timesheet, type TimesheetInput } from "./timesheet";

/** Efecto tal como se autora (antes de defaults). */
type EffectInput = z.input<typeof Effect>;

/**
 * Una llamada a secuencia dentro de un timeline autorado. Se distingue de un
 * efecto por la clave `use` (los efectos llevan `action`). `with` son los
 * parámetros; delayBefore/After se propagan al primer/último efecto expandido.
 */
export const SequenceCall = z
  .object({
    use: z.string(),
    with: z.record(z.unknown()).optional(),
    delayBefore: z.number().min(0).optional(),
    delayAfter: z.number().min(0).optional(),
    /** Nota del editor; se copia al primer efecto expandido. */
    note: z.string().optional(),
  })
  .strict();
export type SequenceCall = z.infer<typeof SequenceCall>;

export interface SequenceDef<P extends z.ZodTypeAny = z.ZodTypeAny> {
  id: string;
  label: string;
  description: string;
  /** Schema de parámetros (con defaults). */
  params: P;
  /** Params de ejemplo, para docs, tests y el listado del CLI/MCP. */
  example: z.input<P>;
  expand: (params: z.output<P>) => EffectInput[];
}

/* Catálogo: se rellena en las Tasks 2-4. */
export const SEQUENCES: Record<string, SequenceDef> = {};
export const SEQUENCE_IDS: string[] = []; // mantenido en orden de registro

export function registerSequence<P extends z.ZodTypeAny>(def: SequenceDef<P>): void {
  SEQUENCES[def.id] = def as unknown as SequenceDef;
  SEQUENCE_IDS.push(def.id);
}

/** Timeline autorado: efectos y/o llamadas a secuencia, entremezclados. */
const AuthoredEntry = z.union([SequenceCall, Effect]);
export const AuthoredTimesheet = Timesheet.innerType()
  .extend({ timeline: z.array(AuthoredEntry).min(1) })
  .passthrough();
export type AuthoredTimesheetInput = z.input<typeof AuthoredTimesheet>;

function isCall(entry: unknown): entry is SequenceCall {
  return typeof entry === "object" && entry !== null && "use" in entry && !("action" in entry);
}

/**
 * Reduce un timesheet autorado al formato ejecutable: cada `SequenceCall` se
 * sustituye por sus efectos. Idempotente (un sheet plano pasa intacto). El
 * resultado NO lleva defaults aplicados — sigue siendo `TimesheetInput`, listo
 * para `parseTimesheet` (que es quien valida el conjunto).
 */
export function expandTimesheet(input: unknown): TimesheetInput {
  const sheet = input as { timeline?: unknown[] } & Record<string, unknown>;
  if (!Array.isArray(sheet?.timeline)) {
    // Sin timeline que expandir: que parseTimesheet dé su error habitual.
    return input as TimesheetInput;
  }
  const timeline: unknown[] = [];
  sheet.timeline.forEach((entry, i) => {
    if (!isCall(entry)) {
      timeline.push(entry);
      return;
    }
    const call = SequenceCall.parse(entry);
    const def = SEQUENCES[call.use];
    if (!def) {
      throw new Error(
        `timeline[${i}]: unknown sequence "${call.use}". Known: ${SEQUENCE_IDS.join(", ")}`,
      );
    }
    const params = def.params.safeParse(call.with ?? {});
    if (!params.success) {
      throw new Error(
        `timeline[${i}] (${call.use}): invalid params — ${params.error.issues
          .map((iss) => `${["with", ...iss.path].join(".")}: ${iss.message}`)
          .join("; ")}`,
      );
    }
    const effects = def.expand(params.data).map((e) => ({ ...e }));
    if (effects.length === 0) return;
    if (call.delayBefore != null) effects[0].delayBefore = call.delayBefore;
    if (call.note != null) effects[0].note = call.note;
    if (call.delayAfter != null) effects[effects.length - 1].delayAfter = call.delayAfter;
    timeline.push(...effects);
  });
  return { ...sheet, timeline } as TimesheetInput;
}
```

Nota de implementación: `Timesheet` lleva `superRefine`, por lo que `.innerType()` es necesario para extender; comprobar que la versión de Zod del repo (3.23) lo expone como `ZodEffects#innerType()` — si `Timesheet.innerType()` no existe por el encadenado, definir `AuthoredTimesheet` desde los shapes base (duplicar los 6 campos es aceptable; dejar comentario). Exportar todo desde `schema/src/index.ts` (`export * from "./sequences"`).

- [ ] **Step 1.4:** Registrar la primera secuencia para que los tests corran — `cta-click` (es la más pequeña; el resto en Task 2):

```ts
registerSequence({
  id: "cta-click",
  label: "CTA click",
  description: "Cursor travels to a call-to-action and clicks it (optional anticipation shake).",
  params: z.object({
    frameId: z.string(),
    anticipation: z.boolean().default(false),
    travelMs: z.number().min(0).default(650),
    soundProfile: SoundProfile.default("macbook-trackpad"), // import desde "./sound" — tipado real, sin casts
  }),
  example: { frameId: "buy" },
  expand: (p) => [
    { action: "cursor-move", destFrameId: p.frameId, duration: p.travelMs },
    ...(p.anticipation
      ? [{ action: "shake", frameId: p.frameId, intensity: "low", duration: 320 } as const]
      : []),
    { action: "click", frameId: p.frameId, soundProfile: p.soundProfile, delayAfter: 300 },
  ],
});
```

(Con `anticipation: true` el test de "expande a [cursor-move, click]" usa `anticipation` en false por defecto — coherente.)

- [ ] **Step 1.5:** Run: `pnpm --filter @telekinesis/schema test` — Expected: PASS.
- [ ] **Step 1.6:** Commit: `feat(schema): sequence calls, authored timesheets and expandTimesheet`

### Task 2: Catálogo — secuencias de interacción (`form-fill`, `login`, `error-recovery`, `search-and-reveal`)

**Files:** Modify `packages/schema/src/sequences.ts`; Test `packages/schema/test/sequences.test.ts`

- [ ] **Step 2.1: Tests primero** (uno por secuencia, patrón de la Task 1: expansión con `example` parsea; conteo de actions esperado; un caso de params inválidos).
- [ ] **Step 2.2: `form-fill`:**

```ts
registerSequence({
  id: "form-fill",
  label: "Form fill",
  description: "Fill a list of fields like a human: travel, click, type — per field.",
  params: z.object({
    fields: z.array(z.object({
      frameId: z.string(),
      text: z.string(),
      mistakes: z.boolean().default(false),
    })).min(1),
    typingSpeed: z.number().min(0).default(60),
    soundProfile: z.string().default("mechanical-keyboard"),
  }),
  example: { fields: [{ frameId: "email", text: "ada@telekinesis.dev" }] },
  expand: (p) =>
    p.fields.flatMap((f) => [
      { action: "cursor-move", destFrameId: f.frameId, duration: 600 },
      { action: "click", frameId: f.frameId },
      {
        action: "type-down", frameId: f.frameId, text: f.text,
        typingSpeed: p.typingSpeed, mistakes: f.mistakes,
        soundProfile: p.soundProfile as never, delayAfter: 250,
      },
    ]),
});
```

- [ ] **Step 2.3: `login`:** `params: { emailId, passwordId, submitId, email (default "ada@telekinesis.dev"), password (default "l0vel@ce"), anticipation (default true) }` → expande a `form-fill(email, password)` + `cta-click(submitId, anticipation)` **componiendo**: `expand: (p) => [...SEQUENCES["form-fill"].expand(…), ...SEQUENCES["cta-click"].expand(…)]` (validar sub-params con `.params.parse` para heredar defaults). Sinergia futura: el Plan 4 conecta estas credenciales mock con `<TelekineticLogin>`.
- [ ] **Step 2.4: `error-recovery`:** `params: { fieldId, wrongText, rightText, submitId? }` → type-down(wrong) → shake(field, medium) → type-down(right, mistakes: false) → cta-click(submit) si hay submitId. Nota en el primer efecto: `"error → recovery beat"`.
- [ ] **Step 2.5: `search-and-reveal`:** `params: { inputId, query, resultId, submitId? }` → cursor-move+click(input) → type-down(query) → (si submitId: cta-click; **opcional Plan 1:** si no hay submitId y existe `press-key` en `EFFECT_ACTIONS`, emitir `{ action: "press-key", key: "Enter" }`, si no, `wait 400`) → highlight(resultId) + zoom-in(resultId, 1.15) + zoom-out.
- [ ] **Step 2.6:** Run tests — PASS. Commit: `feat(schema): interaction sequences (form-fill, login, error-recovery, search-and-reveal)`

### Task 3: Catálogo — secuencias de cámara/narrativa (`intro-establish`, `feature-tour`, `pricing-pick`, `scroll-tour`, `outro-reset`)

- [ ] **Step 3.1: Tests primero** (mismo patrón).
- [ ] **Step 3.2: `intro-establish`:** `params: { containerId, heroId?, scale (1.12), holdMs (1200) }` → wait 400 → zoom-in(container, scale, ease-out) → highlight(heroId ?? containerId, holdMs).
- [ ] **Step 3.3: `feature-tour`:** `params: { stops: [{ frameId, holdMs? }] (min 1), zoomScale (1.14), zoomBetween (true) }` → por parada: highlight(frameId, holdMs ?? 1100) → zoom-in(frameId) → zoom-out (si zoomBetween) — con `delayAfter: 200` entre paradas. Este es el patrón exacto del timesheet `hero` de `apps/docs/telekinesis/sections.ts:22-39`, canonizado.
- [ ] **Step 3.4: `pricing-pick`:** `params: { tableId, tierId, ctaId }` → intro-establish(tableId, tierId) + cta-click(ctaId, anticipation: true). (El demo del playground casi entero, en una línea.)
- [ ] **Step 3.5: `scroll-tour`:** `params: { screens (int 1-6, default 2), highlightIds (array opcional alineado por pantalla) }` → por pantalla: scroll-down(viewport) → highlight si hay id.
- [ ] **Step 3.6: `outro-reset`:** `params: { finalFrameId? }` → zoom-out(800) → highlight(finalFrameId, 1600) si hay → wait 1500. (**Opcional Plan 1:** cerrar con `confetti` + `chime` si `EFFECT_ACTIONS` lo incluye — comprobar en runtime, igual que Step 2.5.)
- [ ] **Step 3.7:** Tests + commit: `feat(schema): narrative sequences (intro, feature-tour, pricing-pick, scroll-tour, outro)`

### Task 4: `play()` acepta sheets autorados + ejemplo ejecutable

**Files:** Modify `packages/core/src/player.ts`; Create `examples/sequences-demo.timesheet.json`

- [ ] **Step 4.1:** En `core/src/player.ts`, primera línea de `play()`: `const sheet = parseTimesheet(expandTimesheet(timesheet));` (import desde `@telekinesis/schema`). El tipo del parámetro pasa a `Timesheet | TimesheetInput | AuthoredTimesheetInput`. **No** tocar `seekTo` ni `runEffect` (el Studio siempre entrega planos; ver Task 6).
- [ ] **Step 4.2:** Crear `examples/sequences-demo.timesheet.json` (contra el playground):

```json
{
  "version": "1.0",
  "meta": { "title": "Sequences demo — 4 lines of intent", "author": "telekinesis" },
  "url": "http://localhost:5173/?demo",
  "resolution": { "width": 1280, "height": 720 },
  "timeline": [
    { "use": "pricing-pick", "with": { "tableId": "pricing", "tierId": "tier-pro", "ctaId": "tier-pro-cta" } },
    { "use": "login", "with": { "emailId": "email", "passwordId": "password", "submitId": "login" }, "delayAfter": 700 },
    { "use": "outro-reset", "with": { "finalFrameId": "welcome" } }
  ]
}
```

- [ ] **Step 4.3: Validación sensorial:** `pnpm playground`, en consola: `__telekinesis.play(<pegar el JSON>)` — debe reproducir el tour completo. (Los frame ids son los reales de `playground/src/App.tsx`; verificarlos antes con `__telekinesis.listFrames()`.)
- [ ] **Step 4.4:** `pnpm typecheck && pnpm test` + commit: `feat(core): play() expands authored timesheets; example sequences demo`

### Task 5: CLI — expansión en `loadTimesheet` + comando `sequences`

**Files:** Modify `packages/cli/src/io.ts`, `packages/cli/src/cli.ts`; Create `packages/cli/src/commands/sequences.ts`

- [ ] **Step 5.1:** En `io.ts` `loadTimesheet`: aplicar `expandTimesheet` antes de la validación existente, con manejo de error que imprima el mensaje tal cual (ya viene con la ruta `timeline[i]`). Así `record`, `preview` y `gif` aceptan sheets autorados sin tocarlos.
- [ ] **Step 5.2:** Nuevo comando `telekinesis sequences`:

```ts
import { Command } from "commander";
import pc from "picocolors";
import { SEQUENCE_IDS, SEQUENCES } from "@telekinesis/schema";

export function sequencesCommand(): Command {
  return new Command("sequences")
    .description("List the ready-to-use sequence library")
    .option("--json", "machine-readable output", false)
    .action((opts: { json: boolean }) => {
      if (opts.json) {
        const out = SEQUENCE_IDS.map((id) => {
          const s = SEQUENCES[id];
          return { id, label: s.label, description: s.description, example: { use: id, with: s.example } };
        });
        console.log(JSON.stringify(out, null, 2));
        return;
      }
      for (const id of SEQUENCE_IDS) {
        const s = SEQUENCES[id];
        console.log(`${pc.bold(pc.cyan(id))} — ${s.label}`);
        console.log(`  ${pc.dim(s.description)}`);
        console.log(`  ${pc.dim("e.g.")} ${JSON.stringify({ use: id, with: s.example })}\n`);
      }
    });
}
```

Registrar en `cli.ts` (`program.addCommand(sequencesCommand())`).

- [ ] **Step 5.3:** Run: `pnpm --filter @telekinesis/cli telekinesis sequences` — Expected: listado de 10 secuencias. Y humo: `pnpm --filter @telekinesis/cli telekinesis preview examples/sequences-demo.timesheet.json` con el playground levantado — Expected: browser headed reproduce el tour.
- [ ] **Step 5.4:** Commit: `feat(cli): authored timesheets everywhere + sequences catalog command`

### Task 6: Studio — sección "Sequences" en el palette (expandir al insertar)

**Files:** Modify `apps/studio/src/App.tsx`; Test `apps/studio/test/timeline-ops.test.ts` (helper puro)

- [ ] **Step 6.1: Helper puro + test.** En `apps/studio/src/timeline-ops.ts` añadir:

```ts
/** Efectos expandidos de una secuencia con `frameId`-params ya elegidos; el timeline[] sigue plano. */
export function sequenceEffects(id: string, params: Record<string, unknown>): unknown[] {
  const expanded = expandTimesheet({ timeline: [{ use: id, with: params }] });
  return (expanded.timeline as unknown[]) ?? [];
}
```

Test: `sequenceEffects("cta-click", { frameId: "x" })` devuelve 2 efectos con `action`.

- [ ] **Step 6.2: UI.** En el palette de `App.tsx`, debajo de "Telekinetic frames", nueva sección `<h3>Sequences</h3>` con un `<select>` de `SEQUENCE_IDS` + botón "Insert". Al insertar: para cada parámetro del schema cuyo nombre termina en `Id`/`Ids` (heurística suficiente: `frameId`, `tableId`, `stops`…), pedir el frame con un `<select>` de `frames` descubiertos en un mini-formulario inline (estado local `pendingSequence`); al confirmar, `commitSheet` añadiendo `sequenceEffects(...)` al final (una sola entrada de historial → un solo undo). Mostrar el error de params en `status` si la expansión lanza.
- [ ] **Step 6.3: Validación sensorial:** `pnpm studio` contra `pnpm docs`; insertar `feature-tour` con 2 paradas y comprobar: clips planos en la timeline, undo la quita entera, Play la reproduce.
- [ ] **Step 6.4:** `pnpm --filter @telekinesis/studio test && pnpm typecheck` + commit: `feat(studio): insert ready-made sequences from the palette`

### Task 7: MCP — el LLM compone con secuencias

**Files:** Modify `packages/mcp/src/index.ts`, `packages/mcp/src/draft.ts`

- [ ] **Step 7.1: Recurso + tool.** En `mcp/src/index.ts`: nuevo resource `telekinesis://sequences` (JSON: id, label, description, params via `zodToJsonSchema(def.params)`, example) y tool `list_sequences` (mismo payload como texto). Añadir a la descripción de `generate_timesheet` que existen secuencias.
- [ ] **Step 7.2: Draft con secuencias.** Reescribir `draft.ts` para *componer llamadas* y expandir al final — sustituye la triple heurística duplicada:
  - container detectado → `{ use: "intro-establish", with: { containerId } }`
  - campos FIELD contiguos → un solo `{ use: "form-fill", with: { fields: [...] } }` (con `sampleText` actual)
  - cada ACTION → `{ use: "cta-click", with: { frameId, anticipation: true } }`
  - cierre → `{ use: "outro-reset" }`
  - Devolver **expandido y validado** (`safeParseTimesheet(expandTimesheet(draft))`) — el contrato externo del tool no cambia (sigue devolviendo un timesheet plano válido), pero incluir también `authored` en el payload JSON para que el LLM vea la forma corta y aprenda a editarla.
- [ ] **Step 7.3:** Smoke manual: `pnpm --filter @telekinesis/mcp dev` + inspector MCP (o un script de 5 líneas con el SDK cliente) llamando a `generate_timesheet` contra el playground — Expected: `valid: true` y `authored` con 3-5 llamadas.
- [ ] **Step 7.4:** `pnpm typecheck` + commit: `feat(mcp): sequence catalog resource and sequence-composed drafts`

### Task 8: Documentación + cobertura

**Files:** Create `docs/sequences.md`, `apps/docs/src/content/sequences.mdx`; Modify `apps/docs/src/content/_meta.js`, `docs/timesheet.md`, `README.md`, `packages/schema/test/docs-coverage.test.ts` (si el Plan 1 ya lo creó; si no, crear con solo esta parte)

- [ ] **Step 8.1: Test de cobertura primero:** en `packages/schema/test/docs-coverage.test.ts` añadir: cada `SEQUENCE_IDS` aparece como `### \`<id>\`` en `docs/sequences.md`. Run — FAIL.
- [ ] **Step 8.2: `docs/sequences.md`:** anatomía (`{ "use", "with", "delayBefore/After" }` → expansión → validación), cuándo usar secuencia vs efectos sueltos, y una sección por secuencia: descripción, tabla de params (nombre/tipo/default), ejemplo de llamada y el listado de efectos expandidos (copiable). Cerrar con "escribir tu propia secuencia" (registerSequence en 10 líneas — nota: hoy el registro es en `schema/src/sequences.ts` vía PR; registro de usuario en runtime queda explícitamente fuera de alcance).
- [ ] **Step 8.3: Docs site:** `sequences.mdx` con el mismo contenido + entrada en `_meta.js` tras `effects`. En `docs/timesheet.md` añadir "Authoring options → 4. **Sequences**" con el ejemplo de 3 líneas. README: en la sección Effects, una línea: "¿Patrones enteros? Mira las [secuencias ready-to-use](docs/sequences.md)".
- [ ] **Step 8.4:** Run cobertura — PASS. Commit: `docs: sequence library reference`

### Task 9: Puerta de calidad final

- [ ] **Step 9.1:** `pnpm typecheck && pnpm test && pnpm build` — PASS.
- [ ] **Step 9.2:** Grabación de humo del ejemplo: playground en preview + `telekinesis record examples/sequences-demo.timesheet.json -o /tmp/plan2-smoke.mp4 --format both` — Expected: MP4 + GIF correctos.
- [ ] **Step 9.3:** PR: `feat: ready-to-use sequence library (10 sequences, authored timesheets)`.

---

## Definición de hecho

- 10 secuencias registradas (`cta-click`, `form-fill`, `login`, `error-recovery`, `search-and-reveal`, `intro-establish`, `feature-tour`, `pricing-pick`, `scroll-tour`, `outro-reset`), cada una con params Zod + example + tests de expansión.
- `expandTimesheet` idempotente; `play()`, CLI y MCP aceptan sheets autorados; el Studio inserta secuencias expandidas con un solo undo.
- `telekinesis sequences` lista el catálogo; recurso MCP `telekinesis://sequences` publicado.
- `docs/sequences.md` + página del site con cobertura testeada; `examples/sequences-demo.timesheet.json` graba de verdad.
- Todo timesheet pre-existente sigue funcionando sin cambios (expansión = identidad sobre planos).
