# Plan 5 — Suite de QA + Telekinesis grabándose a sí misma (galería GIF) + README ampliado

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (1) Una suite E2E que ejercita el pipeline completo — runtime en navegador real, grabación Playwright, mezcla ffmpeg, export GIF — y corre en CI como puerta de calidad; (2) un recopilatorio de GIFs **grabados por Telekinesis sobre Telekinesis** (un GIF por efecto + un hero) committeados en `public/gallery/`; (3) un README ampliado donde cada animación/transición se explica con su GIF y el timesheet exacto que lo produjo — con tests de cobertura que impiden que efecto, GIF, timesheet y README se desincronicen.

**Architecture:** Nuevo workspace `e2e/` con `@playwright/test` que levanta el playground (vite `preview`) vía `webServer` y ejercita `window.__telekinesis` en Chromium real — la capa que los unit tests actuales (vitest puro: easing/spring/cursor-motion/schema/studio-ops) no pueden tocar porque no hay DOM ni rAF reales. Los specs de pipeline (record→mix→gif) usan las APIs de `@telekinesis/engine`/`render` directamente y se saltan limpiamente si falta ffmpeg (en CI siempre está). La galería es la misma maquinaria del dogfooding de docs (`apps/docs/scripts/record-sections.ts`), generalizada: los micro-timesheets viven en `examples/gallery/*.timesheet.json` (fuente de verdad única que el README embebe y el script graba), y un guard de presupuesto impide que el repo engorde sin control.

**Tech Stack:** `@playwright/test`, Vitest (cobertura README), ffmpeg/ffprobe, gifsicle (opcional), GitHub Actions.

**Dependencias con otros planes:** Ninguna. La galería cubre las 11 acciones actuales; cuando los Planes 1-2 aterricen, el test de cobertura (Task 7) **fallará en rojo** listando los efectos sin GIF/README — ese fallo es el mecanismo de crecimiento diseñado, no un bug.

---

## Estado del arte (verificado)

- **Tests hoy:** `packages/schema/test/{timesheet,layout}.test.ts`, `packages/core/test/{easing,spring,cursor-motion}.test.ts`, `apps/studio/test/{history,timeline-ops}.test.ts`. Todo unitario y puro. **Cero cobertura de:** `effects.ts`/`player.ts`/`seek.ts` en DOM real, `record()` end-to-end, `mixAudio`/`toGif`, los ejemplos de `examples/`, el modo usuario (huella cero).
- **CI** (`.github/workflows/ci.yml`): typecheck+test+build+docs en cada push; job `motion` solo manual (workflow_dispatch), sube artifacts, no committea.
- **Dogfooding existente:** `record-sections.ts` graba 5 secciones de docs → webm+gif en `apps/docs/public/motion/` (committeados). El README no tiene ni un solo GIF; los efectos son una línea de texto plano (`README.md:157-163`).
- **Precedente de presupuesto:** los GIF de docs usan `fps 12, width 560, maxColors 96, lossy 80` — reutilizar exactamente.
- El playground tiene los frames para casi todos los efectos, pero mezclados en una página de demo; una **página galería dedicada** con un escenario compacto por efecto da GIFs enfocados y estables.

## Reglas duras

1. **Los GIFs del repo se regeneran solo por script** (`pnpm gallery:record`) — nunca a mano, nunca con otra herramienta. El vídeo es el producto: si un cambio de motor rompe la estética, debe verse en el diff de GIFs.
2. **Presupuesto duro:** ≤ 900 KB por GIF de galería, ≤ 10 MB el directorio completo — el script falla si se supera (no avisa: falla).
3. **Fuente de verdad única por efecto:** `examples/gallery/<action>.timesheet.json` alimenta (a) la grabación y (b) el bloque de código del README. Un test verifica el triple vínculo action↔gif↔README.
4. **E2E determinista:** sin sleeps arbitrarios (esperar `__telekinesis.ready`), asserts con tolerancia (±15% en duraciones), retries de Playwright en 1 para specs de grabación.
5. Los specs que requieren ffmpeg hacen `skip` con razón visible si no está en PATH; CI lo instala siempre (no puede haber skips silenciosos en CI: un step lo verifica).

## Mapa de ficheros

- **Crear:** `e2e/package.json`, `e2e/playwright.config.ts`, `e2e/tests/{runtime.spec.ts,user-mode.spec.ts,effects.spec.ts,record-pipeline.spec.ts,examples.spec.ts,gallery-coverage.spec.ts}`, `e2e/helpers.ts`, `e2e/scripts/record-gallery.ts`, `playground/gallery.html`, `playground/src/gallery/{App.tsx,main.tsx}`, `examples/gallery/*.timesheet.json` (11), `public/gallery/` (11 GIFs + hero.gif, committeados)
- **Modificar:** `package.json` (scripts `e2e`, `gallery:record`), `pnpm-workspace.yaml` (añadir `e2e`), `playground/vite.config.ts` (input gallery), `.github/workflows/ci.yml` (job e2e; job motion amplía a galería), `README.md` (sección galería + efectos explicados)

---

### Task 1: Workspace `e2e/` + arranque del playground

**Files:** Create `e2e/package.json`, `e2e/playwright.config.ts`, `e2e/helpers.ts`; Modify `pnpm-workspace.yaml`, root `package.json`

- [ ] **Step 1.1:** Añadir `e2e` a `pnpm-workspace.yaml` y crear `e2e/package.json`:

```json
{
  "name": "@telekinesis/e2e",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test:e2e": "playwright test",
    "gallery:record": "tsx scripts/record-gallery.ts",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@playwright/test": "^1.49.1",
    "@telekinesis/engine": "workspace:*",
    "@telekinesis/render": "workspace:*",
    "@telekinesis/schema": "workspace:*"
  },
  "devDependencies": { "@types/node": "^22.10.2", "tsx": "^4.19.2", "typescript": "^5.6.3" }
}
```

(`@playwright/test` fija la misma minor que `playwright` del engine — 1.49 — para compartir browser binaries. Añadir `tsconfig.json` heredando de `tsconfig.base.json`.) **Deliberadamente no hay script `test`** en este package: `pnpm -r test` (el gate rápido de CI) no debe arrastrar los e2e. El root gana dos scripts:

```json
"e2e": "pnpm --filter @telekinesis/playground build && pnpm --filter @telekinesis/e2e test:e2e",
"gallery:record": "pnpm --filter @telekinesis/playground build && pnpm --filter @telekinesis/e2e gallery:record"
```

- [ ] **Step 1.2:** `e2e/playwright.config.ts`:

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 90_000,
  retries: process.env.CI ? 1 : 0,
  workers: 1, // graba vídeo y mide tiempos: la concurrencia solo mete ruido
  use: { baseURL: "http://localhost:4173" },
  webServer: {
    command: "pnpm --filter @telekinesis/playground preview",
    port: 4173,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
```

- [ ] **Step 1.3:** `e2e/helpers.ts`: `waitForRuntime(page)` (el mismo `waitForFunction` de `engine/src/record.ts:77-81`), `hasFfmpeg()` (execa `ffmpeg -version` con catch), `ffprobeJson(file)` (`ffprobe -v quiet -print_format json -show_format -show_streams`).
- [ ] **Step 1.4:** Run: `pnpm install && pnpm exec playwright install chromium` y un spec trivial (`expect(1).toBe(1)`) para validar el arnés: `pnpm e2e` — Expected: PASS con el playground servido.
- [ ] **Step 1.5:** Commit: `chore(e2e): Playwright test workspace with playground webServer`

### Task 2: Specs de runtime y de huella cero

**Files:** Create `e2e/tests/runtime.spec.ts`, `e2e/tests/user-mode.spec.ts`

- [ ] **Step 2.1: `runtime.spec.ts`:**

```ts
import { expect, test } from "@playwright/test";
import { waitForRuntime } from "../helpers";

test("el runtime se instala y expone los frames del playground", async ({ page }) => {
  await page.goto("/?demo");
  await waitForRuntime(page);
  const frames = await page.evaluate(() => window.__telekinesis.listFrames());
  const ids = frames.map((f: { id: string }) => f.id);
  for (const expected of ["pricing", "tier-pro", "tier-pro-cta", "email", "password", "login", "welcome"]) {
    expect(ids).toContain(expected);
  }
  const rect = await page.evaluate(() => window.__telekinesis.getRect("pricing"));
  expect(rect!.width).toBeGreaterThan(100);
});

test("navigator.webdriver activa demo mode sin ?demo", async ({ page }) => {
  await page.goto("/");            // Playwright ⇒ webdriver === true
  await waitForRuntime(page);      // si esto resuelve, la detección funcionó
  expect(await page.locator("[data-telekinesis-id]").count()).toBeGreaterThan(0);
});
```

(Declarar `window.__telekinesis` con un `.d.ts` local en `e2e/` — tipo laxo `any` es aceptable aquí.)

- [ ] **Step 2.2: `user-mode.spec.ts` — la promesa "compila a nada":** cargar `/` con `navigator.webdriver` **desactivado** (`test.use({ launchOptions: { ignoreDefaultArgs: ["--enable-automation"] } })` no basta — usar `context.addInitScript(() => Object.defineProperty(navigator, "webdriver", { get: () => false }))` antes de navegar) y afirmar: `window.__telekinesis === undefined`, 0 nodos `[data-telekinesis-id]`, 0 nodos `#telekinesis-layer`. Este spec protege la garantía más citada del README (`README.md:46-48`).
- [ ] **Step 2.3:** `pnpm e2e` — PASS. Commit: `test(e2e): runtime install, frame registry, zero-footprint user mode`

### Task 3: Specs de efectos — invariantes observables por acción

**Files:** Create `e2e/tests/effects.spec.ts`

- [ ] **Step 3.1:** Tabla de invariantes (un `test` por fila; cada uno navega a `/?demo`, espera runtime y ejecuta `runEffect`/`play` vía `evaluate`):

| Acción | Ejecutar | Invariante afirmable |
| --- | --- | --- |
| `cursor-move` | runEffect a `tier-pro-cta` | transform del `.telekinesis-cursor` ≈ centro del rect destino (±8px, tras settle) |
| `click` | runEffect | cursor sobre el frame; (self via `play`) el contador del playground reacciona si lo hay — si no, basta el cursor |
| `zoom-in` | runEffect scale 1.4 | `body.style.transform` contiene `matrix(1.4` al terminar (leer con regex, tolerancia por drift: comparar el factor con ±0.01) |
| `zoom-out` | tras zoom-in | transform vuelve a identidad/"" |
| `scroll-down`/`scroll-up` | distance 400 | `window.scrollY` cambia ±400 (±20) |
| `highlight` | duración 800 | durante la ejecución existe un nodo en `#telekinesis-layer` con `box-shadow` (sondear a mitad con `Promise.race`); al acabar + grace, desaparece — afirmar solo la fase "durante" (la grace de 2.2s haría el test lento: cerrar la página lo limpia) |
| `shake` | intensity high | el transform del frame muta durante y **se restaura exactamente** al terminar |
| `type-down` | `play` en self mode sobre `email` | `input.value === texto` al resolver; nº de marks de sonido == nº de caracteres si `soundProfile` |
| `drag-and-drop` | runEffect a destino | cursor en el destino al resolver |
| `wait` | duración 600 | `runEffect` tarda ≥600ms y <900ms |
| duraciones | `play` de 3 efectos con delays | wall-clock total dentro de ±15% del `layoutTimesheet(...).totalMs` |

- [ ] **Step 3.2:** Implementar con un helper local `runEffect(page, effect)` que **pase el efecto ya defaulted** (usar `parseTimesheet({ timeline: [raw] }).timeline[0]` importando `@telekinesis/schema` en el lado Node del spec — así los specs no duplican defaults).
- [ ] **Step 3.3:** `pnpm e2e` — PASS (calibrar tolerancias si algún assert es flaky; documentar cada tolerancia con un comentario de por qué).
- [ ] **Step 3.4:** Commit: `test(e2e): observable invariants for all 11 effects`

### Task 4: Spec del pipeline completo (record → mix → gif) + ejemplos válidos

**Files:** Create `e2e/tests/record-pipeline.spec.ts`, `e2e/tests/examples.spec.ts`

- [ ] **Step 4.1: `record-pipeline.spec.ts`** (serial, `test.skip(!await hasFfmpeg(), "ffmpeg not on PATH")`):

```ts
const SHEET = {
  url: "http://localhost:4173/?demo",
  resolution: { width: 960, height: 540 },
  timeline: [
    { action: "wait", duration: 300 },
    { action: "zoom-in", frameId: "pricing", scale: 1.15, duration: 700 },
    { action: "cursor-move", destFrameId: "tier-pro-cta", duration: 500 },
    { action: "click", frameId: "tier-pro-cta", soundProfile: "macbook-trackpad" },
    { action: "zoom-out", duration: 500 },
  ],
};

test("record produce webm + audio-map coherentes", async () => {
  const out = await mkdtemp(…);
  const res = await record(SHEET, { outDir: out, headless: true });
  expect((await stat(res.videoPath)).size).toBeGreaterThan(20_000);
  expect(res.audioMap.marks).toHaveLength(1);                    // el click
  expect(res.audioMap.marks[0].t).toBeGreaterThan(1000);         // tras wait+zoom+move
  expect(res.audioMap.durationMs).toBeGreaterThan(2300);
  const video = await ffprobeJson(res.videoPath);
  const stream = video.streams.find((s) => s.codec_type === "video");
  expect(stream.width).toBe(960);                                 // la resolución pactada se respeta
});

test("mixAudio añade la pista y respeta la duración del vídeo", …);  // mp4 con stream de audio aac; duración mp4 ≥ duración webm − 0.2s
test("toGif produce un gif animado dentro de presupuesto", …);       // firma GIF89a, >5 frames (ffprobe nb_read_packets), <1.5MB
```

Reutilizar `soundsDir` real: `packages/cli/assets/sounds` (path relativo al repo desde `e2e/`).

- [ ] **Step 4.2: `examples.spec.ts`:** leer `examples/*.timesheet.json` (glob) y afirmar que **todos** pasan `parseTimesheet` (o `expandTimesheet`+parse si el Plan 2 existe — detectar por `SEQUENCE_IDS`). Esto convierte los ejemplos en contrato: un cambio de schema que los rompa, rompe CI.
- [ ] **Step 4.3:** `pnpm e2e` local (con ffmpeg instalado: `brew install ffmpeg`) — PASS. Commit: `test(e2e): full record→mix→gif pipeline and examples conformance`

### Task 5: Página galería + micro-timesheets por efecto

**Files:** Create `playground/gallery.html`, `playground/src/gallery/{App.tsx,main.tsx}`, `examples/gallery/*.timesheet.json` (11); Modify `playground/vite.config.ts`

- [ ] **Step 5.1: `gallery.html` + App.** Tercera entrada Vite (mismo patrón que `landing.html`). Una sola vista compacta 960×540 con "sets" pequeños y de alto contraste, cada uno con frames propios (prefijo `gal-`): una tarjeta CTA (`gal-card`, `gal-cta`), un input (`gal-input`), una lista arrastrable (`gal-drag-src`, `gal-drag-dest`), un bloque de texto largo para scroll (`gal-article`), y un badge de éxito (`gal-done`). Estética: la del playground actual (styles.css) — el fondo es la marca.
- [ ] **Step 5.2: 11 micro-timesheets** en `examples/gallery/`, uno por acción, nombre exacto `<action>.timesheet.json`. Regla de composición: 2-5 pasos, el efecto protagonista en el medio, ~3-5 s total, resolución 960×540, sin sonido salvo el idiomático del efecto. Ejemplo canónico (`click.timesheet.json`):

```json
{
  "version": "1.0",
  "meta": { "title": "click", "description": "Cursor travels, presses, ripples — and really clicks." },
  "url": "http://localhost:4173/gallery.html?demo",
  "resolution": { "width": 960, "height": 540 },
  "timeline": [
    { "action": "cursor-move", "destFrameId": "gal-cta", "duration": 600 },
    { "action": "click", "frameId": "gal-cta", "soundProfile": "macbook-trackpad" },
    { "action": "wait", "duration": 800 }
  ]
}
```

Los 11: `click`, `type-down` (texto "motion is the message", mistakes true), `drag-and-drop` (src→dest), `shake` (high, sobre gal-cta), `zoom-in` (gal-card, 1.35), `zoom-out` (precedido de zoom-in), `scroll-down` y `scroll-up` (sobre gal-article), `cursor-move` (arco largo diagonal, trail-worthy), `highlight` (gal-card → gal-cta encadenados: enseña el slide del spotlight), `wait` (con caption visual: usar un highlight corto antes y después para que "la pausa" se lea — el GIF de `wait` muestra ritmo, no vacío).
- [ ] **Step 5.3: Validación:** `pnpm playground` → abrir `gallery.html?demo`, y por consola `__telekinesis.play(<json de click>)`. Ajustar frames/layout hasta que los 11 se lean bien en 960×540.
- [ ] **Step 5.4:** Commit: `feat(playground): effects gallery page + per-effect micro-timesheets`

### Task 6: `e2e/scripts/record-gallery.ts` — la grabación de la casa, con presupuesto

**Files:** Create `e2e/scripts/record-gallery.ts`; Modify root `package.json`

- [ ] **Step 6.1:** Script (patrón calcado de `apps/docs/scripts/record-sections.ts`, generalizado; vive en `e2e/` porque ese workspace ya depende de engine/render/schema):
  - Levanta `vite preview` del playground si `:4173` no responde (mismo `reachable`/`waitForServer`).
  - Recorre `examples/gallery/*.timesheet.json` **+ `examples/landing-demo.timesheet.json` como `hero`** (con `-u http://localhost:4173/landing.html?demo`).
  - Por cada uno: `record()` → `toGif(..., { fps: 12, width: 560, maxColors: 96, lossy: 80 })` → `public/gallery/<name>.gif`.
  - **Guard de presupuesto:** tras cada GIF, `stat.size > 900_000` → `process.exit(1)` con mensaje (`"<name>.gif pesa XKB — recorta el timesheet o baja width/fps"`); al final, suma > 10 MB → exit 1. Imprimir tabla resumen (nombre, KB, backend).
  - Flags por env como el precedente: `TK_GALLERY_FPS/WIDTH`, `TK_GALLERY_ONLY=<action>` para iterar uno.
- [ ] **Step 6.2:** Root `package.json`: añadir el script `gallery:record` definido en la Task 1 (build del playground + filtro a `@telekinesis/e2e`). Paths dentro del script relativos al repo: resolver con `new URL("../..", import.meta.url)` como hace `gallery-coverage.spec.ts`.
- [ ] **Step 6.3:** Run: `pnpm gallery:record` — Expected: 12 GIFs en `public/gallery/`, tabla dentro de presupuesto. Revisarlos a ojo uno a uno (¿se entiende el efecto sin leer nada?). Committear los GIFs.
- [ ] **Step 6.4:** Commit: `feat: self-recorded effects gallery (telekinesis filming telekinesis)`

### Task 7: Test de cobertura triple (efecto ↔ GIF ↔ README)

**Files:** Create `e2e/tests/gallery-coverage.spec.ts`

- [ ] **Step 7.1:** Spec sin navegador (puro Node, corre con playwright test igualmente):

```ts
import { readdirSync, readFileSync, statSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { EFFECT_ACTIONS } from "@telekinesis/schema";

const repo = new URL("../..", import.meta.url).pathname;
const readme = readFileSync(`${repo}/README.md`, "utf8");

for (const action of EFFECT_ACTIONS) {
  test(`"${action}" tiene timesheet de galería, GIF committeado y sección en el README`, () => {
    const sheet = `${repo}/examples/gallery/${action}.timesheet.json`;
    expect(statSync(sheet).size, `${action}: falta ${sheet}`).toBeGreaterThan(0);
    expect(statSync(`${repo}/public/gallery/${action}.gif`).size).toBeLessThan(900_000);
    expect(readme).toContain(`public/gallery/${action}.gif`);
    expect(readme).toMatch(new RegExp(`####\\s+\\\`${action}\\\``));
  });
}

test("todo GIF de galería corresponde a una action o al hero", () => {
  for (const f of readdirSync(`${repo}/public/gallery`)) {
    const name = f.replace(/\.gif$/, "");
    expect([...EFFECT_ACTIONS, "hero"], `GIF huérfano: ${f}`).toContain(name);
  }
});
```

- [ ] **Step 7.2:** Run — Expected: **FAIL** en la parte README (aún no escrito). Es el driver de la Task 8.
- [ ] **Step 7.3:** Commit: `test(e2e): effect↔gif↔readme coverage gate`

### Task 8: README ampliado

**Files:** Modify `README.md`

- [ ] **Step 8.1: Hero GIF.** Bajo el header (`README.md:16`), insertar `<img src="public/gallery/hero.gif" width="720" alt="Telekinesis recording the playground landing: zoom, spotlight, typing, click — with a ghost cursor" />` centrado, con una línea de pie: *"This GIF was recorded by Telekinesis, about Telekinesis, in CI. So is every GIF below."*
- [ ] **Step 8.2: Sección `## Effects` reescrita.** Sustituir la línea plana de efectos (`README.md:157-163`) por la galería: intro de 2 líneas (qué es un efecto, que todo lo de abajo es autogenerado con `pnpm gallery:record`) y **por cada una de las 11 acciones** un bloque con este formato exacto (el test de la Task 7 lo exige):

```markdown
#### `zoom-in`

<img src="public/gallery/zoom-in.gif" width="480" alt="zoom-in effect" />

The camera pushes into a frame — matrix scale+translate driven by rAF (or a real
spring), holds with a subtle Ken Burns drift, and never blurs the cursor layer.

<details><summary>The timesheet that filmed this GIF</summary>

\`\`\`json
{ …contenido literal de examples/gallery/zoom-in.timesheet.json… }
\`\`\`
</details>
```

Agrupar con subtítulos `### Interactions` / `### Camera & navigation` (+ `### Annotations` cuando el Plan 1 exista). Los párrafos descriptivos: 2-3 líneas por efecto explicando qué se ve **y qué campo del timesheet lo controla** (p.ej. zoom-in: `scale`, `easing: "spring"`, ancla por `frameId`). Cerrar la sección con el enlace actual a `docs/effects.md` (referencia completa de campos) y a `docs/timesheet.md`.
- [ ] **Step 8.3: Sección `## Quality` nueva** (tras Develop): 4 líneas — qué cubre la suite (unit + e2e navegador + pipeline ffmpeg), el comando `pnpm e2e`, y que los GIFs del README son también los fixtures de regresión visual humana ("si un PR cambia la sensación del motor, cambia este diff").
- [ ] **Step 8.4:** Run: `pnpm e2e` (Task 7 spec) — Expected: PASS ahora. Revisar el README renderizado (`gh markdown-preview` o push a rama) — imágenes visibles, `<details>` plegados.
- [ ] **Step 8.5:** Commit: `docs(readme): self-recorded gallery — every effect explained with its timesheet`

### Task 9: CI — puerta e2e + galería regrabable bajo demanda

**Files:** Modify `.github/workflows/ci.yml`

- [ ] **Step 9.1: Job `e2e`** (paralelo a `build`, mismo trigger push/PR):

```yaml
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - name: Install
        run: pnpm install --frozen-lockfile
        env: { PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: "1" }
      - name: System deps
        run: |
          sudo apt-get update && sudo apt-get install -y ffmpeg gifsicle
          pnpm exec playwright install --with-deps chromium
      - name: Assert ffmpeg present (no silent skips)
        run: ffmpeg -version | head -1
      - name: E2E
        run: pnpm e2e
      - uses: actions/upload-artifact@v4
        if: failure()
        with: { name: e2e-artifacts, path: e2e/test-results }
```

- [ ] **Step 9.2: Ampliar el job `motion`:** añadir step que corre `pnpm gallery:record` y sube `public/gallery/*.gif` como artifact `gallery-gifs` (junto al existente de docs). La actualización de los GIFs committeados sigue siendo un PR humano: descargar artifact → reemplazar → el diff de tamaño/aspecto se revisa a ojo (regla dura 1).
- [ ] **Step 9.3:** Push a una rama y verificar el run verde de ambos jobs; disparar `motion` a mano una vez y comparar sus GIFs con los locales (mismo tamaño ±10%: la fuente determinista funciona).
- [ ] **Step 9.4:** Commit: `ci: e2e quality gate (browser + ffmpeg) and on-demand gallery re-recording`

### Task 10: Puerta de calidad final

- [ ] **Step 10.1:** `pnpm typecheck && pnpm test && pnpm build && pnpm e2e` — todo PASS en local.
- [ ] **Step 10.2:** Contar el peso añadido al repo: `du -ch public/gallery/*.gif | tail -1` — Expected: < 10 MB (regla dura 2).
- [ ] **Step 10.3:** PR: `feat: e2e QA suite + self-recorded gallery + README with per-effect timesheets` — en la descripción, incrustar 2-3 GIFs de la galería (el PR es también el escaparate).

---

## Definición de hecho

- `pnpm e2e` verde en local y en CI: runtime real, huella-cero, invariantes de los 11 efectos, pipeline record→mix→gif con ffprobe, y ejemplos como contrato.
- 12 GIFs (11 efectos + hero) en `public/gallery/`, todos < 900 KB, grabados por `pnpm gallery:record` (reproducible, con presupuesto que falla en rojo).
- README: hero GIF + sección Effects con GIF, explicación y timesheet literal por efecto + sección Quality; el test de cobertura triple impide desincronización futura (y obligará a extender la galería cuando los Planes 1-2 añadan efectos).
- CI con job `e2e` bloqueante y regrabación de galería bajo demanda con artifacts.
