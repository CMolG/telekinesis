# Plan 4 — Componentes telekinéticos Login/Safe: flujos restringidos con datos mock

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Poder grabar demos de zonas restringidas de una app real sin exponer datos reales ni pelear con la autenticación: `<TelekineticSafe>` sustituye/enmascara contenido sensible por mocks deterministas en modo demo, `<TelekineticLogin>` habilita una sesión demo (o salta el login) solo cuando graba Telekinesis, y el motor acepta `auth` (storageState / cookies / localStorage) en el timesheet para flujos con login real de CI. Todo documentado con recetas.

**Architecture:** Misma filosofía que `<TelekineticFrame>` (una pieza, dos vidas): en **modo usuario** los componentes son passthrough absoluto (`<>{children}</>`, cero huella); en **modo demo** (`isDemoMode()`, `detect.ts`) activan la sustitución. Los mocks son deterministas por semilla (PRNG mulberry32 en `core/src/mock.ts`) para que dos grabaciones del mismo timesheet produzcan el mismo vídeo. La vía "sesión pre-cocinada" vive en el engine: `Timesheet.auth` (aditivo en schema) se traduce a `storageState`/`addCookies`/`addInitScript` de Playwright **antes** del `goto`.

**Tech Stack:** React 19/18 (peer), Zod, Playwright, Vitest + jsdom + `@testing-library/react` (nuevos devDeps de core, solo test).

**Dependencias con otros planes:** Ninguna dura. La secuencia `login` del Plan 2 usa las mismas credenciales mock por defecto (sinergia documentada en Task 7). El Plan 5 añade la grabación E2E de esta página al set de QA.

---

## Estado del arte (verificado)

- `detect.ts` ya resuelve el "cuándo": `navigator.webdriver === true` (grabación) / `?demo` / `__TELEKINESIS_FORCE__` / modo Studio. SSR-safe (false en servidor, upgrade en layout effect). **Todo este plan cuelga de ese único interruptor.**
- No existe nada para datos sensibles: si la app muestra un email real, el vídeo lo publica. No hay manera de grabar detrás de un login salvo hacer el login de verdad en el timeline (con una contraseña real escrita en un JSON versionado — inaceptable).
- `record()` (`engine/src/record.ts:64-74`) crea el contexto con `viewport` + `recordVideo` únicamente; no expone `storageState` ni cookies ni init scripts.
- `<TelekineticFrame>` (`core/src/react/TelekineticFrame.tsx`) es el patrón exacto a imitar: `useState(false)` + upgrade en `useIsomorphicLayoutEffect` + registro condicional.
- El playground ya tiene un formulario de login fake (`email`/`password`/`login` en `App.tsx`) — base perfecta para el fixture de la Task 6.

## Reglas duras

1. **Cero huella en modo usuario.** Ningún wrapper, listener, atributo ni registro. El passthrough se testea explícitamente (Task 2).
2. **Los mocks viajan en el bundle.** Documentar en letra grande: los valores mock son *ficticios por definición*; `TelekineticSafe` protege lo que la app *renderiza en runtime* (datos del usuario real), no secretos de build. Nunca poner un secreto real como `mock`.
3. **Determinismo:** misma semilla → mismos mocks, en Web y en Node. Sin `Math.random()` en este código.
4. **Schema aditivo:** `Timesheet` gana `auth` opcional; ningún campo existente cambia. Timesheets viejos intactos.
5. **El engine nunca "inventa" auth:** solo aplica lo que el timesheet/CLI declara. Ficheros de storageState van en `.gitignore` (recordatorio en docs y en el error del CLI si el path no existe).

## Mapa de ficheros

- **Crear:** `packages/core/src/mock.ts`, `packages/core/src/react/TelekineticSafe.tsx`, `packages/core/src/react/TelekineticLogin.tsx`, `packages/core/src/react/MockProvider.tsx`, `packages/core/test/{mock.test.ts,safe.test.tsx,login.test.tsx}`, `packages/engine/src/auth.ts`, `packages/engine/test/auth.test.ts`, `playground/src/vault/` (fixture), `examples/restricted-dashboard.timesheet.json`, `docs/safe-mode.md`, `apps/docs/src/content/restricted-flows.mdx`
- **Modificar:** `packages/schema/src/timesheet.ts`, `packages/schema/test/timesheet.test.ts`, `packages/core/src/index.ts`, `packages/core/package.json` (devDeps test), `packages/engine/src/record.ts`, `packages/engine/package.json` (vitest), `packages/cli/src/commands/{record,preview}.ts`, `playground/vite.config.ts` (+ input vault), `apps/docs/src/content/_meta.js`, `README.md`

---

### Task 1: Generadores mock deterministas (`core/src/mock.ts`)

**Files:** Create `packages/core/src/mock.ts`, `packages/core/test/mock.test.ts`

- [ ] **Step 1.1: Tests que fallan:**

```ts
import { describe, expect, it } from "vitest";
import { createMock } from "../src/mock";

describe("createMock", () => {
  it("misma semilla → misma secuencia", () => {
    const a = createMock(42);
    const b = createMock(42);
    expect([a.fullName(), a.email(), a.amount(10, 500)])
      .toEqual([b.fullName(), b.email(), b.amount(10, 500)]);
  });
  it("semillas distintas → valores distintos", () => {
    expect(createMock(1).email()).not.toBe(createMock(2).email());
  });
  it("email tiene forma válida y dominio reservado", () => {
    expect(createMock(7).email()).toMatch(/^[a-z.]+@example\.(com|org|net)$/);
  });
  it("amount respeta el rango y los decimales", () => {
    const v = createMock(7).amount(10, 500, 2);
    expect(v).toBeGreaterThanOrEqual(10);
    expect(v).toBeLessThanOrEqual(500);
  });
  it("person(i) es estable por índice, independiente del orden de llamada", () => {
    expect(createMock(7).person(3)).toEqual(createMock(7).person(3));
  });
});
```

- [ ] **Step 1.2:** Run: `pnpm --filter @telekinesis/core test` — FAIL.
- [ ] **Step 1.3: Implementar.** Sin dependencias (nada de faker — 60 líneas bastan y el bundle de core se queda pequeño):

```ts
/** mulberry32 — PRNG determinista de 32 bits, suficiente y diminuto. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = ["Ada", "Alan", "Grace", "Edsger", "Barbara", "Donald", "Radia", "Linus", "Margaret", "Tim"];
const LAST = ["Lovelace", "Turing", "Hopper", "Dijkstra", "Liskov", "Knuth", "Perlman", "Torvalds", "Hamilton", "Berners-Lee"];
const DOMAINS = ["example.com", "example.org", "example.net"]; // RFC 2606 — jamás resuelven a nadie real

export interface Mock {
  fullName(): string;
  firstName(): string;
  email(): string;
  company(): string;
  phone(): string;                                  // formato +1 555 01XX — rango reservado para ficción
  amount(min: number, max: number, decimals?: number): number;
  date(withinDays?: number): string;                // ISO, hacia atrás desde una época FIJA (no Date.now(): determinismo)
  /** Persona estable por índice — para tablas: person(rowIndex). */
  person(i: number): { name: string; email: string; company: string };
  pick<T>(items: readonly T[]): T;
  int(min: number, max: number): number;
}

export function createMock(seed = 1): Mock { … }
```

Detalles: `person(i)` usa un PRNG *derivado* (`mulberry32(seed ^ (i + 1) * 0x9e3779b9)`) para ser estable por índice; `date` parte de la época fija `2026-01-01T00:00:00Z`. Export en `core/src/index.ts`.

- [ ] **Step 1.4:** Tests PASS. Commit: `feat(core): deterministic mock data generators (mulberry32)`

### Task 2: `<TelekineticSafe>` — sustituir o enmascarar contenido sensible

**Files:** Create `packages/core/src/react/TelekineticSafe.tsx`, `packages/core/test/safe.test.tsx`; Modify `packages/core/src/index.ts`, `packages/core/package.json`

- [ ] **Step 2.1: Preparar el arnés de test React.** En `packages/core/package.json` devDeps: `@testing-library/react`, `jsdom`, `react-dom` (react ya está). Los tests React llevan pragma `// @vitest-environment jsdom` (los tests puros existentes siguen en node).
- [ ] **Step 2.2: Tests que fallan** (`safe.test.tsx`):

```tsx
// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TelekineticSafe } from "../src/react/TelekineticSafe";
import { setForcedDemoMode } from "../src/detect";

afterEach(() => setForcedDemoMode(false));

describe("modo usuario", () => {
  it("passthrough absoluto: sin wrapper ni atributos", () => {
    const { container } = render(
      <TelekineticSafe mock="MOCK"><span id="real">real@corp.com</span></TelekineticSafe>,
    );
    // Byte-exacto: ni wrapper, ni data-attributes, ni estilos — el children tal cual.
    expect(container.innerHTML).toBe(`<span id="real">real@corp.com</span>`);
  });
});

describe("modo demo", () => {
  it("mock sustituye a los children", () => {
    setForcedDemoMode(true);
    render(<TelekineticSafe mock={<span>ada@example.com</span>}><span>real@corp.com</span></TelekineticSafe>);
    expect(screen.queryByText("real@corp.com")).toBeNull();
    expect(screen.getByText("ada@example.com")).toBeInTheDocument();
  });
  it("mask='redact' conserva la longitud pero oculta el texto", () => {
    setForcedDemoMode(true);
    const { container } = render(<TelekineticSafe mask="redact"><span>sk-live-abc123</span></TelekineticSafe>);
    const wrapper = container.querySelector("[data-telekinesis-safe]");
    expect(wrapper?.textContent).toMatch(/^•+$/);
    expect(wrapper?.textContent?.length).toBe("sk-live-abc123".length);
  });
  it("mask='blur' mantiene los children pero con filtro", () => {
    setForcedDemoMode(true);
    const { container } = render(<TelekineticSafe mask="blur"><span>secreto</span></TelekineticSafe>);
    const wrapper = container.querySelector("[data-telekinesis-safe]") as HTMLElement;
    expect(wrapper.style.filter).toContain("blur");
    expect(wrapper.textContent).toBe("secreto");
  });
  it("con id se registra como frame targeteable", () => {
    setForcedDemoMode(true);
    render(<TelekineticSafe id="api-key" mock="xxxx"><code>real</code></TelekineticSafe>);
    expect(document.querySelector(`[data-telekinesis-id="api-key"]`)).not.toBeNull();
  });
});
```

Nota: el test de registro puede requerir importar `registryStore` y comprobar `getFrame("api-key")` si el atributo se pone en el mismo wrapper — decidir en Step 2.3 y ajustar la aserción al DOM real.

- [ ] **Step 2.3: Implementar.** Espejo de `TelekineticFrame` (mismo patrón detect/upgrade/registro):

```tsx
export interface TelekineticSafeProps {
  /** Opcional: si se da, el wrapper demo se registra como frame targeteable. */
  id?: string;
  intent?: string;
  /** Reemplazo completo en modo demo (nodo o string). Tiene prioridad sobre mask. */
  mock?: React.ReactNode;
  /** Sin mock: "redact" = •••• preservando longitud; "blur" = children desenfocados e ininteligibles. */
  mask?: "redact" | "blur";
  as?: React.ElementType;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}
```

Comportamiento demo: si `mock != null` → renderizar `mock` dentro del wrapper (`data-telekinesis-safe`, y `data-telekinesis-id` + registro si hay `id` — reusar `registryStore` exactamente como TelekineticFrame). Si `mask === "redact"` → wrapper que renderiza `"•".repeat(len)` donde `len` = longitud de texto de children (extraer con una función `textLength(node)` recursiva sobre strings/numbers/arrays/elements — implementarla en el mismo fichero, best-effort: children no-texto cuentan 8). Si `mask === "blur"` → children con `style.filter = "blur(7px)"` + `userSelect: "none"` + `aria-hidden`. Sin mock ni mask → children tal cual pero con el wrapper (útil solo con `id`; documentarlo).

- [ ] **Step 2.4:** Tests PASS + export en `index.ts`. Commit: `feat(core): TelekineticSafe — mock/redact/blur sensitive content in demo mode`

### Task 3: `<TelekinesisMockProvider>` + hooks

**Files:** Create `packages/core/src/react/MockProvider.tsx`; Test dentro de `safe.test.tsx` o fichero propio; Modify `packages/core/src/index.ts`

- [ ] **Step 3.1: Tests:** `useTelekinesisMock("balance", "12.402,88 €")` devuelve el valor real en modo usuario y el mock del provider (`values.balance`) en demo; `useMockPerson(i)` devuelve personas estables con la seed del provider; sin provider, `useTelekinesisMock` devuelve real (user) / fallback (demo) — el fallback es el segundo argumento opcional `demoValue`.
- [ ] **Step 3.2: Implementar:**

```tsx
export interface TelekinesisMockContextValue {
  seed: number;
  values: Record<string, React.ReactNode>;
}
export function TelekinesisMockProvider(props: { seed?: number; values?: Record<string, React.ReactNode>; children: React.ReactNode }): React.ReactElement;

/** Valor real para usuarios; en demo, values[key] del provider, o demoValue, o el real como último recurso. */
export function useTelekinesisMock<T extends React.ReactNode>(key: string, real: T, demoValue?: T): T | React.ReactNode;
/** Mock generator ligado a la seed del provider (memoizado). */
export function useMock(): Mock;
export function useMockPerson(index: number): { name: string; email: string; company: string };
```

`useMock` = `useMemo(() => createMock(ctx.seed), [ctx.seed])`. La detección demo usa el mismo patrón upgrade (estado + layout effect) para no romper hidratación SSR — extraer ese patrón a un hook interno `useIsDemoMode()` en `core/src/react/` y reutilizarlo desde Frame/Stage/Safe/Login (refactor de 6 líneas, sin cambio de comportamiento; los componentes existentes se tocan solo para importar el hook).

- [ ] **Step 3.3:** Tests PASS. Commit: `feat(core): mock provider and hooks (seeded, SSR-safe)`

### Task 4: `<TelekineticLogin>` — la puerta de flujos restringidos

**Files:** Create `packages/core/src/react/TelekineticLogin.tsx`, `packages/core/test/login.test.tsx`; Modify `packages/core/src/index.ts`

- [ ] **Step 4.1: Tests que fallan:**

```tsx
// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
// …
describe("modo usuario", () => {
  it("renderiza children sin llamar a onDemoAuth", () => {
    const spy = vi.fn();
    render(<TelekineticLogin onDemoAuth={spy}><p>login real</p></TelekineticLogin>);
    expect(spy).not.toHaveBeenCalled();
    expect(screen.getByText("login real")).toBeInTheDocument();
  });
});
describe("modo demo", () => {
  it("llama onDemoAuth(demoUser) una sola vez y muestra fallback hasta resolver", async () => {
    setForcedDemoMode(true);
    let resolve!: () => void;
    const spy = vi.fn(() => new Promise<void>((r) => { resolve = r; }));
    render(
      <TelekineticLogin onDemoAuth={spy} demoUser={{ name: "Ada" }} fallback={<p>abriendo sesión…</p>}>
        <p>dashboard</p>
      </TelekineticLogin>,
    );
    expect(screen.getByText("abriendo sesión…")).toBeInTheDocument();
    await act(async () => { resolve(); });
    expect(screen.getByText("dashboard")).toBeInTheDocument();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith({ name: "Ada" });
  });
  it("si onDemoAuth lanza, muestra el error y no los children", async () => { … });
});
```

- [ ] **Step 4.2: Implementar:**

```tsx
export interface TelekineticLoginProps<U = unknown> {
  /**
   * Se ejecuta SOLO en modo demo, una vez, antes de renderizar children.
   * Aquí el autor de la app siembra su sesión falsa: setear su store de auth,
   * escribir el token demo en localStorage, llamar a su endpoint /demo-login…
   */
  onDemoAuth: (demoUser: U) => void | Promise<void>;
  /** Perfil de usuario demo que recibe onDemoAuth. */
  demoUser?: U;
  /** Qué renderizar mientras onDemoAuth resuelve (default: null). */
  fallback?: React.ReactNode;
  children: React.ReactNode;
}
```

Estados internos: `idle → authenticating → ready | failed`. En modo usuario: children directos (sin estados). En demo: layout effect dispara `onDemoAuth` (guard `useRef` contra StrictMode double-invoke), `fallback` mientras, children al resolver, mensaje inline `[telekinesis] demo auth failed: <msg>` si rechaza (visible en el vídeo: mejor un error legible que un demo colgado). Genérico `<U>` con default.

- [ ] **Step 4.3:** Tests PASS + export. Commit: `feat(core): TelekineticLogin — demo-session gate for restricted flows`

### Task 5: `Timesheet.auth` + soporte en engine y CLI

**Files:** Modify `packages/schema/src/timesheet.ts`, `packages/schema/test/timesheet.test.ts`; Create `packages/engine/src/auth.ts`, `packages/engine/test/auth.test.ts`; Modify `packages/engine/src/record.ts`, `packages/engine/src/index.ts`, `packages/engine/package.json`, `packages/cli/src/commands/{record,preview}.ts`

- [ ] **Step 5.1: Schema + tests.** En `timesheet.ts`:

```ts
/** Sesión pre-cocinada para grabar detrás de un login real (CI-friendly). */
export const TimesheetAuth = z.object({
  /** Path (relativo al timesheet) a un storageState de Playwright. */
  storageState: z.string().optional(),
  /** Pares clave→valor sembrados en localStorage del origin ANTES de cargar la página. */
  localStorage: z.record(z.string()).optional(),
  cookies: z.array(z.object({
    name: z.string(), value: z.string(), domain: z.string().optional(),
    url: z.string().optional(), path: z.string().default("/"),
    httpOnly: z.boolean().default(false), secure: z.boolean().default(false),
  })).optional(),
});
```

`Timesheet` gana `auth: TimesheetAuth.optional()`. Tests: parsea con/sin auth; cookie sin name falla; timesheet viejo intacto.

- [ ] **Step 5.2: Engine — módulo puro + tests** (`auth.ts`; añadir vitest a engine con script `test` — hoy no tiene):

```ts
export interface ResolvedAuth {
  contextOptions: { storageState?: string };
  cookies: Cookie[];               // normalizadas: url derivada del target si faltan domain/url
  initScript?: string;             // "try{localStorage.setItem(…)}catch{}" por cada par, JSON-escapado
}
/** Traduce Timesheet.auth a piezas de Playwright. `baseDir` resuelve storageState relativo; `targetUrl` completa cookies sin domain. */
export function resolveAuth(auth: TimesheetAuth | undefined, baseDir: string, targetUrl: string): ResolvedAuth;
```

Tests: storageState relativo se resuelve contra `baseDir`; cookie sin domain hereda `url: targetUrl`; localStorage genera initScript con valores escapados (comillas, `</script>`); `undefined` → todo vacío.

- [ ] **Step 5.3: Cablear en `record()`.** `RecordOptions` gana `timesheetDir?: string` (el CLI lo pasa: `path.dirname(timesheetPath)`) y `storageState?: string` (override CLI). Tras `parseTimesheet`: `const auth = resolveAuth(sheet.auth, opts.timesheetDir ?? process.cwd(), url)`; aplicar `...auth.contextOptions` en `newContext` (el override de `opts.storageState` gana), `await context.addCookies(auth.cookies)` si hay, `await context.addInitScript(auth.initScript)` si hay — **todo antes de `page.goto`**. Si `storageState` apunta a un fichero inexistente: error claro `Telekinesis: auth.storageState not found at <abs path> — generate it with "npx playwright codegen --save-storage=<file> <url>"`.
- [ ] **Step 5.4: CLI.** `record` y `preview` ganan `--storage-state <file>`; pasan `timesheetDir`. Ayuda del flag menciona el codegen. `extract.ts`/MCP: fuera de alcance (documentado — el contexto de extracción no autentica; usar `?demo` + TelekineticLogin para eso).
- [ ] **Step 5.5:** `pnpm --filter @telekinesis/engine test && pnpm typecheck` + commit: `feat(schema,engine,cli): timesheet auth (storageState, cookies, localStorage seeding)`

### Task 6: Fixture real — el "vault" del playground

**Files:** Create `playground/src/vault/{App.tsx,main.tsx}` + `playground/vault.html`; Modify `playground/vite.config.ts`; Create `examples/restricted-dashboard.timesheet.json`

- [ ] **Step 6.1: Página vault.** Nueva entrada Vite (`vault.html`, patrón copiado de `landing.html` — comprobar cómo declara inputs `vite.config.ts` y añadir el tercero). La app:
  - Estado auth fake: `localStorage["vault-token"]`. Sin token → pantalla de login real (formulario que setea el token). Con token → dashboard.
  - El dashboard entero envuelto en `<TelekineticLogin onDemoAuth={() => localStorage.setItem("vault-token", "demo")} demoUser={{ name: "Ada Lovelace" }}>`.
  - Dentro: `<TelekinesisMockProvider seed={2026} values={{ balance: "4.821,50 €" }}>`, una tarjeta "API key" con `<TelekineticSafe id="api-key" mask="redact">`, un email de cuenta con `<TelekineticSafe id="owner-email" mock="ada@example.com">`, una tabla de 5 filas `useMockPerson(i)`, y `<TelekineticFrame>`s normales para navegar (`vault-nav`, `vault-balance`, `vault-table`).
  - `<TelekinesisStage />` montado.
- [ ] **Step 6.2: Timesheet de ejemplo** `examples/restricted-dashboard.timesheet.json`: url `http://localhost:5173/vault.html?demo`, timeline: wait → zoom-in(vault-balance) → callout/highlight(api-key) → highlight(owner-email) → scroll a la tabla → zoom-out. (Usar `highlight`; si el Plan 1 aterrizó, cambiar a `callout` con texto "Enmascarado por TelekineticSafe".)
- [ ] **Step 6.3: Validación sensorial doble:**
  1. `pnpm playground` → `http://localhost:5173/vault.html` **sin** `?demo`: login real visible, datos "reales" (los del código), cero atributos `data-telekinesis-*` en el inspector.
  2. Con `?demo`: entra solo, la key sale como `••••…`, el email es `ada@example.com`, la tabla es de gente del PRNG.
  3. `telekinesis preview examples/restricted-dashboard.timesheet.json` — el tour corre entero sin tocar el login.
- [ ] **Step 6.4:** Commit: `feat(playground): vault fixture — restricted dashboard with demo auth and mocks`

### Task 7: Documentación (recetas) + integración con secuencias

**Files:** Create `docs/safe-mode.md`, `apps/docs/src/content/restricted-flows.mdx`; Modify `apps/docs/src/content/_meta.js`, `README.md`, `docs/timesheet.md`

- [ ] **Step 7.1: `docs/safe-mode.md`** con esta estructura exacta:
  1. **El problema** (datos reales en vídeos publicados; logins que caducan las grabaciones).
  2. **Decisión rápida** — tabla: "¿Qué tienes?" → herramienta (`contenido sensible → TelekineticSafe` · `zona tras login propio → TelekineticLogin` · `login de terceros/SSO real → auth.storageState` · `token simple → auth.localStorage`).
  3. **Receta A — mock/redact/blur** (código del vault, explicar prioridad mock > mask).
  4. **Receta B — TelekineticLogin** (con el snippet de `onDemoAuth` y la nota StrictMode/una-sola-vez).
  5. **Receta C — auth en el timesheet** (JSON con `auth.localStorage`; generación de storageState con `playwright codegen --save-storage`; recordatorio `.gitignore`).
  6. **Determinismo** (seeds, por qué los GIFs de CI no parpadean).
  7. **Seguridad — lo que esto NO es**: los mocks van en el bundle (regla dura 2, en un callout); `TelekineticSafe` no borra datos del DOM en modo usuario; el modo demo es forzable por cualquiera con `?demo` — por eso la regla es *nunca* renderizar datos de otros usuarios en demo, no "ocultarlos mejor".
- [ ] **Step 7.2: Docs site:** `restricted-flows.mdx` (mismo contenido, con `<Frame>`s para que la página sea grabable) + `_meta.js` tras `recording`. `docs/timesheet.md`: sección "auth" con la tabla de campos. README: bullet nuevo en "What you get": *"Restricted flows, safely — demo sessions and deterministic mock data for the parts of your app you can't show."* con link.
- [ ] **Step 7.3: Sinergia Plan 2** (solo si existe `sequences.ts`): las defaults de la secuencia `login` pasan a citar `docs/safe-mode.md` en su description; añadir nota cruzada en ambos docs.
- [ ] **Step 7.4:** Commit: `docs: restricted flows & mock data guide`

### Task 8: Puerta de calidad final

- [ ] **Step 8.1:** `pnpm typecheck && pnpm test && pnpm build` — PASS.
- [ ] **Step 8.2: Grabación de humo del flujo completo:** `pnpm --filter @telekinesis/playground build && pnpm --filter @telekinesis/playground preview &` → `telekinesis record examples/restricted-dashboard.timesheet.json -u http://localhost:4173/vault.html?demo -o /tmp/plan4-smoke.mp4` — Expected: vídeo del dashboard con datos mock, sin pasar por el login. Inspección manual del MP4 (¿algún dato "real" visible? → fallo de plan, no de código).
- [ ] **Step 8.3:** PR: `feat: safe/login telekinetic components + timesheet auth (restricted flows with mock data)`.

---

## Definición de hecho

- `TelekineticSafe` (mock/redact/blur, registrable), `TelekineticLogin` (gate una-sola-vez con fallback/error), `TelekinesisMockProvider` + hooks, y `createMock` determinista — todos exportados, testeados (incluido el passthrough byte-exacto en modo usuario) y SSR-safe.
- `Timesheet.auth` aditivo; `record()` aplica storageState/cookies/localStorage antes del goto; `--storage-state` en CLI; errores accionables.
- Fixture `vault` demostrando el flujo E2E + timesheet de ejemplo que graba sin login.
- `docs/safe-mode.md` + página del site con las 3 recetas y el modelo de amenazas honesto.
- Cero huella en modo usuario verificada por test; ningún secreto real en repo ni en ejemplos.
